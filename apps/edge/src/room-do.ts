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
      
      // Broadcast to all other sessions
      this.state.getWebSockets().forEach(other => {
        if (other !== ws && other.readyState === WebSocket.READY_STATE_OPEN) {
          other.send(JSON.stringify({ ...msg, peerId: peer.id }));
        }
      });
    } catch {
      // Ignore malformed messages
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.sessions.delete(ws);
  }
}
