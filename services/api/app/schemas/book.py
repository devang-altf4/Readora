from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class StorageReferences(BaseModel):
    originalPdfKey: Optional[str] = None
    coverKey: Optional[str] = None
    processedJsonKey: Optional[str] = None
    processedHtmlKey: Optional[str] = None

class ExtractionStatistics(BaseModel):
    version: int = 1
    characterCount: int = 0
    wordCount: int = 0
    headingCount: int = 0
    imageCount: int = 0

class BookProcessingError(BaseModel):
    code: str
    message: str
    stage: Optional[str] = None

class BookResponse(BaseModel):
    id: str = Field(alias="_id")
    schemaVersion: int = 1

    originalFilename: str
    storedFilename: str

    title: Optional[str] = "Untitled Document"
    author: Optional[str] = None

    mimeType: str = "application/pdf"
    fileSize: int
    fileHash: Optional[str] = None

    pageCount: int = 0
    textPageCount: int = 0
    documentType: str = "text_based"

    processingStatus: str = "uploaded"  # uploaded, validating, processing, ready, ocr_required, failed, deleting
    processingProgress: int = 0
    processingStage: str = "awaiting_processing"
    processingError: Optional[BookProcessingError] = None

    storage: StorageReferences = StorageReferences()
    extraction: ExtractionStatistics = ExtractionStatistics()

    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(populate_by_name=True)

class BookCreateRequest(BaseModel):
    originalFilename: str
    fileSize: int
    fileHash: str
