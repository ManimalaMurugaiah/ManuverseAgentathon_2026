import httpx

from app.core.config import settings
from app.services.ai.ollama_client import OllamaClient
from app.services.ai.openrouter_client import OpenRouterClient


class AIService:
    def __init__(self) -> None:
        self.ollama = OllamaClient()
        self.openrouter = OpenRouterClient()

    async def generate(self, prompt: str) -> str:
        if settings.ai_provider.lower() == "openrouter":
            if not settings.openrouter_api_key:
                raise RuntimeError("OpenRouter is selected but OPENROUTER_API_KEY is not configured.")
            return await self.openrouter.generate(prompt)

        try:
            return await self.ollama.generate(prompt)
        except httpx.HTTPError as exc:
            if not settings.openrouter_api_key:
                raise RuntimeError(
                    "Ollama is unavailable and OPENROUTER_API_KEY is not configured."
                ) from exc
            return await self.openrouter.generate(prompt)


ai_service = AIService()
