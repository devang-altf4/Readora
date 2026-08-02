import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getApiBaseUrl = (): string => {
  // Dynamically resolve IP host from Expo Metro bundle connection
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (host) {
      return `http://${host}:8000/api/v1`;
    }
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
