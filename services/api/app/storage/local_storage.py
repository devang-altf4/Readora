import os
import asyncio
from pathlib import Path
from app.storage.base import AbstractStorageService
from app.storage.path_safety import resolve_safe_path
from app.core.config import settings


class LocalStorageService(AbstractStorageService):

    def __init__(self, root_dir: str = settings.STORAGE_ROOT):
        self.root_dir = Path(root_dir).resolve()
        self.originals_dir = self.root_dir / "originals"
        self.covers_dir = self.root_dir / "covers"
        self.processed_dir = self.root_dir / "processed"
        self.temporary_dir = self.root_dir / "temporary"

        # Ensure directories exist
        for directory in [self.originals_dir, self.covers_dir, self.processed_dir, self.temporary_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    async def save_original(self, book_id: str, file_data: bytes, extension: str = ".pdf") -> str:
        relative_key = f"originals/{book_id}{extension}"
        target_path = resolve_safe_path(str(self.root_dir), relative_key)
        
        await asyncio.to_thread(target_path.write_bytes, file_data)
        return relative_key

    async def save_cover(self, book_id: str, image_bytes: bytes, extension: str = ".jpg") -> str:
        relative_key = f"covers/{book_id}{extension}"
        target_path = resolve_safe_path(str(self.root_dir), relative_key)
        
        await asyncio.to_thread(target_path.write_bytes, image_bytes)
        return relative_key

    async def save_processed_json(self, book_id: str, json_content: str) -> str:
        relative_key = f"processed/{book_id}.json"
        target_path = resolve_safe_path(str(self.root_dir), relative_key)
        
        await asyncio.to_thread(target_path.write_text, json_content, "utf-8")
        return relative_key

    async def save_processed_html(self, book_id: str, html_content: str) -> str:
        relative_key = f"processed/{book_id}.html"
        target_path = resolve_safe_path(str(self.root_dir), relative_key)
        
        await asyncio.to_thread(target_path.write_text, html_content, "utf-8")
        return relative_key

    async def get_file_bytes(self, relative_key: str) -> bytes:
        target_path = resolve_safe_path(str(self.root_dir), relative_key)
        if not target_path.exists():
            raise FileNotFoundError(f"File not found: {relative_key}")
        return await asyncio.to_thread(target_path.read_bytes)

    async def delete_file(self, relative_key: str) -> bool:
        try:
            target_path = resolve_safe_path(str(self.root_dir), relative_key)
            if target_path.exists():
                await asyncio.to_thread(target_path.unlink)
                return True
            return False
        except Exception:
            return False

    async def file_exists(self, relative_key: str) -> bool:
        try:
            target_path = resolve_safe_path(str(self.root_dir), relative_key)
            return target_path.exists()
        except Exception:
            return False


storage_service = LocalStorageService()
