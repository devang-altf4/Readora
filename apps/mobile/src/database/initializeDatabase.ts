import * as SQLite from 'expo-sqlite';

export async function initializeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY NOT NULL,
      localFileUri TEXT NOT NULL,
      originalFileName TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      coverUri TEXT,
      fileSize INTEGER NOT NULL,
      fileHash TEXT,
      totalPages INTEGER DEFAULT 0,
      currentPage INTEGER DEFAULT 1,
      readingProgress REAL DEFAULT 0.0,
      lastOpenedAt TEXT,
      importedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      ownerUserId TEXT,
      backendBookId TEXT,
      backendProcessingStatus TEXT DEFAULT 'offline_only',
      backendProcessingProgress INTEGER DEFAULT 0,
      smartModeAvailable INTEGER DEFAULT 0,
      cachedSmartContentUri TEXT
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      bookId TEXT NOT NULL,
      pageNumber INTEGER NOT NULL,
      smartPosition REAL,
      label TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reader_settings (
      id TEXT PRIMARY KEY NOT NULL,
      bookId TEXT,
      theme TEXT DEFAULT 'dark',
      fontFamily TEXT DEFAULT 'Baskerville',
      fontSize INTEGER DEFAULT 16,
      lineHeight REAL DEFAULT 1.45,
      horizontalMargin INTEGER DEFAULT 28,
      readingMode TEXT DEFAULT 'original_pdf',
      updatedAt TEXT NOT NULL
    );
  `);

  // Add ownership to databases created before account support. Existing local
  // books are claimed by the first signed-in account on this device.
  const bookColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)');
  if (!bookColumns.some((column) => column.name === 'ownerUserId')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN ownerUserId TEXT');
  }
}
