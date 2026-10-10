import { create } from 'zustand';
import type { Peer, PlaybackState } from '@matinee/protocol';

interface RoomStore {
  roomId: string | null;
  peers: Peer[];
  playback: PlaybackState | null;
  hostPeerId: string | null;
  setRoomId: (roomId: string | null) => void;
  setPeers: (peers: Peer[]) => void;
  setPlayback: (playback: PlaybackState | null) => void;
  setHostPeerId: (hostPeerId: string | null) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  roomId: null,
  peers: [],
  playback: null,
  hostPeerId: null,
  setRoomId: (roomId) => set({ roomId }),
  setPeers: (peers) => set({ peers }),
  setPlayback: (playback) => set({ playback }),
  setHostPeerId: (hostPeerId) => set({ hostPeerId }),
}));
