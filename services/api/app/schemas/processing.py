from pydantic import BaseModel
from typing import List, Optional, Any

class ProcessedBlock(BaseModel):
    type: str  # heading, paragraph, page_break, image
    text: Optional[str] = None
    sourcePage: int
    level: Optional[int] = None

class ContentExtractionResult(BaseModel):
    bookId: str
    extractionVersion: int = 1
    title: str
    author: Optional[str] = None
    blocks: List[ProcessedBlock]
    pageCount: int
    characterCount: int
    wordCount: int
