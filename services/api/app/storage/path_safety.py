import os
from pathlib import Path

def resolve_safe_path(base_dir: str, relative_path: str) -> Path:
    """
    Safely resolves relative_path within base_dir, preventing path traversal outside base_dir.
    """
    base = Path(base_dir).resolve()
    target = (base / relative_path).resolve()
    
    if not str(target).startswith(str(base)):
        raise ValueError(f"Path traversal detected: {relative_path} is outside {base_dir}")
        
    return target
