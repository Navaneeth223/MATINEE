import type { DurableObjectState, DurableObjectNamespace } from '@cloudflare/workers-types';

/**
 * RoomDO - Durable Object for 2-peer encrypted room coordination
 * Per SPEC-M2B.md §10.4: hibernation-safe, 2-peer cap, knock/admit flow, 12h expiry
 */

interface Env {
  ROOM_DO: DurableObjectNamespace;
}

interface RoomState {
  hostTokenHash: string | null;  // sha256(hostToken), set by first peer with createProof
  createdAt: number;
  lastActiveAt: number;
  locked: boolean;
  maxPeers: number;  // always 2 per §12.2
  admitted: string[];  // peerIds admitted by host
}

interface SocketAttachment {
  peerId: string;
  admitted: boolean;
  bucket: {
    t: number;  // last refill timestamp
    n: number;  // tokens remaining
  };
}

const IDLE_EXPIRY_MS = 12 * 60 * 60 * 1000;  // 12 hours per §8.3
const RATE_LIMIT_BURST = 40;
const RATE_LIMIT_SUSTAINED = 20;  // msgs/sec
const MAX_ENVELOPE_SIZE = 64 * 1024;  // 64 KiB

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

    // Extract peerId from query params
    const url = new URL(req.url);
    const peerId = url.searchParams.get('p');
    if (!peerId || peerId.length !== 16) {
      return new Response('Invalid peerId (must be 16 hex chars)', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket (hibernation-safe API)
    this.state.acceptWebSocket(server, [peerId]);

    // Initialize attachment
    const attachment: SocketAttachment = {
      peerId,
      admitted: false,
      bucket: {
        t: Date.now(),
        n: RATE_LIMIT_BURST,
      },
    };
    server.serializeAttachment(attachment);

    // Update last active time
    await this.touchActivity();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      // Parse attachment
      const attachment = ws.deserializeAttachment() as SocketAttachment;
      if (!attachment) {
        ws.close(1002, 'No attachment');
        return;
      }

      // Size check
      const size = typeof message === 'string' ? message.length : message.byteLength;
      if (size > MAX_ENVELOPE_SIZE) {
        ws.close(1009, 'Message too large');
        return;
      }

      // Rate limit check
      if (!this.checkRateLimit(attachment)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      ws.serializeAttachment(attachment);

      // Parse envelope
      let envelope: any;
      try {
        envelope = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
      } catch {
        ws.close(1003, 'Invalid JSON');
        return;
      }

      // Validate envelope structure (minimal - zod validation should happen in protocol package)
      if (!envelope.v || !envelope.t || !envelope.from || envelope.from !== attachment.peerId) {
        ws.close(1003, 'Invalid envelope');
        return;
      }

      // Route by message type
      await this.handleMessage(ws, envelope, attachment);

      // Touch activity on valid messages
      await this.touchActivity();
    } catch (err) {
      console.error('webSocketMessage error:', err);
      ws.close(1011, 'Internal error');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment;
    if (!attachment) return;

    // Remove from admitted list
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
          v: 1,
          t: 'bye',
          from: attachment.peerId,
          seq: 0,
          sid: '00000000',
        }));
      }
    }

    // Update activity
    await this.touchActivity();
  }

  async alarm(): Promise<void> {
    // Check if room has expired (12h idle)
    const roomState = await this.getRoomState();
    if (!roomState) return;

    const now = Date.now();
    const idleTime = now - roomState.lastActiveAt;

    if (idleTime >= IDLE_EXPIRY_MS) {
      // Close all sockets
      const sockets = this.state.getWebSockets();
      for (const sock of sockets) {
        sock.close(1000, 'Room expired');
      }

      // Delete storage
      await this.state.storage.deleteAll();
    } else {
      // Schedule next check
      const nextCheck = roomState.lastActiveAt + IDLE_EXPIRY_MS;
      await this.state.storage.setAlarm(nextCheck);
    }
  }

  private async handleMessage(ws: WebSocket, envelope: any, attachment: SocketAttachment): Promise<void> {
    const roomState = await this.getRoomState();

    switch (envelope.t) {
      case 'create':
        await this.handleCreate(ws, envelope, attachment);
        break;

      case 'knock':
        await this.handleKnock(ws, envelope, attachment, roomState);
        break;

      case 'admit':
        await this.handleAdmit(ws, envelope, attachment, roomState);
        break;

      case 'deny':
        await this.handleDeny(ws, envelope, attachment, roomState);
        break;

      case 'ping':
        // Respond with pong
        ws.send(JSON.stringify({
          v: 1,
          t: 'pong',
          from: 'server',
          to: attachment.peerId,
          seq: 0,
          sid: '00000000',
        }));
        break;

      default:
        // Relay to other admitted peers (or specific peer if `to` is set)
        if (!attachment.admitted) {
          // Unadmitted sockets receive nothing except deny/wait/full
          return;
        }
        await this.relayMessage(ws, envelope, attachment);
        break;
    }
  }

  private async handleCreate(ws: WebSocket, envelope: any, attachment: SocketAttachment): Promise<void> {
    let roomState = await this.getRoomState();

    // If room already has a host, reject
    if (roomState && roomState.hostTokenHash) {
      ws.send(JSON.stringify({
        v: 1,
        t: 'deny',
        from: 'server',
        to: attachment.peerId,
        seq: 0,
        sid: '00000000',
      }));
      return;
    }

    // Extract proof (should be sha256(hostToken))
    if (!envelope.proof || typeof envelope.proof !== 'string') {
      ws.close(1003, 'Missing createProof');
      return;
    }

    // Initialize room state
    roomState = {
      hostTokenHash: envelope.proof,  // Store the hash
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      locked: false,
      maxPeers: 2,
      admitted: [attachment.peerId],  // Host is auto-admitted
    };
    await this.state.storage.put('state', roomState);

    // Mark socket as admitted
    attachment.admitted = true;
    ws.serializeAttachment(attachment);

    // Schedule expiry alarm
    await this.state.storage.setAlarm(Date.now() + IDLE_EXPIRY_MS);

    // Acknowledge
    ws.send(JSON.stringify({
      v: 1,
      t: 'admit',
      from: 'server',
      to: attachment.peerId,
      seq: 0,
      sid: '00000000',
    }));
  }

  private async handleKnock(ws: WebSocket, envelope: any, attachment: SocketAttachment, roomState: RoomState | null): Promise<void> {
    if (!roomState) {
      ws.send(JSON.stringify({
        v: 1,
        t: 'deny',
        from: 'server',
        to: attachment.peerId,
        seq: 0,
        sid: '00000000',
      }));
      return;
    }

    // Check capacity
    if (roomState.admitted.length >= roomState.maxPeers) {
      ws.send(JSON.stringify({
        v: 1,
        t: 'full',
        from: 'server',
        to: attachment.peerId,
        seq: 0,
        sid: '00000000',
      }));
      return;
    }

    // Check if locked
    if (roomState.locked) {
      ws.send(JSON.stringify({
        v: 1,
        t: 'deny',
        from: 'server',
        to: attachment.peerId,
        seq: 0,
        sid: '00000000',
      }));
      return;
    }

    // Forward knock to host (first admitted peer)
    const hostPeerId = roomState.admitted[0];
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (otherAttachment?.peerId === hostPeerId && otherAttachment.admitted) {
        // Forward the knock envelope (includes name, etc.)
        sock.send(JSON.stringify(envelope));
        break;
      }
    }

    // Send wait to knocker
    ws.send(JSON.stringify({
      v: 1,
      t: 'wait',
      from: 'server',
      to: attachment.peerId,
      seq: 0,
      sid: '00000000',
    }));
  }

  private async handleAdmit(ws: WebSocket, envelope: any, attachment: SocketAttachment, roomState: RoomState | null): Promise<void> {
    if (!roomState || !attachment.admitted) return;

    // Only host can admit (first admitted peer)
    if (attachment.peerId !== roomState.admitted[0]) {
      return;
    }

    // Extract target peerId
    const targetPeerId = envelope.to;
    if (!targetPeerId) return;

    // Find target socket
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (otherAttachment?.peerId === targetPeerId && !otherAttachment.admitted) {
        // Admit the peer
        otherAttachment.admitted = true;
        sock.serializeAttachment(otherAttachment);

        // Update room state
        roomState.admitted.push(targetPeerId);
        await this.state.storage.put('state', roomState);

        // Notify admitted peer
        sock.send(JSON.stringify({
          v: 1,
          t: 'admit',
          from: 'server',
          to: targetPeerId,
          seq: 0,
          sid: '00000000',
        }));
        break;
      }
    }
  }

  private async handleDeny(ws: WebSocket, envelope: any, attachment: SocketAttachment, roomState: RoomState | null): Promise<void> {
    if (!roomState || !attachment.admitted) return;

    // Only host can deny
    if (attachment.peerId !== roomState.admitted[0]) {
      return;
    }

    // Extract target peerId
    const targetPeerId = envelope.to;
    if (!targetPeerId) return;

    // Find target socket and close it
    const sockets = this.state.getWebSockets();
    for (const sock of sockets) {
      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (otherAttachment?.peerId === targetPeerId && !otherAttachment.admitted) {
        sock.send(JSON.stringify({
          v: 1,
          t: 'deny',
          from: 'server',
          to: targetPeerId,
          seq: 0,
          sid: '00000000',
        }));
        sock.close(1000, 'Denied by host');
        break;
      }
    }
  }

  private async relayMessage(ws: WebSocket, envelope: any, attachment: SocketAttachment): Promise<void> {
    const sockets = this.state.getWebSockets();
    const targetPeerId = envelope.to;

    for (const sock of sockets) {
      if (sock === ws) continue;  // Don't send back to sender

      const otherAttachment = sock.deserializeAttachment() as SocketAttachment;
      if (!otherAttachment?.admitted) continue;

      // Send to specific peer or broadcast to all admitted
      if (!targetPeerId || otherAttachment.peerId === targetPeerId) {
        sock.send(JSON.stringify(envelope));
        if (targetPeerId) break;  // Unicast - stop after sending
      }
    }
  }

  private checkRateLimit(attachment: SocketAttachment): boolean {
    const now = Date.now();
    const elapsed = (now - attachment.bucket.t) / 1000;  // seconds
    const refill = Math.floor(elapsed * RATE_LIMIT_SUSTAINED);

    // Refill tokens
    attachment.bucket.n = Math.min(RATE_LIMIT_BURST, attachment.bucket.n + refill);
    attachment.bucket.t = now;

    // Check if we have tokens
    if (attachment.bucket.n < 1) {
      return false;
    }

    // Consume one token
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
