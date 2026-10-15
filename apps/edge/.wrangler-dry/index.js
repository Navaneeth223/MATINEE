var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/room-do.ts
var IDLE_EXPIRY_MS = 12 * 60 * 60 * 1e3;
var RATE_LIMIT_BURST = 40;
var RATE_LIMIT_SUSTAINED = 20;
var MAX_FRAME_SIZE = 64 * 1024;
var MAX_SOCKETS = 4;
var PERSIST_INTERVAL_MS = 5 * 60 * 1e3;
var RE_PEER = /^[0-9a-f]{16}$/;
var RE_SID = /^[0-9a-f]{8}$/;
var RE_TYPE = /^[a-z0-9._-]{1,32}$/;
var RE_IV_MAX = 32;
var MAX_CT_CHARS = 14e5;
var RoomDO = class {
  static {
    __name(this, "RoomDO");
  }
  state;
  env;
  lastActiveAt = Date.now();
  lastPersistAt = 0;
  UNADMITTED_TIMEOUT_MS;
  HALF_OPEN_TIMEOUT_MS;
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.UNADMITTED_TIMEOUT_MS = parseInt(env.UNADMITTED_TIMEOUT_MS || "10000", 10);
    this.HALF_OPEN_TIMEOUT_MS = parseInt(env.HALF_OPEN_TIMEOUT_MS || "60000", 10);
    this.state.blockConcurrencyWhile(async () => {
      const roomState = await this.getRoomState();
      if (roomState) {
        this.lastActiveAt = roomState.lastActiveAt;
      }
    });
  }
  async fetch(req) {
    const upgradeHeader = req.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }
    const url = new URL(req.url);
    const peerId = url.searchParams.get("p");
    if (!peerId || !RE_PEER.test(peerId)) {
      return new Response("Invalid peerId (must be 16 hex chars)", { status: 400 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [peerId]);
    const now = Date.now();
    const attachment = {
      peerId,
      admitted: false,
      lastSeenAt: now,
      connectedAt: now,
      bucket: {
        t: now,
        n: RATE_LIMIT_BURST
      }
    };
    server.serializeAttachment(attachment);
    this.touchActivity();
    this.scheduleUnadmittedCheck();
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  async webSocketMessage(ws, message) {
    try {
      const attachment = ws.deserializeAttachment();
      if (!attachment) {
        ws.close(1002, "No attachment");
        return;
      }
      const size = typeof message === "string" ? message.length : message.byteLength;
      if (size > MAX_FRAME_SIZE) {
        ws.close(1009, "Message too large");
        return;
      }
      if (!this.checkRateLimit(attachment, size)) {
        ws.close(1008, "Rate limit exceeded");
        return;
      }
      attachment.lastSeenAt = Date.now();
      ws.serializeAttachment(attachment);
      let frame;
      try {
        frame = typeof message === "string" ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
      } catch {
        ws.close(1003, "Invalid JSON");
        return;
      }
      if (this.isControlFrame(frame)) {
        await this.handleControlFrame(ws, frame, attachment);
      } else if (this.isValidEnvelope(frame)) {
        await this.relayEnvelope(ws, frame, attachment);
      } else {
        return;
      }
      this.touchActivity();
    } catch (err) {
      console.error("webSocketMessage error:", err);
      ws.close(1011, "Internal error");
    }
  }
  async webSocketClose(ws, code, reason) {
    await this.cleanupSocket(ws);
  }
  async webSocketError(ws, error) {
    await this.cleanupSocket(ws);
  }
  async cleanupSocket(ws) {
    const attachment = ws.deserializeAttachment();
    if (!attachment) return;
    const roomState = await this.getRoomState();
    if (roomState && attachment.admitted) {
      roomState.admitted = roomState.admitted.filter((id) => id !== attachment.peerId);
      await this.state.storage.put("state", roomState);
    }
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      if (sock === ws) continue;
      const otherAttachment = sock.deserializeAttachment();
      if (otherAttachment?.admitted) {
        sock.send(JSON.stringify({
          type: "presence",
          peerId: attachment.peerId,
          status: "left"
        }));
      }
    }
    this.touchActivity();
  }
  async alarm() {
    const now = Date.now();
    const idleTime = now - this.lastActiveAt;
    if (idleTime >= IDLE_EXPIRY_MS) {
      const sockets2 = this.state.getWebSockets();
      for (const sock of sockets2) {
        sock.close(1e3, "Room expired");
      }
      await this.state.storage.deleteAll();
      return;
    }
    const sockets = this.state.getWebSockets();
    let nextUnadmittedDeadline = null;
    for (const sock of sockets) {
      const attachment = sock.deserializeAttachment();
      if (!attachment || attachment.admitted) continue;
      const age = now - attachment.connectedAt;
      if (age >= this.UNADMITTED_TIMEOUT_MS) {
        sock.close(1008, "Admission timeout");
      } else {
        const deadline = attachment.connectedAt + this.UNADMITTED_TIMEOUT_MS;
        if (!nextUnadmittedDeadline || deadline < nextUnadmittedDeadline) {
          nextUnadmittedDeadline = deadline;
        }
      }
    }
    const idleDeadline = this.lastActiveAt + IDLE_EXPIRY_MS;
    const nextAlarm = nextUnadmittedDeadline && nextUnadmittedDeadline < idleDeadline ? nextUnadmittedDeadline : idleDeadline;
    await this.state.storage.setAlarm(nextAlarm);
  }
  isControlFrame(frame) {
    return frame && typeof frame.type === "string" && ["join", "ping"].includes(frame.type);
  }
  isValidEnvelope(frame) {
    if (!frame || frame.v !== 1) return false;
    if (typeof frame.t !== "string" || !RE_TYPE.test(frame.t)) return false;
    if (typeof frame.from !== "string" || !RE_PEER.test(frame.from)) return false;
    if (frame.to !== void 0 && (typeof frame.to !== "string" || !RE_PEER.test(frame.to))) return false;
    if (!RE_SID.test(frame.sid)) return false;
    if (!Number.isSafeInteger(frame.seq) || frame.seq < 0) return false;
    if (typeof frame.iv !== "string" || frame.iv.length > RE_IV_MAX) return false;
    if (typeof frame.ct !== "string" || frame.ct.length > MAX_CT_CHARS) return false;
    return true;
  }
  async handleControlFrame(ws, frame, attachment) {
    switch (frame.type) {
      case "join":
        await this.handleJoin(ws, frame, attachment);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;
    }
  }
  async handleJoin(ws, frame, attachment) {
    if (attachment.admitted) {
      return;
    }
    const joinToken = frame.joinToken;
    if (!joinToken || typeof joinToken !== "string") {
      ws.send(JSON.stringify({ type: "join-denied", reason: "Missing joinToken" }));
      ws.close(1008, "Missing joinToken");
      return;
    }
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(joinToken));
    const hash = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const roomState = await this.getRoomState();
    const now = Date.now();
    if (!roomState) {
      const newState = {
        joinTokenHash: hash,
        createdAt: now,
        lastActiveAt: now,
        maxPeers: 2,
        admitted: [attachment.peerId]
      };
      await this.state.storage.put("state", newState);
      attachment.admitted = true;
      ws.serializeAttachment(attachment);
      await this.state.storage.setAlarm(now + IDLE_EXPIRY_MS);
      ws.send(JSON.stringify({ type: "join-ok", role: "creator", peers: [] }));
      return;
    }
    if (hash !== roomState.joinTokenHash) {
      ws.send(JSON.stringify({ type: "join-denied", reason: "Wrong secret" }));
      ws.close(1008, "Wrong secret");
      return;
    }
    if (roomState.admitted.length >= roomState.maxPeers) {
      await this.evictHalfOpenSockets(roomState);
      if (roomState.admitted.length >= roomState.maxPeers) {
        ws.send(JSON.stringify({ type: "join-denied", reason: "Room full" }));
        ws.close(1008, "Room full");
        return;
      }
    }
    roomState.admitted.push(attachment.peerId);
    roomState.lastActiveAt = now;
    await this.state.storage.put("state", roomState);
    attachment.admitted = true;
    ws.serializeAttachment(attachment);
    const otherPeers = roomState.admitted.filter((id) => id !== attachment.peerId);
    ws.send(JSON.stringify({ type: "join-ok", role: "joiner", peers: otherPeers }));
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      if (sock === ws) continue;
      const otherAttachment = sock.deserializeAttachment();
      if (otherAttachment?.admitted) {
        sock.send(JSON.stringify({
          type: "presence",
          peerId: attachment.peerId,
          status: "joined"
        }));
      }
    }
  }
  async relayEnvelope(ws, envelope, attachment) {
    if (!attachment.admitted) return;
    if (envelope.from !== attachment.peerId) return;
    const relayedEnvelope = {
      v: 1,
      t: envelope.t,
      from: envelope.from,
      to: envelope.to,
      seq: envelope.seq,
      sid: envelope.sid,
      iv: envelope.iv,
      ct: envelope.ct
    };
    const sockets = this.state.getWebSockets();
    const targetPeerId = envelope.to;
    const serialized = JSON.stringify(relayedEnvelope);
    for (const sock of sockets) {
      if (sock === ws) continue;
      const otherAttachment = sock.deserializeAttachment();
      if (!otherAttachment?.admitted) continue;
      if (!targetPeerId || otherAttachment.peerId === targetPeerId) {
        sock.send(serialized);
        if (targetPeerId) break;
      }
    }
  }
  checkRateLimit(attachment, bytes) {
    const now = Date.now();
    const elapsed = (now - attachment.bucket.t) / 1e3;
    const refill = elapsed * RATE_LIMIT_SUSTAINED;
    attachment.bucket.n = Math.min(RATE_LIMIT_BURST, attachment.bucket.n + refill);
    attachment.bucket.t = now;
    const cost = bytes / 1024;
    if (attachment.bucket.n < cost) {
      return false;
    }
    attachment.bucket.n -= cost;
    return true;
  }
  async getRoomState() {
    return await this.state.storage.get("state") ?? null;
  }
  touchActivity() {
    const now = Date.now();
    this.lastActiveAt = now;
    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.lastPersistAt = now;
      this.persistActivity();
    }
  }
  async persistActivity() {
    const roomState = await this.getRoomState();
    if (roomState) {
      roomState.lastActiveAt = this.lastActiveAt;
      await this.state.storage.put("state", roomState);
    }
  }
  scheduleUnadmittedCheck() {
    const now = Date.now();
    const nextCheck = now + this.UNADMITTED_TIMEOUT_MS;
    this.state.storage.getAlarm().then((existing) => {
      if (!existing || nextCheck < existing) {
        this.state.storage.setAlarm(nextCheck);
      }
    });
  }
  async evictHalfOpenSockets(roomState) {
    const now = Date.now();
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      const attachment = sock.deserializeAttachment();
      if (!attachment?.admitted) continue;
      if (now - attachment.lastSeenAt >= this.HALF_OPEN_TIMEOUT_MS) {
        roomState.admitted = roomState.admitted.filter((id) => id !== attachment.peerId);
        sock.close(1008, "Evicted (half-open)");
      }
    }
  }
  enforceSocketCap() {
    const sockets = this.state.getWebSockets();
    if (sockets.length <= MAX_SOCKETS) return;
    const unadmitted = sockets.map((sock) => ({ sock, attachment: sock.deserializeAttachment() })).filter(({ attachment }) => attachment && !attachment.admitted).sort((a, b) => a.attachment.connectedAt - b.attachment.connectedAt);
    const excess = sockets.length - MAX_SOCKETS;
    for (let i = 0; i < Math.min(excess, unadmitted.length); i++) {
      unadmitted[i].sock.close(1008, "Socket limit");
    }
  }
};

// src/index.ts
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (url.pathname.startsWith("/api/rooms")) {
      return handleRooms(request, env);
    }
    if (url.pathname.startsWith("/api/ice")) {
      return handleICE(request, env);
    }
    if (url.pathname.startsWith("/ws/")) {
      const roomId = url.pathname.slice(4);
      const doId = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(doId);
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
async function handleRooms(req, env) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (req.method === "POST") {
    const roomId = crypto.randomUUID();
    const url = new URL(req.url);
    const inviteUrl = `${url.origin}/room/${roomId}`;
    return Response.json({ roomId, inviteUrl }, {
      status: 201,
      headers: corsHeaders
    });
  }
  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
__name(handleRooms, "handleRooms");
async function handleICE(_req, _env) {
  const iceServers = [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" }
  ];
  return Response.json({ iceServers }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(handleICE, "handleICE");
export {
  RoomDO,
  index_default as default
};
//# sourceMappingURL=index.js.map
