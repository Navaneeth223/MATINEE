// WebSocket messages
export type WSMessageType = 'join' | 'leave' | 'sync' | 'chat' | 'ice' | 'signal' | 'ping' | 'pong' | 'peer-joined' | 'peer-left' | 'key-exchange';

export interface WSMessage {
  type: WSMessageType;
  roomId: string;
  peerId: string;
  payload?: unknown;
}

export interface PeerJoinedPayload {
  peer: Peer;
}

export interface PeerLeftPayload {
  peerId: string;
}

// Room state
export interface Peer {
  id: string;
  displayName: string;
  joinedAt: number;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended';

export interface PlaybackState {
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  rate: number;
}

export interface RoomState {
  roomId: string;
  peers: Peer[];
  playback: PlaybackState;
  hostPeerId: string | null;
}

// Sync protocol
export interface AnchorTime {
  wallClock: number;
  mediaTime: number;
}

export interface DriftReport {
  peerId: string;
  drift: number;
  timestamp: number;
}

export interface ScheduledCommand {
  command: 'play' | 'pause' | 'seek';
  executeAt: number;
  mediaTime?: number;
}

// E2EE
export interface KeyExchangeMessage {
  peerId: string;
  publicKey: JsonWebKey;
}

export interface EncryptedEnvelope {
  iv: string;
  ciphertext: string;
  tag?: string;
}
