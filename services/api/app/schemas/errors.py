from pydantic import BaseModel
from typing import Optional

class ErrorDetail(BaseModel):
    code: str
    message: str
    stage: Optional[str] = None
    details: Optional[dict] = None
