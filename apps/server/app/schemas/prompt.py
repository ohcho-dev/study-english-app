"""AI Prompt schemas - Pydantic."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.experiment import LearningTheme


# -------------------
# Prompt Version Schemas
# -------------------


class PromptVersionBase(BaseModel):
    """Base prompt version schema."""
    
    system_prompt: str = Field(..., description="시스템 프롬프트 내용")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Temperature (0-2)")
    model: str = Field(default="gemini-1.5-flash", description="AI 모델명")
    max_tokens: int = Field(default=1000, ge=1, le=8000, description="최대 토큰 수")
    eval_weights: dict[str, float] | None = Field(default=None, description="평가 기준 가중치")


class PromptVersionCreate(PromptVersionBase):
    """Prompt version creation schema."""
    
    pass


class PromptVersionResponse(PromptVersionBase):
    """Prompt version response schema."""
    
    id: UUID
    prompt_id: UUID
    version: int
    created_by: UUID | None = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# -------------------
# Prompt Schemas
# -------------------


class PromptBase(BaseModel):
    """Base prompt schema."""
    
    name: str = Field(..., max_length=100, description="프롬프트 이름")
    target_theme: LearningTheme = Field(..., description="적용 학습 테마")


class PromptCreate(PromptBase):
    """Prompt creation schema."""
    
    system_prompt: str = Field(..., description="초기 시스템 프롬프트")
    temperature: float = Field(default=0.7)
    model: str = Field(default="gemini-1.5-flash")
    max_tokens: int = Field(default=1000)


class PromptUpdate(BaseModel):
    """Prompt update schema."""
    
    name: str | None = None
    is_active: bool | None = None


class PromptResponse(PromptBase):
    """Prompt response schema."""
    
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    current_version: int | None = None
    
    class Config:
        from_attributes = True


class PromptWithVersions(PromptResponse):
    """Prompt with versions response."""
    
    versions: list[PromptVersionResponse] = []


class PromptListResponse(BaseModel):
    """Prompt list response schema."""
    
    items: list[PromptResponse]
    total: int


# -------------------
# Prompt Test Schemas
# -------------------


class PromptTestRequest(BaseModel):
    """Prompt test request schema."""
    
    system_prompt: str = Field(..., description="테스트할 시스템 프롬프트")
    user_message: str = Field(..., description="사용자 테스트 메시지")
    temperature: float = Field(default=0.7, ge=0, le=2)
    model: str = Field(default="gemini-1.5-flash")
    max_tokens: int = Field(default=1000, ge=1, le=8000)


class PromptTestResponse(BaseModel):
    """Prompt test response schema."""
    
    response: str = Field(description="AI 응답")
    model: str = Field(description="사용된 모델")
    usage: dict[str, int] | None = Field(default=None, description="토큰 사용량")
