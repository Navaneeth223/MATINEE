import type { WSMessage, Peer, KeyExchangeMessage } from '@matinee/protocol';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from './crypto';
import { useRoomStore } from '../stores/roomStore';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'ready';

type EventHandler = (...args: unknown[]) => void;

/**
 * RoomClient manages WebSocket connection, E2EE key exchange, and event emission.
 * Automatically performs E2EE key exchange on connection and emits 'ready' when encryption is established.
 * Implements exponential back-off reconnection (FR-104).
 */
export default class RoomClient {
  private roomId: string;
  private peerId: string;
  private displayName: string;
  private ws: WebSocket | null = null;
  private keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;
  private sharedKeys: Map<string, CryptoKey> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connectionState: ConnectionState = 'disconnected';
  private peers: Peer[] = [];
  private expectedPeerCount: number = 0;
  private initialPeerCountReceived: boolean = false;
  
  // Reconnection state (FR-104)
  private autoReconnect: boolean = true;
  private reconnectAttempts: number = 0;
  private reconnectStartTime: number | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect: boolean = false;

  constructor(roomId: string, peerId: string, displayName: string) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.displayName = displayName;
  }

  /**
   * Establishes WebSocket connection and initiates E2EE key exchange.
   * Generates ECDH key pair, opens WebSocket, and broadcasts public key on connection.
   */
  async connect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      console.warn('RoomClient: already connecting or connected');
      return;
    }

    this.connectionState = 'connecting';

    // Generate ECDH key pair (reuse if reconnecting with existing key)
    if (!this.keyPair) {
      this.keyPair = await generateKeyPair();
    }

    // Construct WebSocket URL (use relative path for deployment compatibility)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${this.roomId}?peerId=${encodeURIComponent(
      this.peerId
    )}&name=${encodeURIComponent(this.displayName)}`;

    // Open WebSocket
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      console.log('RoomClient: WebSocket connected');
      this.connectionState = 'connected';
      
      // Reset reconnection state on successful connection
      this.reconnectAttempts = 0;
      this.reconnectStartTime = null;
      
      this.emit('connected');

      // Broadcast public key for E2EE key exchange
      if (this.keyPair) {
        const publicKeyJwk = await exportPublicKey(this.keyPair.publicKey);
        const keyExchangeMessage: WSMessage = {
          type: 'key-exchange',
          roomId: this.roomId,
          peerId: this.peerId,
          payload: {
            peerId: this.peerId,
            publicKey: publicKeyJwk,
          } as KeyExchangeMessage,
        };
        this.ws?.send(JSON.stringify(keyExchangeMessage));
      }

      // Update roomStore with connection state
      useRoomStore.getState().setRoomId(this.roomId);
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (error) => {
      console.error('RoomClient: WebSocket error', error);
      this.emit('error', error);
    };

    this.ws.onclose = () => {
      console.log('RoomClient: WebSocket closed');
      const wasConnected = this.connectionState !== 'disconnected';
      this.connectionState = 'disconnected';
      this.emit('disconnected');
      
      // Attempt reconnection if not manually disconnected (FR-104)
      if (wasConnected && this.autoReconnect && !this.manualDisconnect) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handles incoming WebSocket messages.
   * Processes key-exchange, peer-joined, peer-left, and other message types.
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'key-exchange': {
          const payload = message.payload as KeyExchangeMessage;
          console.log(`RoomClient: received key-exchange from peer ${payload.peerId}`);

          if (payload.peerId === this.peerId) {
            // Ignore our own key exchange message
            break;
          }

          // Import peer's public key
          const peerPublicKey = await importPublicKey(payload.publicKey);

          // Derive shared secret
          if (this.keyPair) {
            const sharedKey = await deriveSharedSecret(
              this.keyPair.privateKey,
              peerPublicKey,
              this.roomId
            );
            this.sharedKeys.set(payload.peerId, sharedKey);

            console.log(
              `RoomClient: derived shared key with peer ${payload.peerId}. Total keys: ${this.sharedKeys.size}`
            );

            // Check ready state after key exchange
            this.checkReadyState();
          }
          break;
        }

        case 'peer-joined': {
          const payload = message.payload as { peer: Peer };
          console.log(`RoomClient: peer-joined ${payload.peer.id}`);

          // Add peer to local list
          if (payload.peer.id !== this.peerId) {
            this.peers.push(payload.peer);
            
            // Track expected peer count from initial batch (Fix #1: key exchange race)
            if (!this.initialPeerCountReceived) {
              this.expectedPeerCount++;
            }
            
            // Re-broadcast our public key to the new peer
            if (this.keyPair && this.connectionState !== 'disconnected') {
              (async () => {
                const publicKeyJwk = await exportPublicKey(this.keyPair!.publicKey);
                const keyExchangeMessage: WSMessage = {
                  type: 'key-exchange',
                  roomId: this.roomId,
                  peerId: this.peerId,
                  payload: {
                    peerId: this.peerId,
                    publicKey: publicKeyJwk,
                  } as KeyExchangeMessage,
                };
                this.ws?.send(JSON.stringify(keyExchangeMessage));
              })();
            }
          }

          // Update roomStore
          useRoomStore.getState().setPeers([...this.peers]);

          this.emit('peer-joined', payload.peer);
          
          // Mark initial peer count as received after first peer-joined
          // (subsequent peer-joined events are for new arrivals)
          if (!this.initialPeerCountReceived) {
            // Use setTimeout to ensure all initial peer-joined messages are processed
            setTimeout(() => {
              this.initialPeerCountReceived = true;
              this.checkReadyState();
            }, 50);
          }
          break;
        }

        case 'peer-left': {
          const payload = message.payload as { peerId: string };
          console.log(`RoomClient: peer-left ${payload.peerId}`);

          // Remove peer from local list
          this.peers = this.peers.filter((p) => p.id !== payload.peerId);

          // Remove shared key
          this.sharedKeys.delete(payload.peerId);

          // Update roomStore
          useRoomStore.getState().setPeers([...this.peers]);

          this.emit('peer-left', payload.peerId);
          break;
        }

        default: {
          // For other message types, decrypt if E2EE is ready and emit 'message' event
          this.emit('message', message);
          break;
        }
      }
    } catch (error) {
      console.error('RoomClient: error handling message', error);
    }
  }

  /**
   * Sends a message via WebSocket, with optional encryption.
   * 
   * NOTE: Multi-peer encryption deferred to M3. Current implementation only encrypts with first
   * shared key (works for 2-peer rooms via ECDH symmetry). For >2 peers, choose one approach:
   * 1. Per-peer encryption: add targetPeerId to protocol, route per-peer on server
   * 2. Hybrid encryption: generate session key, encrypt it per-peer, encrypt bulk data once
   * 3. Broadcast plaintext for non-sensitive data (presence/sync), per-peer for sensitive (chat)
   * 
   * @param type - Message type
   * @param payload - Message payload
   * @param encrypt - Whether to encrypt the payload (default: true, deferred to M3)
   */
  async sendMessage(type: string, payload: unknown, encrypt: boolean = true): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('RoomClient: cannot send message, WebSocket not open');
      return;
    }

    let finalPayload = payload;

    // TODO(M3): Implement multi-peer encryption before shipping encrypted production messages.
    // Encrypt if requested and ready (currently only works for 2-peer rooms)
    if (encrypt && this.connectionState === 'ready') {
      const payloadJson = JSON.stringify(payload);
      
      if (this.sharedKeys.size > 0) {
        // Encrypt with first shared key (2-peer room compatible)
        const firstKey = this.sharedKeys.values().next().value;
        const encrypted = await encryptMessage(firstKey, payloadJson);
        finalPayload = encrypted;
      }
    }

    const message: WSMessage = {
      type: type as any,
      roomId: this.roomId,
      peerId: this.peerId,
      payload: finalPayload,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Subscribes to an event.
   * 
   * @param event - Event name ('connected', 'peer-joined', 'peer-left', 'message', 'ready', 'disconnected', 'error')
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }

    const handlers = this.eventHandlers.get(event)!;
    handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Emits an event to all subscribed handlers.
   */
  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`RoomClient: error in ${event} handler`, error);
        }
      });
    }
  }

  /**
   * Closes WebSocket connection and clears state.
   * @param manual - If true, prevents automatic reconnection
   */
  disconnect(manual: boolean = true): void {
    this.manualDisconnect = manual;
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sharedKeys.clear();
    this.peers = [];
    this.expectedPeerCount = 0;
    this.initialPeerCountReceived = false;
    this.connectionState = 'disconnected';
    this.keyPair = null;

    console.log('RoomClient: disconnected');
  }

  /**
   * Schedules reconnection attempt with exponential back-off (FR-104).
   * Retry delays: 1s, 2s, 4s, 8s, capped at 30s. Give up after 5 minutes.
   */
  private scheduleReconnect(): void {
    // Initialize reconnection timer if not already started
    if (this.reconnectStartTime === null) {
      this.reconnectStartTime = Date.now();
    }
    
    // Give up after 5 minutes
    const elapsed = Date.now() - this.reconnectStartTime;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (elapsed > fiveMinutes) {
      console.log('RoomClient: giving up reconnection after 5 minutes');
      this.reconnectStartTime = null;
      this.reconnectAttempts = 0;
      return;
    }
    
    // Calculate delay with exponential back-off, capped at 30s
    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30000);
    
    console.log(`RoomClient: scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`RoomClient: attempting reconnect (attempt ${this.reconnectAttempts})`);
      this.connect().catch(error => {
        console.error('RoomClient: reconnect failed', error);
      });
    }, delay);
  }

  /**
   * Checks if E2EE ready state should be signaled.
   * Ready = all expected peer keys have been exchanged.
   */
  private checkReadyState(): void {
    // Only check ready state after initial peer count is established
    if (!this.initialPeerCountReceived) {
      return;
    }
    
    // Ready when we have shared keys with all expected peers
    if (this.sharedKeys.size === this.expectedPeerCount && this.connectionState === 'connected') {
      this.connectionState = 'ready';
      console.log('RoomClient: E2EE ready - all keys exchanged');
      this.emit('ready');
    }
  }

  /**
   * Gets current connection state.
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Gets list of connected peers.
   */
  getPeers(): Peer[] {
    return [...this.peers];
  }
}
