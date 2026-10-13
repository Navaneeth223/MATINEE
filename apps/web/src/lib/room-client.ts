import { Session, deriveRoomKeys, newPeerId, type Envelope } from '@matinee/protocol';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type EventHandler = (...args: unknown[]) => void;

/**
 * RoomClient - WebSocket client with Session.seal/open for E2EE
 * Every message is encrypted with Session (except join/ping control frames)
 */
export class RoomClient {
  private ws: WebSocket | null = null;
  private session: Session | null = null;
  private peerId: string;
  private state: ConnectionState = 'disconnected';
  private handlers = new Map<string, EventHandler[]>();

  constructor(
    private roomId: string,
    private wsUrl: string,
  ) {
    this.peerId = newPeerId();
  }

  async connect(roomSecret: Uint8Array): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error('Already connected or connecting');
    }

    this.state = 'connecting';

    // Derive keys
    const { kEnc, joinToken } = await deriveRoomKeys(roomSecret, this.roomId);
    this.session = new Session(kEnc, this.peerId);

    // Connect WebSocket
    const url = `${this.wsUrl}/ws/${this.roomId}?p=${this.peerId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Send join (plaintext control frame)
      this.ws!.send(JSON.stringify({ type: 'join', joinToken }));
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Control frames (plaintext)
        if (data.type === 'join-ok') {
          this.state = 'connected';
          this.emit('connected', { role: data.role });
          return;
        }

        if (data.type === 'join-denied') {
          this.emit('error', new Error(`Join denied: ${data.reason}`));
          this.disconnect();
          return;
        }

        if (data.type === 'presence') {
          this.emit('presence', data);
          return;
        }

        if (data.type === 'pong') {
          this.emit('pong', data);
          return;
        }

        // Encrypted envelope
        if (data.v === 1 && this.session) {
          const opened = await this.session.open(data as Envelope);
          this.emit(opened.t, opened);
        }
      } catch (err) {
        console.error('Failed to process message:', err);
      }
    };

    this.ws.onerror = (err) => {
      this.emit('error', err);
    };

    this.ws.onclose = () => {
      this.state = 'disconnected';
      this.emit('disconnected', {});
    };
  }

  async send(type: string, payload: unknown, to?: string): Promise<void> {
    if (!this.session || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    const envelope = await this.session.seal(type, payload, to);
    this.ws.send(JSON.stringify(envelope));
  }

  ping(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.session = null;
    this.state = 'disconnected';
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((h) => h(data));
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  getPeerId(): string {
    return this.peerId;
  }
}
