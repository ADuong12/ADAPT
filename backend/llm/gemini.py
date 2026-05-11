from __future__ import annotations

import time

from ..config import settings
from .base import LLMResult


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        self.api_key = api_key
        self.model = model or settings.default_models["gemini"]

    def _client(self):
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        return genai.GenerativeModel(self.model)

    def generate(self, *, system: str, user: str, max_tokens: int = 4096) -> LLMResult:
        client = self._client()
        prompt = f"{system}\n\n{user}"
        resp = client.generate_content(
            prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.4},
        )
        text = (resp.text or "").strip()
        usage = getattr(resp, "usage_metadata", None)
        tokens = getattr(usage, "total_token_count", None) if usage else None
        return LLMResult(text=text, model=self.model, provider=self.name, token_count=tokens)

    def ping(self) -> tuple[bool, str | None]:
        try:
            t0 = time.time()
            self._client().generate_content(
                "Reply with the word OK only.",
                generation_config={"max_output_tokens": 8, "temperature": 0.0},
            )
            return True, None
        except Exception as e:  # noqa: BLE001
            return False, str(e)
