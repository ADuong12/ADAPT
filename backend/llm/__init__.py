from .base import LLMProvider, LLMResult
from .gemini import GeminiProvider
from .huggingface import HuggingFaceProvider
from .openrouter import OpenRouterProvider

PROVIDERS: dict[str, type[LLMProvider]] = {
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "huggingface": HuggingFaceProvider,
}


def make_provider(name: str, api_key: str, model: str | None = None) -> LLMProvider:
    cls = PROVIDERS.get(name.lower())
    if not cls:
        raise ValueError(f"unknown LLM provider: {name}")
    return cls(api_key=api_key, model=model)


__all__ = [
    "LLMProvider",
    "LLMResult",
    "GeminiProvider",
    "OpenRouterProvider",
    "HuggingFaceProvider",
    "PROVIDERS",
    "make_provider",
]
