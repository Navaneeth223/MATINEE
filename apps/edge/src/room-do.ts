import type { RoomState, WSMessage, Peer } from '@matinee/protocol';

export class RoomDO implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, Peer> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
    // Restore hibernated WebSocket sessions
    this.state.getWebSockets().forEach(ws => {
      const peer = ws.deserializeAttachment() as Peer | null;
      if (peer) {
        this.sessions.set(ws, peer);
      }
    });
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
      if (other !== server && other.readyState === 1) { // 1 = OPEN
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
    
    try {
      const msg = JSON.parse(
        typeof message === 'string' ? message : new TextDecoder().decode(message)
      ) as WSMessage;
      
      // For key-exchange messages, relay without modification
      if (msg.type === 'key-exchange') {
        this.state.getWebSockets().forEach(other => {
          if (other !== ws && other.readyState === 1) { // 1 = OPEN
            other.send(JSON.stringify({ ...msg, peerId: peer.id }));
          }
        });
        return;
      }
      
      // Broadcast to all other sessions
      this.state.getWebSockets().forEach(other => {
        if (other !== ws && other.readyState === 1) { // 1 = OPEN
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
        if (other !== ws && other.readyState === 1) { // 1 = OPEN
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
        if (other !== ws && other.readyState === 1) { // 1 = OPEN
          other.send(JSON.stringify(peerLeftMsg));
        }
      });
    }
    this.sessions.delete(ws);
  }

  getCurrentPeers(): Peer[] {
    return Array.from(this.sessions.values());
  }
}
