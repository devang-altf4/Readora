import { create } from 'zustand';

export type AppThemeMode = 'system' | 'dark' | 'light';

interface ThemeState {
  themeMode: AppThemeMode;
  setThemeMode: (mode: AppThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeMode: 'dark', // Default to Dark Mode as requested by user
  setThemeMode: (mode) => set({ themeMode: mode }),
}));
