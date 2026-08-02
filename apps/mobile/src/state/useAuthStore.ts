import { create } from 'zustand';
import {
  AuthSession,
  AuthUser,
  restoreAuthSession,
  signIn,
  signOut,
  signUp,
} from '../services/authService';

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    const session = await restoreAuthSession();
    set({ session, user: session?.user || null, hydrated: true });
  },
  register: async (username, password) => {
    const session = await signUp(username, password);
    set({ session, user: session.user, hydrated: true });
  },
  login: async (username, password) => {
    const session = await signIn(username, password);
    set({ session, user: session.user, hydrated: true });
  },
  logout: async () => {
    await signOut();
    set({ session: null, user: null, hydrated: true });
  },
}));
