import { Session, deriveRoomKeys, newPeerId, type Envelope } from '@matinee/protocol';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type EventHandler = (...args: unknown[]) => void;

const PING_INTERVAL_MS = 30_000;  // 30 seconds
const PONG_TIMEOUT_MS = 10_000;  // 10 seconds
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const MAX_FAILED_OPENS = 10;

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
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private failedOpens = 0;
  private roomSecret: Uint8Array | null = null;
  private roomId: string | null = null;

  constructor(
    roomId: string,
    peerId?: string,
  ) {
    this.peerId = peerId || newPeerId();
    this.roomId = roomId;
  }

  private deriveWsUrl(): string {
    // Use proxy when wsUrl is empty, otherwise use provided URL
    if (!this.roomId) {
      throw new Error('Missing roomId');
    }
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = loc.host;
    return `${protocol}//${host}/ws/${this.roomId}?p=${this.peerId}`;
  }

  async connect(roomSecret: Uint8Array): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error('Already connected or connecting');
    }

    this.roomSecret = roomSecret;
    this.state = 'connecting';

    await this.doConnect();
  }

  private async doConnect(): Promise<void> {
    if (!this.roomSecret || !this.roomId) {
      this.emit('error', new Error('Missing room credentials'));
      return;
    }

    try {
      // Derive keys and create NEW Session for each connection
      const { kEnc, joinToken } = await deriveRoomKeys(this.roomSecret, this.roomId);
      this.session = new Session(kEnc, this.peerId);
      this.failedOpens = 0;

      // Connect WebSocket
      const url = this.deriveWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Reset backoff on successful connection
        this.backoffMs = INITIAL_BACKOFF_MS;

        // Send join (plaintext control frame)
        this.ws!.send(JSON.stringify({ type: 'join', joinToken }));

        // Start ping/pong
        this.startPingPong();
      };

      this.ws.onmessage = async (event) => {
        this.resetPongTimeout();

        try {
          const data = JSON.parse(event.data);

          // Control frames (plaintext)
          if (data.type === 'join-ok') {
            this.state = 'connected';
            const peers = data.peers || [];
            this.emit('connected', { role: data.role, peers });
            
            // Emit partner-arrived for each existing peer
            for (const peerId of peers) {
              this.emit('partner-arrived', { peerId });
            }
            return;
          }

          if (data.type === 'join-denied') {
            this.emit('error', new Error(`Join denied: ${data.reason}`));
            this.ws?.close();
            return;
          }

          if (data.type === 'pong') {
            // Pong received, keep alive
            return;
          }

          if (data.type === 'presence') {
            // Translate to partner-arrived/partner-left
            if (data.status === 'joined') {
              this.emit('partner-arrived', { peerId: data.peerId });
            } else if (data.status === 'left') {
              this.emit('partner-left', { peerId: data.peerId });
            }
            return;
          }

          // Encrypted envelope - open with Session
          if (data.v === 1) {
            const envelope = data as Envelope;
            const payload = await this.session!.open(envelope);

            if (!payload) {
              // Failed to open (replay, wrong key, etc.)
              console.error('Session.open() failed for envelope:', envelope);
              this.failedOpens++;
              this.emit('decrypt-error', { envelope, error: 'Session.open returned null' });
              
              if (this.failedOpens >= MAX_FAILED_OPENS) {
                this.emit('error', new Error('Too many failed decryptions'));
                this.disconnect();
              }
              return;
            }

            console.log('Session.open() succeeded:', { type: envelope.t, payload });

            // Emit as 'msg:' + type
            this.emit(`msg:${envelope.t}`, { payload, envelope });
          }
        } catch (err) {
          console.error('RoomClient message error:', err);
          this.emit('decrypt-error', { error: String(err) });
        }
      };

      this.ws.onerror = () => {
        this.emit('error', new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        this.stopPingPong();

        if (this.state !== 'disconnected') {
          // Unexpected close - reconnect with backoff
          this.state = 'disconnected';
          this.emit('disconnected', {});
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      this.state = 'disconnected';
      this.emit('error', err);
    }
  }

  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        
        // Expect pong within timeout
        this.pongTimeout = setTimeout(() => {
          // No pong received - reconnect
          this.ws?.close();
        }, PONG_TIMEOUT_MS);
      }
    }, PING_INTERVAL_MS);
  }

  private stopPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private resetPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.doConnect();
    }, this.backoffMs);

    // Exponential backoff
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  async send(type: string, payload: unknown): Promise<void> {
    if (!this.session || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    const envelope = await this.session.seal(type, payload);
    this.ws.send(JSON.stringify(envelope));
  }

  disconnect(): void {
    this.state = 'disconnected';
    this.stopPingPong();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.session = null;
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }
}
