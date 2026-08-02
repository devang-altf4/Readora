export interface LocalBook {
  id: string;
  localFileUri: string;
  originalFileName: string;
  title: string;
  author?: string | null;
  coverUri?: string | null;
  fileSize: number;
  fileHash?: string | null;
  totalPages: number;
  currentPage: number;
  readingProgress: number;
  lastOpenedAt?: string | null;
  importedAt: string;
  updatedAt: string;
  backendBookId?: string | null;
  backendProcessingStatus: 'offline_only' | 'uploaded' | 'validating' | 'processing' | 'ready' | 'ocr_required' | 'failed' | 'deleting';
  backendProcessingProgress: number;
  smartModeAvailable: boolean;
  cachedSmartContentUri?: string | null;
}

export interface LocalBookmark {
  id: string;
  bookId: string;
  pageNumber: number;
  smartPosition?: number | null;
  label?: string | null;
  createdAt: string;
}

export interface LocalReaderSettings {
  id: string;
  bookId?: string | null; // null for global settings
  theme: 'light' | 'sepia' | 'dark';
  fontFamily: 'Baskerville' | 'Bookerly' | 'Literata' | 'Bitter' | 'Georgia' | 'System';
  fontSize: number;
  lineHeight: number;
  horizontalMargin: number;
  readingMode: 'original_pdf' | 'smart_reading';
  updatedAt: string;
}

export interface BackendBookResponse {
  _id: string;
  userId?: string | null;
  catalogId?: string | null;
  isCatalog?: boolean;
  originalFilename: string;
  storedFilename: string;
  title?: string;
  author?: string;
  mimeType: string;
  fileSize: number;
  fileHash?: string;
  pageCount: number;
  textPageCount: number;
  documentType: string;
  processingStatus: string;
  processingProgress: number;
  processingStage: string;
  processingError?: {
    code: string;
    message: string;
    stage?: string;
  };
  storage: {
    originalFileKey?: string;
    originalPdfKey?: string;
    coverKey?: string;
    processedJsonKey?: string;
    processedHtmlKey?: string;
  };
  createdAt: string;
  updatedAt: string;
}
