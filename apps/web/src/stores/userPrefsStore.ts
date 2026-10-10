import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPrefsStore {
  displayName: string;
  lang: 'en' | 'th' | 'ml';
  theme: 'dark' | 'light';
  setDisplayName: (name: string) => void;
  setLang: (lang: 'en' | 'th' | 'ml') => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUserPrefsStore = create<UserPrefsStore>()(
  persist(
    (set) => ({
      displayName: 'Watcher',
      lang: 'en',
      theme: 'dark',
      setDisplayName: (displayName) => set({ displayName }),
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'matinee-user-prefs',
    }
  )
);
