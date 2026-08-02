"""Password and bearer-token primitives used by the API.

Passwords are never stored directly. Sessions are opaque random bearer tokens;
only their SHA-256 digest is persisted in MongoDB, so a database read does not
reveal a usable login token.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return password_hasher.verify(encoded_hash, password)
    except (VerifyMismatchError, VerificationError):
        return False


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
