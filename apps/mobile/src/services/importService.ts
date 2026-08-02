import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { LocalBook } from '../types';
import { BookSQLiteRepository } from '../database/repositories/bookRepository';
import { apiClient, describeApiError } from './apiClient';
import { API_CONFIG } from '../constants/config';

const MAX_BOOK_SIZE_BYTES = 100 * 1024 * 1024;

const BOOK_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  kepub: 'application/epub+zip',
  mobi: 'application/x-mobipocket-ebook',
  azw: 'application/vnd.amazon.ebook',
  azw3: 'application/vnd.amazon.ebook',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const SUPPORTED_BOOK_FORMATS_TEXT = 'PDF, EPUB/KEPUB, MOBI, AZW/AZW3, HTML, TXT, or DOCX';

export function getBookExtension(filename: string): string {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith('.kepub.epub')) return 'epub';
  return normalized.split('.').pop() || '';
}

export function getBookMimeType(filename: string): string {
  return BOOK_MIME_TYPES[getBookExtension(filename)] || 'application/octet-stream';
}

export function isSupportedBookFile(filename: string): boolean {
  return Object.prototype.hasOwnProperty.call(BOOK_MIME_TYPES, getBookExtension(filename));
}

export async function uploadBookForSmartReading(
  repo: BookSQLiteRepository,
  book: LocalBook
): Promise<LocalBook> {
  const formData = new FormData();
  formData.append('file', {
    uri: book.localFileUri,
    name: book.originalFileName,
    type: getBookMimeType(book.originalFileName),
  } as any);

  // Let Axios/React Native add the multipart boundary. Setting the bare
  // content type here can make Android send a body the API cannot parse and
  // surface as a generic "Network Error" in Expo Go.
  let response;
  try {
    response = await apiClient.post('/books/upload', formData, {
      timeout: 120000,
    });
  } catch (error) {
    throw new Error(describeApiError(error));
  }

  const backendBook = response.data;
  if (!backendBook?._id) {
    throw new Error('The reader service returned an invalid upload response.');
  }

  const status = backendBook.processingStatus || 'uploaded';
  const progress = backendBook.processingProgress ?? 0;
  const smartModeAvailable = status === 'ready' || status === 'ocr_required';

  await repo.updateBackendStatus(
    book.id,
    backendBook._id,
    status,
    progress,
    smartModeAvailable
  );

  // Persist the backend cover URL when the selected format contains a cover.
  let coverUri: string | null = null;
  try {
    const coverUrl = `${API_CONFIG.baseUrl}/books/${backendBook._id}/cover`;
    // GET is supported by older API processes too; HEAD used to produce a
    // noisy 405 in Expo Go while the cover was still being generated.
    await apiClient.get(`/books/${backendBook._id}/cover`, {
      responseType: 'arraybuffer',
      timeout: 5000,
    });
    coverUri = coverUrl;
    await repo.updateCoverUri(book.id, coverUri);
  } catch {
    // Processing may still be running; the library refresh checks again later.
  }

  return {
    ...book,
    backendBookId: backendBook._id,
    backendProcessingStatus: status,
    backendProcessingProgress: progress,
    smartModeAvailable,
    coverUri,
  };
}

export async function importBook(repo: BookSQLiteRepository): Promise<LocalBook | null> {
  // Some Android providers report Kindle files as application/octet-stream,
  // so the picker must allow all files and we validate the extension ourselves.
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const selectedFile = result.assets[0];
  if (!isSupportedBookFile(selectedFile.name)) {
    throw new Error(`Unsupported format. Choose ${SUPPORTED_BOOK_FORMATS_TEXT}.`);
  }
  if ((selectedFile.size || 0) > MAX_BOOK_SIZE_BYTES) {
    throw new Error('This book exceeds the 100 MB import limit.');
  }

  const extension = getBookExtension(selectedFile.name);
  const bookId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const booksDir = new Directory(Paths.document, 'books/');
  if (!booksDir.exists) {
    booksDir.create();
  }

  const destinationFile = new File(booksDir, `${bookId}.${extension}`);
  const sourceFile = new File(selectedFile.uri);
  sourceFile.copy(destinationFile);

  const now = new Date().toISOString();
  const cleanTitle = selectedFile.name
    .replace(/\.kepub\.epub$/i, '')
    .replace(/\.(pdf|epub|kepub|mobi|azw3?|html?|txt|docx)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const newBook: LocalBook = {
    id: bookId,
    localFileUri: destinationFile.uri,
    originalFileName: selectedFile.name,
    title: cleanTitle || 'Untitled Book',
    author: null,
    coverUri: null,
    fileSize: selectedFile.size || 0,
    fileHash: null,
    totalPages: 1,
    currentPage: 1,
    readingProgress: 0,
    lastOpenedAt: now,
    importedAt: now,
    updatedAt: now,
    backendBookId: null,
    backendProcessingStatus: 'offline_only',
    backendProcessingProgress: 0,
    smartModeAvailable: false,
  };

  await repo.insertBook(newBook);

  try {
    return await uploadBookForSmartReading(repo, newBook);
  } catch (error) {
    if (extension === 'pdf') {
      // PDFs remain readable in Original mode when the backend is offline.
      console.warn('Smart Reader upload unavailable:', error);
      return newBook;
    }

    // Reflowable formats require backend extraction. Do not leave an unreadable
    // library entry behind when upload or format validation fails.
    await repo.deleteBook(newBook.id);
    if (destinationFile.exists) destinationFile.delete();
    throw error;
  }
}
