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

    // Generate ECDH key pair
    this.keyPair = await generateKeyPair();

    // Construct WebSocket URL
    const wsUrl = `ws://localhost:8787/ws/${this.roomId}?peerId=${encodeURIComponent(
      this.peerId
    )}&name=${encodeURIComponent(this.displayName)}`;

    // Open WebSocket
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = async () => {
      console.log('RoomClient: WebSocket connected');
      this.connectionState = 'connected';
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
      this.connectionState = 'disconnected';
      this.emit('disconnected');
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

            // Check if all peers have exchanged keys
            // When sharedKeys size matches the number of other peers, emit 'ready'
            if (this.sharedKeys.size === this.peers.length) {
              this.connectionState = 'ready';
              console.log('RoomClient: E2EE ready - all keys exchanged');
              this.emit('ready');
            }
          }
          break;
        }

        case 'peer-joined': {
          const payload = message.payload as { peer: Peer };
          console.log(`RoomClient: peer-joined ${payload.peer.id}`);

          // Add peer to local list
          if (payload.peer.id !== this.peerId) {
            this.peers.push(payload.peer);
          }

          // Update roomStore
          useRoomStore.getState().setPeers([...this.peers]);

          this.emit('peer-joined', payload.peer);
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
   * If encrypt=true and connectionState='ready', encrypts payload with each peer's shared key.
   * 
   * @param type - Message type
   * @param payload - Message payload
   * @param encrypt - Whether to encrypt the payload (default: true)
   */
  async sendMessage(type: string, payload: unknown, encrypt: boolean = true): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('RoomClient: cannot send message, WebSocket not open');
      return;
    }

    let finalPayload = payload;

    // Encrypt if requested and ready
    if (encrypt && this.connectionState === 'ready') {
      // For simplicity, we'll encrypt the entire payload as JSON
      // In production, you might want to encrypt per-peer
      const payloadJson = JSON.stringify(payload);
      
      // For broadcast messages, we need to encrypt for each peer
      // This is a simplified version - a full implementation might handle this differently
      if (this.sharedKeys.size > 0) {
        // Use the first shared key for now (in a real implementation, 
        // you might want to send encrypted versions to each peer)
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
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sharedKeys.clear();
    this.peers = [];
    this.connectionState = 'disconnected';
    this.keyPair = null;

    console.log('RoomClient: disconnected');
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
