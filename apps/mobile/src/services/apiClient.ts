import axios from 'axios';
import { API_CONFIG } from '../constants/config';

let authToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

export function hasApiAuthToken(): boolean {
  return Boolean(authToken);
}

export const apiClient = axios.create({
  timeout: API_CONFIG.timeoutMs,
  headers: {
    'Accept': 'application/json',
  }
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = API_CONFIG.baseUrl;
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export function describeApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return `Cannot reach the Readora backend at ${API_CONFIG.baseUrl}. Make sure the API is running with --host 0.0.0.0 and the phone is on the same Wi-Fi.`;
    }

    const detail = (error.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    return `Backend request failed (${error.response.status}).`;
  }

  return error instanceof Error ? error.message : 'Could not connect to the Readora backend.';
}
