import type { RoomState, WSMessage, Peer } from '@matinee/protocol';

// WebSocket readyState constants (Fix #3)
const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

export class RoomDO implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, Peer> = new Map();
  private lastActivityAt: number = Date.now();

  constructor(state: DurableObjectState) {
    this.state = state;
    // Restore hibernated WebSocket sessions
    this.state.getWebSockets().forEach(ws => {
      const peer = ws.deserializeAttachment() as Peer | null;
      if (peer) {
        this.sessions.set(ws, peer);
      }
    });
    
    // Set initial alarm for room expiry (FR-103)
    this.setRoomExpiryAlarm();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');
    
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const peerId = url.searchParams.get('peerId') ?? crypto.randomUUID();
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);
    
    const peer: Peer = {
      id: peerId,
      displayName: url.searchParams.get('name') ?? 'Watcher',
      joinedAt: Date.now(),
    };
    
    server.serializeAttachment(peer);
    this.sessions.set(server, peer);

    // Send existing peers to the new peer
    const existingPeers = Array.from(this.sessions.entries())
      .filter(([ws]) => ws !== server)
      .map(([, p]) => p);
    
    existingPeers.forEach(existingPeer => {
      const existingPeerMsg: WSMessage = {
        type: 'peer-joined',
        roomId: '',
        peerId: existingPeer.id,
        payload: { peer: existingPeer },
      };
      server.send(JSON.stringify(existingPeerMsg));
    });

    // Broadcast peer-joined to all existing sessions
    const peerJoinedMsg: WSMessage = {
      type: 'peer-joined',
      roomId: '', // Room ID not tracked in DO, client can infer
      peerId: peer.id,
      payload: { peer },
    };
    
    this.state.getWebSockets().forEach(other => {
      if (other !== server && other.readyState === WS_READY_STATE.OPEN) {
        other.send(JSON.stringify(peerJoinedMsg));
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const peer = ws.deserializeAttachment() as Peer;
    
    // Update activity timestamp and reschedule alarm (FR-103)
    this.lastActivityAt = Date.now();
    this.setRoomExpiryAlarm();
    
    try {
      const msg = JSON.parse(
        typeof message === 'string' ? message : new TextDecoder().decode(message)
      ) as WSMessage;
      
      // Message validation (Fix #8)
      if (!this.validateMessage(msg)) {
        console.error('RoomDO: invalid message schema', msg);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message schema',
        }));
        return;
      }
      
      // For key-exchange messages, relay without modification
      if (msg.type === 'key-exchange') {
        this.state.getWebSockets().forEach(other => {
          if (other !== ws && other.readyState === WS_READY_STATE.OPEN) {
            other.send(JSON.stringify({ ...msg, peerId: peer.id }));
          }
        });
        return;
      }
      
      // Broadcast to all other sessions
      this.state.getWebSockets().forEach(other => {
        if (other !== ws && other.readyState === WS_READY_STATE.OPEN) {
          other.send(JSON.stringify({ ...msg, peerId: peer.id }));
        }
      });
    } catch {
      // Ignore malformed messages
    }
  }

  webSocketClose(ws: WebSocket): void {
    const peer = ws.deserializeAttachment() as Peer | null;
    if (peer) {
      // Broadcast peer-left to remaining sessions
      const peerLeftMsg: WSMessage = {
        type: 'peer-left',
        roomId: '',
        peerId: peer.id,
        payload: { peerId: peer.id },
      };
      
      this.state.getWebSockets().forEach(other => {
        if (other !== ws && other.readyState === WS_READY_STATE.OPEN) {
          other.send(JSON.stringify(peerLeftMsg));
        }
      });
    }
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    const peer = ws.deserializeAttachment() as Peer | null;
    if (peer) {
      // Broadcast peer-left to remaining sessions
      const peerLeftMsg: WSMessage = {
        type: 'peer-left',
        roomId: '',
        peerId: peer.id,
        payload: { peerId: peer.id },
      };
      
      this.state.getWebSockets().forEach(other => {
        if (other !== ws && other.readyState === WS_READY_STATE.OPEN) {
          other.send(JSON.stringify(peerLeftMsg));
        }
      });
    }
    this.sessions.delete(ws);
  }

  getCurrentPeers(): Peer[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Validates WSMessage schema (Fix #8).
   * Prevents malformed messages from crashing clients.
   */
  private validateMessage(msg: unknown): msg is WSMessage {
    if (!msg || typeof msg !== 'object') return false;
    
    const m = msg as Record<string, unknown>;
    
    // Basic structure validation
    if (typeof m.type !== 'string') return false;
    if (typeof m.roomId !== 'string') return false;
    if (typeof m.peerId !== 'string') return false;
    
    // Type-specific validation
    if (m.type === 'key-exchange') {
      const payload = m.payload as Record<string, unknown>;
      if (!payload || typeof payload !== 'object') return false;
      if (typeof payload.peerId !== 'string') return false;
      if (!payload.publicKey || typeof payload.publicKey !== 'object') return false;
      
      // Validate JWK structure
      const jwk = payload.publicKey as Record<string, unknown>;
      if (typeof jwk.kty !== 'string') return false;
      if (typeof jwk.crv !== 'string') return false;
    }
    
    return true;
  }

  /**
   * Sets room expiry alarm for 30 minutes from last activity (FR-103).
   */
  private async setRoomExpiryAlarm(): Promise<void> {
    try {
      const thirtyMinutes = 30 * 60 * 1000;
      await this.state.storage.setAlarm(Date.now() + thirtyMinutes);
    } catch (error) {
      console.error('RoomDO: failed to set alarm', error);
    }
  }

  /**
   * Room expiry handler (FR-103).
   * Closes all sessions if no activity for 30 minutes.
   */
  async alarm(): Promise<void> {
    const thirtyMinutes = 30 * 60 * 1000;
    const timeSinceLastActivity = Date.now() - this.lastActivityAt;
    
    if (timeSinceLastActivity >= thirtyMinutes) {
      console.log('RoomDO: expiring room due to inactivity');
      
      // Close all WebSocket connections
      this.state.getWebSockets().forEach(ws => {
        try {
          ws.close(1000, 'Room expired due to inactivity');
        } catch (error) {
          console.error('RoomDO: error closing WebSocket', error);
        }
      });
      
      // Clear sessions
      this.sessions.clear();
    } else {
      // Reschedule alarm if activity occurred during the window
      await this.setRoomExpiryAlarm();
    }
  }
}
