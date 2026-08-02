import { BackendBookResponse } from '../types';
import { apiClient, describeApiError } from './apiClient';

export async function listCatalogBooks(): Promise<BackendBookResponse[]> {
  try {
    const response = await apiClient.get('/catalog');
    return Array.isArray(response.data) ? response.data as BackendBookResponse[] : [];
  } catch (error) {
    throw new Error(describeApiError(error));
  }
}

export async function addCatalogBook(catalogId: string): Promise<BackendBookResponse> {
  try {
    const response = await apiClient.post(`/catalog/${encodeURIComponent(catalogId)}/add`);
    if (!response.data?._id) {
      throw new Error('The catalog service returned an invalid book response.');
    }
    return response.data as BackendBookResponse;
  } catch (error) {
    throw new Error(describeApiError(error));
  }
}
