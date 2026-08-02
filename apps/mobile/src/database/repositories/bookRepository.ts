import * as SQLite from 'expo-sqlite';
import { LocalBook, LocalBookmark, LocalReaderSettings } from '../../types';

export class BookSQLiteRepository {
  constructor(private db: SQLite.SQLiteDatabase) {}

  async getAllBooks(sortBy: string = 'lastOpenedAt', sortDir: string = 'DESC'): Promise<LocalBook[]> {
    let orderClause = 'ORDER BY importedAt DESC';
    if (sortBy === 'title') {
      orderClause = `ORDER BY title ${sortDir}`;
    } else if (sortBy === 'lastOpenedAt') {
      orderClause = `ORDER BY COALESCE(lastOpenedAt, importedAt) ${sortDir}`;
    } else if (sortBy === 'readingProgress') {
      orderClause = `ORDER BY readingProgress ${sortDir}`;
    }

    const rows = await this.db.getAllAsync<any>(`SELECT * FROM books ${orderClause}`);
    return rows.map(r => ({
      ...r,
      smartModeAvailable: Boolean(r.smartModeAvailable)
    }));
  }

  async getBookById(id: string): Promise<LocalBook | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM books WHERE id = ?', [id]);
    if (!row) return null;
    return {
      ...row,
      smartModeAvailable: Boolean(row.smartModeAvailable)
    };
  }

  async insertBook(book: LocalBook): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO books (
        id, localFileUri, originalFileName, title, author, coverUri, fileSize, fileHash,
        totalPages, currentPage, readingProgress, lastOpenedAt, importedAt, updatedAt,
        backendBookId, backendProcessingStatus, backendProcessingProgress, smartModeAvailable, cachedSmartContentUri
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        book.localFileUri,
        book.originalFileName,
        book.title,
        book.author || null,
        book.coverUri || null,
        book.fileSize,
        book.fileHash || null,
        book.totalPages || 0,
        book.currentPage || 1,
        book.readingProgress || 0.0,
        book.lastOpenedAt || null,
        book.importedAt,
        book.updatedAt,
        book.backendBookId || null,
        book.backendProcessingStatus || 'offline_only',
        book.backendProcessingProgress || 0,
        book.smartModeAvailable ? 1 : 0,
        book.cachedSmartContentUri || null
      ]
    );
  }

  async updateReadingProgress(id: string, currentPage: number, totalPages: number, progress: number): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE books SET currentPage = ?, totalPages = ?, readingProgress = ?, lastOpenedAt = ?, updatedAt = ? WHERE id = ?`,
      [currentPage, totalPages, progress, now, now, id]
    );
  }

  async updateBackendStatus(id: string, backendBookId: string, status: string, progress: number, smartAvailable: boolean): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE books SET backendBookId = ?, backendProcessingStatus = ?, backendProcessingProgress = ?, smartModeAvailable = ?, updatedAt = ? WHERE id = ?`,
      [backendBookId, status, progress, smartAvailable ? 1 : 0, now, id]
    );
  }

  async updateSmartContentCache(id: string, cachedSmartContentUri: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE books SET cachedSmartContentUri = ?, smartModeAvailable = 1, updatedAt = ? WHERE id = ?`,
      [cachedSmartContentUri, now, id]
    );
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM books WHERE id = ?', [id]);
  }

  async getBookmarks(bookId: string): Promise<LocalBookmark[]> {
    return await this.db.getAllAsync<LocalBookmark>(
      'SELECT * FROM bookmarks WHERE bookId = ? ORDER BY pageNumber ASC',
      [bookId]
    );
  }

  async addBookmark(bookmark: LocalBookmark): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO bookmarks (id, bookId, pageNumber, smartPosition, label, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [bookmark.id, bookmark.bookId, bookmark.pageNumber, bookmark.smartPosition || null, bookmark.label || null, bookmark.createdAt]
    );
  }

  async removeBookmark(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM bookmarks WHERE id = ?', [id]);
  }

  async getReaderSettings(): Promise<LocalReaderSettings | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM reader_settings WHERE id = ?', ['global']);
    if (!row) return null;
    return row as LocalReaderSettings;
  }

  async saveReaderSettings(settings: Partial<LocalReaderSettings>): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getReaderSettings();
    if (existing) {
      await this.db.runAsync(
        `UPDATE reader_settings SET
          theme = COALESCE(?, theme),
          fontFamily = COALESCE(?, fontFamily),
          fontSize = COALESCE(?, fontSize),
          lineHeight = COALESCE(?, lineHeight),
          horizontalMargin = COALESCE(?, horizontalMargin),
          readingMode = COALESCE(?, readingMode),
          updatedAt = ?
        WHERE id = ?`,
        [
          settings.theme ?? null,
          settings.fontFamily ?? null,
          settings.fontSize ?? null,
          settings.lineHeight ?? null,
          settings.horizontalMargin ?? null,
          settings.readingMode ?? null,
          now,
          'global'
        ]
      );
    } else {
      await this.db.runAsync(
        `INSERT INTO reader_settings (
          id, theme, fontFamily, fontSize, lineHeight, horizontalMargin, readingMode, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'global',
          settings.theme ?? 'dark',
          settings.fontFamily ?? 'Baskerville',
          settings.fontSize ?? 16,
          settings.lineHeight ?? 1.45,
          settings.horizontalMargin ?? 28,
          settings.readingMode ?? 'smart_reading',
          now
        ]
      );
    }
  }
}
