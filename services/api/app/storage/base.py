from abc import ABC, abstractmethod
from typing import BinaryIO, Optional


class AbstractStorageService(ABC):

    @abstractmethod
    async def save_original(self, book_id: str, file_data: bytes, extension: str = ".pdf") -> str:
        """Saves original PDF file and returns relative storage key."""
        pass

    @abstractmethod
    async def save_cover(self, book_id: str, image_bytes: bytes, extension: str = ".jpg") -> str:
        """Saves cover image and returns relative storage key."""
        pass

    @abstractmethod
    async def save_processed_json(self, book_id: str, json_content: str) -> str:
        """Saves processed structured JSON content and returns relative storage key."""
        pass

    @abstractmethod
    async def save_processed_html(self, book_id: str, html_content: str) -> str:
        """Saves processed HTML content and returns relative storage key."""
        pass

    @abstractmethod
    async def get_file_bytes(self, relative_key: str) -> bytes:
        """Reads file bytes from storage key."""
        pass

    @abstractmethod
    async def delete_file(self, relative_key: str) -> bool:
        """Deletes file by storage key."""
        pass

    @abstractmethod
    async def file_exists(self, relative_key: str) -> bool:
        """Checks if file exists."""
        pass
