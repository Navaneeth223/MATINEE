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
  bucket: {
    t: number;  // last refill timestamp
    n: number;  // tokens remaining
  };
}

const IDLE_EXPIRY_MS = 12 * 60 * 60 * 1000;  // 12 hours
const RATE_LIMIT_BURST = 40;
const RATE_LIMIT_SUSTAINED = 20;  // msgs/sec
const MAX_FRAME_SIZE = 64 * 1024;  // 64 KiB

const RE_PEER = /^[0-9a-f]{16}$/;
const RE_SID = /^[0-9a-f]{8}$/;
const RE_TYPE = /^[a-z0-9._-]{1,32}$/;
const MAX_CT_CHARS = 1_400_000;

export class RoomDO {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
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

    const attachment: SocketAttachment = {
      peerId,
      admitted: false,
      bucket: {
        t: Date.now(),
        n: RATE_LIMIT_BURST,
      },
    };
    server.serializeAttachment(attachment);

    await this.touchActivity();

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

      if (!this.checkRateLimit(attachment)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
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

      await this.touchActivity();
    } catch (err) {
      console.error('webSocketMessage error:', err);
      ws.close(1011, 'Internal error');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
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

    await this.touchActivity();
  }

  async alarm(): Promise<void> {
    const roomState = await this.getRoomState();
    if (!roomState) return;

    const now = Date.now();
    const idleTime = now - roomState.lastActiveAt;

    if (idleTime >= IDLE_EXPIRY_MS) {
      const sockets = this.state.getWebSockets();
      for (const sock of sockets) {
        sock.close(1000, 'Room expired');
      }
      await this.state.storage.deleteAll();
    } else {
      const nextCheck = roomState.lastActiveAt + IDLE_EXPIRY_MS;
      await this.state.storage.setAlarm(nextCheck);
    }
  }

  private isControlFrame(frame: any): boolean {
    return frame && typeof frame.type === 'string' && ['join', 'ping', 'presence'].includes(frame.type);
  }

  private isValidEnvelope(frame: any): boolean {
    if (!frame || frame.v !== 1) return false;
    if (typeof frame.t !== 'string' || !RE_TYPE.test(frame.t)) return false;
    if (typeof frame.from !== 'string' || !RE_PEER.test(frame.from)) return false;
    if (frame.to !== undefined && (typeof frame.to !== 'string' || !RE_PEER.test(frame.to))) return false;
    if (!RE_SID.test(frame.sid)) return false;
    if (!Number.isSafeInteger(frame.seq) || frame.seq < 0) return false;
    if (typeof frame.iv !== 'string' || typeof frame.ct !== 'string') return false;
    if (frame.ct.length > MAX_CT_CHARS) return false;
    return true;
  }

  private async handleControlFrame(ws: WebSocket, frame: any, attachment: SocketAttachment): Promise<void> {
    const roomState = await this.getRoomState();

    switch (frame.type) {
      case 'join':
        await this.handleJoin(ws, frame, attachment, roomState);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'presence':
        if (attachment.admitted) {
          await this.broadcastToAdmitted(ws, frame, attachment);
        }
        break;
    }
  }

  private async handleJoin(ws: WebSocket, frame: any, attachment: SocketAttachment, roomState: RoomState | null): Promise<void> {
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

    // First joiner: create room
    if (!roomState) {
      roomState = {
        joinTokenHash: hash,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        maxPeers: 2,
        admitted: [attachment.peerId],
      };
      await this.state.storage.put('state', roomState);

      attachment.admitted = true;
      ws.serializeAttachment(attachment);

      await this.state.storage.setAlarm(Date.now() + IDLE_EXPIRY_MS);

      ws.send(JSON.stringify({ type: 'join-ok', role: 'creator' }));
      return;
    }

    // Check joinToken matches
    if (hash !== roomState.joinTokenHash) {
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Wrong secret' }));
      ws.close(1008, 'Wrong secret');
      return;
    }

    // Check capacity
    if (roomState.admitted.length >= roomState.maxPeers) {
      ws.send(JSON.stringify({ type: 'join-denied', reason: 'Room full' }));
      ws.close(1008, 'Room full');
      return;
    }

    // Admit
    roomState.admitted.push(attachment.peerId);
    await this.state.storage.put('state', roomState);

    attachment.admitted = true;
    ws.serializeAttachment(attachment);

    ws.send(JSON.stringify({ type: 'join-ok', role: 'joiner' }));

    // Notify other peer
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

    const sockets = this.state.getWebSockets();
    const targetPeerId = envelope.to;

    for (const sock of sockets) {
      if (sock === ws) continue;

      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (!otherAttachment?.admitted) continue;

      // Send to specific peer or broadcast to all admitted
      if (!targetPeerId || otherAttachment.peerId === targetPeerId) {
        sock.send(JSON.stringify(envelope));
        if (targetPeerId) break;
      }
    }
  }

  private async broadcastToAdmitted(ws: WebSocket, frame: any, attachment: SocketAttachment): Promise<void> {
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      if (sock === ws) continue;
      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (otherAttachment?.admitted) {
        sock.send(JSON.stringify(frame));
      }
    }
  }

  private checkRateLimit(attachment: SocketAttachment): boolean {
    const now = Date.now();
    const elapsed = (now - attachment.bucket.t) / 1000;
    const refill = Math.floor(elapsed * RATE_LIMIT_SUSTAINED);

    attachment.bucket.n = Math.min(RATE_LIMIT_BURST, attachment.bucket.n + refill);
    attachment.bucket.t = now;

    if (attachment.bucket.n < 1) {
      return false;
    }

    attachment.bucket.n -= 1;
    return true;
  }

  private async getRoomState(): Promise<RoomState | null> {
    return await this.state.storage.get<RoomState>('state') ?? null;
  }

  private async touchActivity(): Promise<void> {
    const roomState = await this.getRoomState();
    if (roomState) {
      roomState.lastActiveAt = Date.now();
      await this.state.storage.put('state', roomState);
    }
  }
}
