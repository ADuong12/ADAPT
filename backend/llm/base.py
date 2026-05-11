from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class LLMResult:
    text: str
    model: str
    provider: str
    token_count: int | None = None
    raw: dict | None = None


class LLMProvider(Protocol):
    name: str
    api_key: str
    model: str | None

    def __init__(self, api_key: str, model: str | None = None) -> None: ...

    def generate(self, *, system: str, user: str, max_tokens: int = 4096) -> LLMResult: ...

    def ping(self) -> tuple[bool, str | None]: ...
