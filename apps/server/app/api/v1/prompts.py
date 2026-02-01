"""AI Prompts API router - Prompt management endpoints."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession
from app.models.experiment import LearningTheme
from app.schemas.prompt import (
    PromptCreate,
    PromptListResponse,
    PromptTestRequest,
    PromptTestResponse,
    PromptUpdate,
    PromptVersionCreate,
    PromptVersionResponse,
    PromptWithVersions,
)
from app.services import prompt_service

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("", response_model=PromptListResponse)
async def list_prompts(
    db: DbSession,
    theme: LearningTheme | None = None,
) -> PromptListResponse:
    """Get all AI prompts.
    
    Args:
        theme: Optional filter by learning theme.
        
    Returns:
        List of prompts.
    """
    return await prompt_service.get_all_prompts(db, theme)


@router.get("/{prompt_id}", response_model=PromptWithVersions)
async def get_prompt(
    prompt_id: UUID,
    db: DbSession,
) -> PromptWithVersions:
    """Get a prompt with all versions.
    
    Args:
        prompt_id: Prompt UUID.
        
    Returns:
        Prompt with version history.
    """
    prompt = await prompt_service.get_prompt_by_id(db, prompt_id)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found",
        )
    return prompt


@router.post("", response_model=PromptWithVersions, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    create_data: PromptCreate,
    db: DbSession,
) -> PromptWithVersions:
    """Create a new prompt with initial version.
    
    Args:
        create_data: Prompt creation data.
        
    Returns:
        Created prompt.
    """
    return await prompt_service.create_prompt(db, create_data)


@router.patch("/{prompt_id}", response_model=PromptWithVersions)
async def update_prompt(
    prompt_id: UUID,
    update_data: PromptUpdate,
    db: DbSession,
) -> PromptWithVersions:
    """Update a prompt's metadata.
    
    Args:
        prompt_id: Prompt UUID.
        update_data: Update data.
        
    Returns:
        Updated prompt.
    """
    prompt = await prompt_service.update_prompt(db, prompt_id, update_data)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found",
        )
    return await prompt_service.get_prompt_by_id(db, prompt_id)


@router.post("/{prompt_id}/versions", response_model=PromptVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_version(
    prompt_id: UUID,
    create_data: PromptVersionCreate,
    db: DbSession,
) -> PromptVersionResponse:
    """Create a new version for a prompt.
    
    Args:
        prompt_id: Prompt UUID.
        create_data: Version creation data.
        
    Returns:
        Created version.
    """
    version = await prompt_service.create_prompt_version(db, prompt_id, create_data)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt not found",
        )
    return version


@router.post("/test", response_model=PromptTestResponse)
async def test_prompt(request: PromptTestRequest) -> PromptTestResponse:
    """Test a prompt with AI model.
    
    Args:
        request: Test request with prompt and message.
        
    Returns:
        AI response.
    """
    return await prompt_service.test_prompt(request)
