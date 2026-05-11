from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from .config import ROOT, settings

_KEY_FILE = ROOT / ".secret_key"


def _load_or_generate_key() -> bytes:
    if settings.secret_key:
        return settings.secret_key.encode()
    if _KEY_FILE.exists():
        return _KEY_FILE.read_bytes().strip()
    # First run: generate a key and persist it. The .env can override later.
    key = Fernet.generate_key()
    _KEY_FILE.write_bytes(key)
    try:
        os.chmod(_KEY_FILE, 0o600)
    except OSError:
        pass
    return key


_fernet = Fernet(_load_or_generate_key())


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("stored API key is unreadable; please re-enter it") from e


def redact(plaintext: str) -> str:
    if not plaintext:
        return ""
    if len(plaintext) <= 6:
        return "•" * len(plaintext)
    return f"{plaintext[:3]}…{plaintext[-4:]}"
