from app.core.config import settings
from app.services.ai.ollama_client import OllamaClient
from app.services.ai.openrouter_client import OpenRouterClient


class AIService:
    def __init__(self) -> None:
        self.ollama = OllamaClient()
        self.openrouter = OpenRouterClient()

    async def generate(self, prompt: str) -> str:
        if settings.ai_provider.lower() == "openrouter":
            return await self.openrouter.generate(prompt)

        try:
            return await self.ollama.generate(prompt)
        except Exception:
            return await self.openrouter.generate(prompt)


ai_service = AIService()
