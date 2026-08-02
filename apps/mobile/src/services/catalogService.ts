import { BackendBookResponse } from '../types';
import { apiClient, describeApiError } from './apiClient';

const CATALOG_TIMESTAMP = '1970-01-01T00:00:00.000Z';

function starterBook(
  catalogId: string,
  filename: string,
  title: string,
  author: string,
  mimeType: string,
): BackendBookResponse {
  return {
    _id: `catalog-${catalogId}`,
    userId: null,
    catalogId,
    isCatalog: true,
    originalFilename: filename,
    storedFilename: filename,
    title,
    author,
    mimeType,
    fileSize: 0,
    pageCount: 0,
    textPageCount: 0,
    documentType: 'text_based',
    processingStatus: 'ready',
    processingProgress: 100,
    processingStage: 'complete',
    storage: {},
    createdAt: CATALOG_TIMESTAMP,
    updatedAt: CATALOG_TIMESTAMP,
  };
}

export const STARTER_CATALOG_BOOKS: BackendBookResponse[] = [
  starterBook(
    'readora-ddia',
    'designing-data-intensive-applications.pdf',
    'Designing Data-Intensive Applications',
    'Martin Kleppmann',
    'application/pdf',
  ),
  starterBook(
    'readora-hamlet',
    'hamlet.azw3',
    'Hamlet',
    'William Shakespeare',
    'application/vnd.amazon.ebook',
  ),
  starterBook(
    'readora-sherlock',
    'the-adventures-of-sherlock-holmes.pdf',
    'The Adventures of Sherlock Holmes',
    'Arthur Conan Doyle',
    'application/pdf',
  ),
];

export function mergeCatalogBooks(available: BackendBookResponse[]): BackendBookResponse[] {
  const byCatalogId = new Map(
    available.filter((book) => book.catalogId).map((book) => [book.catalogId as string, book]),
  );
  const knownIds = new Set(STARTER_CATALOG_BOOKS.map((book) => book.catalogId));
  const seeded = STARTER_CATALOG_BOOKS.map((fallback) => byCatalogId.get(fallback.catalogId as string) || fallback);
  const extras = available.filter((book) => !book.catalogId || !knownIds.has(book.catalogId));
  return [...seeded, ...extras];
}

export async function listCatalogBooks(): Promise<BackendBookResponse[]> {
  try {
    const response = await apiClient.get('/catalog');
    return mergeCatalogBooks(Array.isArray(response.data) ? response.data as BackendBookResponse[] : []);
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
