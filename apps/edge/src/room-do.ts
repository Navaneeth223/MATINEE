import type { DurableObjectState, DurableObjectNamespace } from '@cloudflare/workers-types';
import type { Envelope } from '@matinee/protocol';

/**
 * RoomDO - Durable Object for 2-peer E2EE room coordination
 * Per SPEC-M2B.md: joinToken auth, 2-peer cap, relay sealed envelopes only, 12h expiry
 */

interface Env {
  ROOM_DO: DurableObjectNamespace;
}

interface RoomState {
  joinTokenHash: string | null;  // sha256(joinToken), set on creation
  createdAt: number;
  lastActiveAt: number;
  maxPeers: number;  // always 2
  admitted: string[];  // peerIds that passed joinToken check
}

interface SocketAttachment {
  peerId: string;
  admitted: boolean;
  lastSeenAt: number;  // timestamp of last valid frame
  bucket: {
    t: number;  // last refill timestamp
    n: number;  // tokens (float)
  };
}

const IDLE_EXPIRY_MS = 12 * 60 * 60 * 1000;  // 12 hours
const RATE_LIMIT_BURST = 40;
const RATE_LIMIT_SUSTAINED = 20;  // msgs/sec
const MAX_FRAME_SIZE = 64 * 1024;  // 64 KiB
const UNADMITTED_TIMEOUT_MS = 10_000;  // 10 seconds
const HALF_OPEN_TIMEOUT_MS = 60_000;  // 60 seconds
const MAX_SOCKETS = 4;
const PERSIST_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

const RE_PEER = /^[0-9a-f]{16}$/;
const RE_SID = /^[0-9a-f]{8}$/;
const RE_TYPE = /^[a-z0-9._-]{1,32}$/;
const RE_IV_MAX = 32;  // max iv length in chars
const MAX_CT_CHARS = 1_400_000;

export class RoomDO {
  private state: DurableObjectState;
  private env: Env;
  private lastActiveAt: number = Date.now();
  private lastPersistAt: number = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      const roomState = await this.getRoomState();
      if (roomState) {
        this.lastActiveAt = roomState.lastActiveAt;
      }
    });
  }

  async fetch(req: Request): Promise<Response> {
    const upgradeHeader = req.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 });
    }

    const url = new URL(req.url);
    const peerId = url.searchParams.get('p');
    if (!peerId || !RE_PEER.test(peerId)) {
      return new Response('Invalid peerId (must be 16 hex chars)', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server, [peerId]);

    const now = Date.now();
    const attachment: SocketAttachment = {
      peerId,
      admitted: false,
      lastSeenAt: now,
      bucket: {
        t: now,
        n: RATE_LIMIT_BURST,
      },
    };
    server.serializeAttachment(attachment);

    this.touchActivity();
    this.evictIdleSockets();
    this.enforceSocketCap();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const attachment = ws.deserializeAttachment() as SocketAttachment;
      if (!attachment) {
        ws.close(1002, 'No attachment');
        return;
      }

      const size = typeof message === 'string' ? message.length : message.byteLength;
      if (size > MAX_FRAME_SIZE) {
        ws.close(1009, 'Message too large');
        return;
      }

      if (!this.checkRateLimit(attachment, size)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      
      attachment.lastSeenAt = Date.now();
      ws.serializeAttachment(attachment);

      let frame: any;
      try {
        frame = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
      } catch {
        ws.close(1003, 'Invalid JSON');
        return;
      }

      // Validate: either a control frame or a valid Envelope
      if (this.isControlFrame(frame)) {
        await this.handleControlFrame(ws, frame, attachment);
      } else if (this.isValidEnvelope(frame)) {
        await this.relayEnvelope(ws, frame as Envelope, attachment);
      } else {
        // Drop invalid frames silently (per spec: server validates shape, never reads ct)
        return;
      }

      this.touchActivity();
    } catch (err) {
      console.error('webSocketMessage error:', err);
      ws.close(1011, 'Internal error');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    await this.cleanupSocket(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    await this.cleanupSocket(ws);
  }

  private async cleanupSocket(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment;
    if (!attachment) return;

    const roomState = await this.getRoomState();
    if (roomState && attachment.admitted) {
      roomState.admitted = roomState.admitted.filter(id => id !== attachment.peerId);
      await this.state.storage.put('state', roomState);
    }

    // Notify other admitted peers
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      if (sock === ws) continue;
      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (otherAttachment?.admitted) {
        sock.send(JSON.stringify({
          type: 'presence',
          peerId: attachment.peerId,
          status: 'left',
        }));
      }
    }

    this.touchActivity();
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const idleTime = now - this.lastActiveAt;

    if (idleTime >= IDLE_EXPIRY_MS) {
      const sockets = this.state.getWebSockets();
      for (const sock of sockets) {
        sock.close(1000, 'Room expired');
      }
      await this.state.storage.deleteAll();
    } else {
      this.evictIdleSockets();
      const nextCheck = this.lastActiveAt + IDLE_EXPIRY_MS;
      await this.state.storage.setAlarm(nextCheck);
    }
  }

  private isControlFrame(frame: any): boolean {
    return frame && typeof frame.type === 'string' && ['join', 'ping'].includes(frame.type);
  }

  private isValidEnvelope(frame: any): boolean {
    if (!frame || frame.v !== 1) return false;
    if (typeof frame.t !== 'string' || !RE_TYPE.test(frame.t)) return false;
    if (typeof frame.from !== 'string' || !RE_PEER.test(frame.from)) return false;
    if (frame.to !== undefined && (typeof frame.to !== 'string' || !RE_PEER.test(frame.to))) return false;
    if (!RE_SID.test(frame.sid)) return false;
    if (!Number.isSafeInteger(frame.seq) || frame.seq < 0) return false;
    if (typeof frame.iv !== 'string' || frame.iv.length > RE_IV_MAX) return false;
    if (typeof frame.ct !== 'string' || frame.ct.length > MAX_CT_CHARS) return false;
    return true;
  }

  private async handleControlFrame(ws: WebSocket, frame: any, attachment: SocketAttachment): Promise<void> {
    switch (frame.type) {
      case 'join':
        await this.handleJoin(ws, frame, attachment);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  private async handleJoin(ws: WebSocket, frame: any, attachment: SocketAttachment): Promise<void> {
    // Ignore duplicate joins from already-admitted sockets
    if (attachment.admitted) {
      return;
    }

    const joinToken = frame.joinToken;
    if (!joinToken || typeof joinToken !== 'string') {
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Missing joinToken' }));
      ws.close(1008, 'Missing joinToken');
      return;
    }

    // Hash the joinToken
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(joinToken));
    const hash = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Get room state (no await between get and put)
    const roomState = await this.getRoomState();
    const now = Date.now();

    // First joiner: create room
    if (!roomState) {
      const newState: RoomState = {
        joinTokenHash: hash,
        createdAt: now,
        lastActiveAt: now,
        maxPeers: 2,
        admitted: [attachment.peerId],
      };
      await this.state.storage.put('state', newState);

      attachment.admitted = true;
      ws.serializeAttachment(attachment);

      await this.state.storage.setAlarm(now + IDLE_EXPIRY_MS);

      ws.send(JSON.stringify({ type: 'join-ok', role: 'creator', peers: [] }));
      return;
    }

    // Check joinToken matches
    if (hash !== roomState.joinTokenHash) {
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Wrong secret' }));
      ws.close(1008, 'Wrong secret');
      return;
    }

    // Check capacity - if full, evict half-open sockets
    if (roomState.admitted.length >= roomState.maxPeers) {
      await this.evictHalfOpenSockets(roomState);
      
      // Re-check after eviction
      if (roomState.admitted.length >= roomState.maxPeers) {
        ws.send(JSON.stringify({ type: 'join-denied', reason: 'Room full' }));
        ws.close(1008, 'Room full');
        return;
      }
    }

    // Admit
    roomState.admitted.push(attachment.peerId);
    roomState.lastActiveAt = now;
    await this.state.storage.put('state', roomState);

    attachment.admitted = true;
    ws.serializeAttachment(attachment);

    // Send join-ok with existing peer list
    const otherPeers = roomState.admitted.filter(id => id !== attachment.peerId);
    ws.send(JSON.stringify({ type: 'join-ok', role: 'joiner', peers: otherPeers }));

    // Notify other peers
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      if (sock === ws) continue;
      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (otherAttachment?.admitted) {
        sock.send(JSON.stringify({
          type: 'presence',
          peerId: attachment.peerId,
          status: 'joined',
        }));
      }
    }
  }

  private async relayEnvelope(ws: WebSocket, envelope: Envelope, attachment: SocketAttachment): Promise<void> {
    if (!attachment.admitted) return;

    // Validate from matches sender
    if (envelope.from !== attachment.peerId) return;

    // Rebuild envelope with only allowed fields (strip extra fields)
    const relayedEnvelope: Envelope = {
      v: 1,
      t: envelope.t,
      from: envelope.from,
      to: envelope.to,
      seq: envelope.seq,
      sid: envelope.sid,
      iv: envelope.iv,
      ct: envelope.ct,
    };

    const sockets = this.state.getWebSockets();
    const targetPeerId = envelope.to;
    const serialized = JSON.stringify(relayedEnvelope);

    for (const sock of sockets) {
      if (sock === ws) continue;

      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (!otherAttachment?.admitted) continue;

      // Send to specific peer or broadcast to all admitted
      if (!targetPeerId || otherAttachment.peerId === targetPeerId) {
        sock.send(serialized);
        if (targetPeerId) break;
      }
    }
  }

  private checkRateLimit(attachment: SocketAttachment, bytes: number): boolean {
    const now = Date.now();
    const elapsed = (now - attachment.bucket.t) / 1000;
    const refill = elapsed * RATE_LIMIT_SUSTAINED;

    attachment.bucket.n = Math.min(RATE_LIMIT_BURST, attachment.bucket.n + refill);
    attachment.bucket.t = now;

    const cost = bytes / 1024;  // 1 token per KiB

    if (attachment.bucket.n < cost) {
      return false;
    }

    attachment.bucket.n -= cost;
    return true;
  }

  private async getRoomState(): Promise<RoomState | null> {
    return await this.state.storage.get<RoomState>('state') ?? null;
  }

  private touchActivity(): void {
    const now = Date.now();
    this.lastActiveAt = now;
    
    // Persist at most every 5 minutes
    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.lastPersistAt = now;
      this.persistActivity();
    }
  }

  private async persistActivity(): Promise<void> {
    const roomState = await this.getRoomState();
    if (roomState) {
      roomState.lastActiveAt = this.lastActiveAt;
      await this.state.storage.put('state', roomState);
    }
  }

  private evictIdleSockets(): void {
    const now = Date.now();
    const sockets = this.state.getWebSockets();
    
    for (const sock of sockets) {
      const attachment = sock.deserializeAttachment() as SocketAttachment;
      if (!attachment) continue;

      // Close unadmitted sockets older than 10s
      if (!attachment.admitted && now - attachment.lastSeenAt >= UNADMITTED_TIMEOUT_MS) {
        sock.close(1008, 'Admission timeout');
      }
    }
  }

  private async evictHalfOpenSockets(roomState: RoomState): Promise<void> {
    const now = Date.now();
    const sockets = this.state.getWebSockets();
    
    // Find admitted sockets that are silent for >60s
    for (const sock of sockets) {
      const attachment = sock.deserializeAttachment() as SocketAttachment;
      if (!attachment?.admitted) continue;

      if (now - attachment.lastSeenAt >= HALF_OPEN_TIMEOUT_MS) {
        // Remove from admitted list
        roomState.admitted = roomState.admitted.filter(id => id !== attachment.peerId);
        sock.close(1008, 'Evicted (half-open)');
      }
    }
  }

  private enforceSocketCap(): void {
    const sockets = this.state.getWebSockets();
    if (sockets.length <= MAX_SOCKETS) return;

    // Close oldest unadmitted sockets
    const unadmitted = sockets
      .map(sock => ({ sock, attachment: sock.deserializeAttachment() as SocketAttachment }))
      .filter(({ attachment }) => attachment && !attachment.admitted)
      .sort((a, b) => a.attachment.lastSeenAt - b.attachment.lastSeenAt);

    const excess = sockets.length - MAX_SOCKETS;
    for (let i = 0; i < Math.min(excess, unadmitted.length); i++) {
      unadmitted[i].sock.close(1008, 'Socket limit');
    }
  }
}
