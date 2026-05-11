from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "keys.env", override=True)


class Settings:
    db_path: Path = ROOT / "adapt.db"
    chroma_path: Path = ROOT / "chroma_data"
    knowledge_bases_dir: Path = ROOT / "Knowledge Bases"
    sample_lessons_dir: Path = ROOT / "Sample Lessons"
    uploads_dir: Path = ROOT / "uploads"

    # 32-byte url-safe base64 Fernet key. Generated on first run if missing.
    secret_key: str = os.getenv("ADAPT_SECRET_KEY", "")

    # Optional fallback Gemini key for solo-teacher local installs.
    gemini_api_key_fallback: str = os.getenv("ADAPT_GEMINI_API_KEY", "")

    # Embeddings: a small, free, fast sentence-transformers model.
    embedding_model: str = os.getenv("ADAPT_EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # Default models per provider.
    default_models: dict[str, str] = {
        "gemini": "gemini-2.5-flash",
        "openrouter": "meta-llama/llama-3.1-8b-instruct:free",
        "huggingface": "meta-llama/Llama-3.1-8B-Instruct",
    }

    cors_origins: list[str] = ["*"]


settings = Settings()
settings.uploads_dir.mkdir(exist_ok=True)
settings.chroma_path.mkdir(exist_ok=True)
