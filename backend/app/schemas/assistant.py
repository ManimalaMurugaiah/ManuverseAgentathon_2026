from pydantic import BaseModel, Field


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    project_code: str | None = Field(default=None, min_length=1, max_length=64)


class AssistantChatResponse(BaseModel):
    reply: str
