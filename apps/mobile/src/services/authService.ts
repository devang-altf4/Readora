import * as SecureStore from 'expo-secure-store';
import { apiClient, describeApiError, hasApiAuthToken, setApiAuthToken } from './apiClient';

const AUTH_SESSION_KEY = 'readora.auth.session.v1';

export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: AuthUser;
}

function normalizeSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== 'object') return null;
  const session = value as Partial<AuthSession>;
  if (!session.accessToken || !session.expiresAt || !session.user?.id) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return {
    accessToken: session.accessToken,
    tokenType: session.tokenType || 'bearer',
    expiresAt: session.expiresAt,
    user: session.user,
  };
}

async function persistSession(session: AuthSession): Promise<AuthSession> {
  setApiAuthToken(session.accessToken);
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function restoreAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
    const session = raw ? normalizeSession(JSON.parse(raw)) : null;
    if (!session) {
      setApiAuthToken(null);
      if (raw) await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
      return null;
    }
    setApiAuthToken(session.accessToken);
    return session;
  } catch {
    setApiAuthToken(null);
    return null;
  }
}

export async function signUp(username: string, password: string): Promise<AuthSession> {
  try {
    const response = await apiClient.post('/auth/signup', { username, password });
    return persistSession(response.data as AuthSession);
  } catch (error) {
    throw new Error(describeApiError(error));
  }
}

export async function signIn(username: string, password: string): Promise<AuthSession> {
  try {
    const response = await apiClient.post('/auth/login', { username, password });
    return persistSession(response.data as AuthSession);
  } catch (error) {
    throw new Error(describeApiError(error));
  }
}

export async function signOut(): Promise<void> {
  try {
    if (hasApiAuthToken()) {
      await apiClient.post('/auth/logout');
    }
  } catch {
    // A server/network failure must not trap the user in the local session.
  } finally {
    setApiAuthToken(null);
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
  }
}
