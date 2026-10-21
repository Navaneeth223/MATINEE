import type { DurableObjectState, DurableObjectNamespace } from '@cloudflare/workers-types';
import type { Envelope } from '@matinee/protocol';

interface Env {
  ROOM_DO: DurableObjectNamespace;
}

interface RoomState {
  joinTokenHash: string | null;
  createdAt: number;
  lastActiveAt: number;
  maxPeers: number;
}

interface SocketAttachment {
  peerId: string;
  admitted: boolean;
  lastSeenAt: number;
  connectedAt: number;
  bucket: {
    t: number;
    n: number;
  };
}

const IDLE_EXPIRY_MS = 12 * 60 * 60 * 1000;
const RATE_LIMIT_BURST = 40;
const RATE_LIMIT_SUSTAINED = 20;
const MAX_FRAME_SIZE = 64 * 1024;
const MAX_SOCKETS = 4;
const PERSIST_INTERVAL_MS = 5 * 60 * 1000;
const UNADMITTED_TIMEOUT_MS = 10000;

const RE_PEER = /^[0-9a-f]{16}$/;
const RE_SID = /^[0-9a-f]{8}$/;
const RE_TYPE = /^[a-z0-9._-]{1,32}$/;
const RE_IV_MAX = 32;
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
      connectedAt: now,
      bucket: {
        t: now,
        n: RATE_LIMIT_BURST,
      },
    };
    server.serializeAttachment(attachment);

    this.touchActivity();
    this.scheduleUnadmittedCheck();

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

      if (this.isControlFrame(frame)) {
        await this.handleControlFrame(ws, frame, attachment);
      } else if (this.isValidEnvelope(frame)) {
        await this.relayEnvelope(ws, frame as Envelope, attachment);
      } else {
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
    if (!attachment || !attachment.admitted) return;

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
      return;
    }

    const sockets = this.state.getWebSockets();
    let nextUnadmittedDeadline: number | null = null;
    
    for (const sock of sockets) {
      const attachment = sock.deserializeAttachment() as SocketAttachment;
      if (!attachment || attachment.admitted) continue;

      const age = now - attachment.connectedAt;
      if (age >= UNADMITTED_TIMEOUT_MS) {
        sock.close(1008, 'Admission timeout');
      } else {
        const deadline = attachment.connectedAt + UNADMITTED_TIMEOUT_MS;
        if (!nextUnadmittedDeadline || deadline < nextUnadmittedDeadline) {
          nextUnadmittedDeadline = deadline;
        }
      }
    }

    const idleDeadline = this.lastActiveAt + IDLE_EXPIRY_MS;
    const nextAlarm = nextUnadmittedDeadline && nextUnadmittedDeadline < idleDeadline
      ? nextUnadmittedDeadline
      : idleDeadline;
    
    await this.state.storage.setAlarm(nextAlarm);
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
    if (attachment.admitted) {
      return;
    }

    const joinToken = frame.joinToken;
    if (!joinToken || typeof joinToken !== 'string') {
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Missing joinToken' }));
      ws.close(1008, 'Missing joinToken');
      return;
    }

    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(joinToken));
    const hash = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const roomState = await this.getRoomState();
    const now = Date.now();
    const sockets = this.state.getWebSockets();

    // Count DISTINCT admitted peerIds among LIVE sockets
    const liveAdmitted = new Set<string>();
    for (const sock of sockets) {
      const att = sock.deserializeAttachment() as SocketAttachment;
      if (att?.admitted) {
        liveAdmitted.add(att.peerId);
      }
    }

    // First joiner: create room
    if (!roomState) {
      const newState: RoomState = {
        joinTokenHash: hash,
        createdAt: now,
        lastActiveAt: now,
        maxPeers: 2,
      };
      await this.state.storage.put('state', newState);

      attachment.admitted = true;
      ws.serializeAttachment(attachment);

      await this.state.storage.setAlarm(now + IDLE_EXPIRY_MS);

      console.log(`join peer=${attachment.peerId.slice(0, 6)} live=${liveAdmitted.size + 1} result=ok`);
      ws.send(JSON.stringify({ type: 'join-ok', role: 'creator', peers: [] }));
      return;
    }

    // Check joinToken matches
    if (hash !== roomState.joinTokenHash) {
      console.log(`join peer=${attachment.peerId.slice(0, 6)} live=${liveAdmitted.size} result=wrong`);
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Wrong secret' }));
      ws.close(1008, 'Wrong secret');
      return;
    }

    // Same peerId rejoining: close old socket
    let replaced = false;
    for (const sock of sockets) {
      if (sock === ws) continue;
      const att = sock.deserializeAttachment() as SocketAttachment;
      if (att?.peerId === attachment.peerId) {
        sock.close(1000, 'replaced');
        replaced = true;
        break;
      }
    }

    // Recount after replacement
    if (replaced) {
      liveAdmitted.delete(attachment.peerId);
    }

    // Check capacity
    if (liveAdmitted.size >= roomState.maxPeers) {
      console.log(`join peer=${attachment.peerId.slice(0, 6)} live=${liveAdmitted.size} result=full`);
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Room full' }));
      ws.close(1008, 'Room full');
      return;
    }

    // Admit
    attachment.admitted = true;
    ws.serializeAttachment(attachment);

    roomState.lastActiveAt = now;
    await this.state.storage.put('state', roomState);

    const otherPeers = Array.from(liveAdmitted);
    console.log(`join peer=${attachment.peerId.slice(0, 6)} live=${liveAdmitted.size + 1} result=${replaced ? 'replaced' : 'ok'}`);
    ws.send(JSON.stringify({ type: 'join-ok', role: liveAdmitted.size === 0 ? 'creator' : 'joiner', peers: otherPeers }));

    // Notify other peers (skip if replacement)
    if (!replaced) {
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
  }

  private async relayEnvelope(ws: WebSocket, envelope: Envelope, attachment: SocketAttachment): Promise<void> {
    if (!attachment.admitted) return;

    if (envelope.from !== attachment.peerId) return;

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

    const cost = bytes / 1024;

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

  private scheduleUnadmittedCheck(): void {
    const now = Date.now();
    const nextCheck = now + UNADMITTED_TIMEOUT_MS;
    
    this.state.storage.getAlarm().then((existing) => {
      if (!existing || nextCheck < existing) {
        this.state.storage.setAlarm(nextCheck);
      }
    });
  }
}
