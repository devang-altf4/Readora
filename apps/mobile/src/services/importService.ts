import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { LocalBook } from '../types';
import { BookSQLiteRepository } from '../database/repositories/bookRepository';
import { apiClient } from './apiClient';

export async function uploadBookForSmartReading(
  repo: BookSQLiteRepository,
  book: LocalBook
): Promise<LocalBook> {
  const formData = new FormData();
  formData.append('file', {
    uri: book.localFileUri,
    name: book.originalFileName,
    type: 'application/pdf',
  } as any);

  const response = await apiClient.post('/books/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });

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

  return {
    ...book,
    backendBookId: backendBook._id,
    backendProcessingStatus: status,
    backendProcessingProgress: progress,
    smartModeAvailable,
  };
}

export async function importPdfBook(repo: BookSQLiteRepository): Promise<LocalBook | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const file = result.assets[0];
  const bookId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const booksDir = new Directory(Paths.document, 'books/');
  
  // Ensure books directory exists
  if (!booksDir.exists) {
    booksDir.create();
  }

  const destinationFile = new File(booksDir, `${bookId}.pdf`);
  const sourceFile = new File(file.uri);
  sourceFile.copy(destinationFile);

  const now = new Date().toISOString();
  const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ').replace(/-/g, ' ');

  const newBook: LocalBook = {
    id: bookId,
    localFileUri: destinationFile.uri,
    originalFileName: file.name,
    title: cleanTitle,
    author: null,
    coverUri: null,
    fileSize: file.size || 0,
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
    // Wait for the upload ID before opening Smart Reader. Processing itself
    // remains asynchronous on the backend and is polled by the reader screen.
    return await uploadBookForSmartReading(repo, newBook);
  } catch (error) {
    // The local PDF is preserved and can still be opened in Original mode.
    console.warn('Smart Reader upload unavailable:', error);
    return newBook;
  }
}
