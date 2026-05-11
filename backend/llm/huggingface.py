from __future__ import annotations

import requests

from ..config import settings
from .base import LLMResult

_BASE = "https://api-inference.huggingface.co/models"


class HuggingFaceProvider:
    name = "huggingface"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        self.api_key = api_key
        self.model = model or settings.default_models["huggingface"]

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def generate(self, *, system: str, user: str, max_tokens: int = 4096) -> LLMResult:
        prompt = f"<|system|>\n{system}\n<|user|>\n{user}\n<|assistant|>\n"
        body = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_tokens,
                "temperature": 0.4,
                "return_full_text": False,
            },
        }
        r = requests.post(f"{_BASE}/{self.model}", headers=self._headers(), json=body, timeout=180)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and data and "generated_text" in data[0]:
            text = data[0]["generated_text"]
        else:
            text = str(data)
        return LLMResult(text=text.strip(), model=self.model, provider=self.name, raw=data if isinstance(data, dict) else None)

    def ping(self) -> tuple[bool, str | None]:
        try:
            self.generate(system="Reply with OK only.", user="ping", max_tokens=8)
            return True, None
        except Exception as e:  # noqa: BLE001
            return False, str(e)
