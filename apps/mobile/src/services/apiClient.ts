import axios from 'axios';
import { API_CONFIG } from '../constants/config';

export const apiClient = axios.create({
  timeout: API_CONFIG.timeoutMs,
  headers: {
    'Accept': 'application/json',
  }
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = API_CONFIG.baseUrl;
  return config;
});
