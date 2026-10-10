import { create } from 'zustand';
import type { Track } from '@matinee/subtitle-core';

interface SubtitleStore {
  tracks: Track[];
  activeLang: string | null;
  generating: boolean;
  setTracks: (tracks: Track[]) => void;
  setActiveLang: (lang: string | null) => void;
  setGenerating: (generating: boolean) => void;
}

export const useSubtitleStore = create<SubtitleStore>((set) => ({
  tracks: [],
  activeLang: null,
  generating: false,
  setTracks: (tracks) => set({ tracks }),
  setActiveLang: (activeLang) => set({ activeLang }),
  setGenerating: (generating) => set({ generating }),
}));
