import * as DocumentPicker from 'expo-document-picker';
import { Paths, File, Directory } from 'expo-file-system';
import { LocalBook } from '../types';
import { BookSQLiteRepository } from '../database/repositories/bookRepository';
import { apiClient } from './apiClient';

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

  // Background auto-trigger processing with backend
  (async () => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: destinationFile.uri,
        name: file.name,
        type: 'application/pdf',
      } as any);

      const res = await apiClient.post('/books/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10000,
      });

      const backendData = res.data;
      if (backendData && backendData._id) {
        await repo.updateBackendStatus(
          bookId,
          backendData._id,
          backendData.processingStatus || 'uploaded',
          backendData.processingProgress || 10,
          backendData.processingStatus === 'ready'
        );
      }
    } catch (e) {
      // Backend not running or offline, book remains available for offline PDF reading
      console.log('Background smart mode processing auto-trigger skipped (offline).');
    }
  })();

  return newBook;
}
