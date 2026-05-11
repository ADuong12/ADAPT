from __future__ import annotations

import requests

from ..config import settings
from .base import LLMResult

_BASE = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider:
    name = "openrouter"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        self.api_key = api_key
        self.model = model or settings.default_models["openrouter"]

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "ADAPT",
        }

    def generate(self, *, system: str, user: str, max_tokens: int = 4096) -> LLMResult:
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.4,
        }
        r = requests.post(_BASE, headers=self._headers(), json=body, timeout=120)
        r.raise_for_status()
        data = r.json()
        text = data["choices"][0]["message"]["content"]
        tokens = (data.get("usage") or {}).get("total_tokens")
        return LLMResult(text=text, model=self.model, provider=self.name, token_count=tokens, raw=data)

    def ping(self) -> tuple[bool, str | None]:
        try:
            self.generate(system="Reply with OK only.", user="ping", max_tokens=8)
            return True, None
        except Exception as e:  # noqa: BLE001
            return False, str(e)
