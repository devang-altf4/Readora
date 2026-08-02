import { Platform } from 'react-native';
import Constants from 'expo-constants';

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const getExpoHost = (hostUri?: string): string | null => {
  if (!hostUri) return null;

  const withoutScheme = hostUri.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostWithPort = withoutScheme.split('/')[0];
  const host = hostWithPort.startsWith('[')
    ? hostWithPort.slice(1, hostWithPort.indexOf(']'))
    : hostWithPort.split(':')[0];

  return host || null;
};

export const getApiBaseUrl = (): string => {
  const environmentUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (environmentUrl) {
    return normalizeBaseUrl(environmentUrl);
  }

  // A configured LAN URL wins over Expo's host detection because VPN adapters
  // can cause Metro to advertise an address the physical phone cannot reach.
  const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return normalizeBaseUrl(configuredUrl.trim());
  }

  // Dynamically resolve the host from the Expo Metro bundle connection.
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const host = getExpoHost(debuggerHost);
  if (host) {
    return `http://${host}:8000/api/v1`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://localhost:8000/api/v1';
};

export const DEFAULT_API_BASE_URL = getApiBaseUrl();

export const API_CONFIG = {
  get baseUrl() {
    return getApiBaseUrl();
  },
  timeoutMs: 30000,
};
