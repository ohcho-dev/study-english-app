"""AI Prompt management service - Business logic."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_prompt import AIPrompt, AIPromptVersion
from app.models.experiment import LearningTheme
from app.schemas.prompt import (
    PromptCreate,
    PromptListResponse,
    PromptResponse,
    PromptTestRequest,
    PromptTestResponse,
    PromptUpdate,
    PromptVersionCreate,
    PromptVersionResponse,
    PromptWithVersions,
)


async def get_all_prompts(
    db: AsyncSession,
    theme: LearningTheme | None = None,
) -> PromptListResponse:
    """Get all AI prompts.
    
    Args:
        db: Database session.
        theme: Optional theme filter.
        
    Returns:
        List of prompts.
    """
    query = select(AIPrompt).order_by(AIPrompt.updated_at.desc())
    
    if theme:
        query = query.where(AIPrompt.target_theme == theme)
    
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    # Get current version for each prompt
    items = []
    for prompt in prompts:
        version_query = select(func.max(AIPromptVersion.version)).where(
            AIPromptVersion.prompt_id == prompt.id
        )
        version_result = await db.execute(version_query)
        current_version = version_result.scalar()
        
        items.append(
            PromptResponse(
                id=prompt.id,
                name=prompt.name,
                target_theme=prompt.target_theme,
                is_active=prompt.is_active,
                created_at=prompt.created_at,
                updated_at=prompt.updated_at,
                current_version=current_version,
            )
        )
    
    return PromptListResponse(items=items, total=len(items))


async def get_prompt_by_id(
    db: AsyncSession,
    prompt_id: UUID,
) -> PromptWithVersions | None:
    """Get a prompt with all versions.
    
    Args:
        db: Database session.
        prompt_id: Prompt UUID.
        
    Returns:
        Prompt with versions if found.
    """
    query = (
        select(AIPrompt)
        .options(selectinload(AIPrompt.versions))
        .where(AIPrompt.id == prompt_id)
    )
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        return None
    
    versions = [
        PromptVersionResponse(
            id=v.id,
            prompt_id=v.prompt_id,
            version=v.version,
            system_prompt=v.system_prompt,
            temperature=v.temperature,
            model=v.model,
            max_tokens=v.max_tokens,
            eval_weights=v.eval_weights,
            created_by=v.created_by,
            created_at=v.created_at,
        )
        for v in prompt.versions
    ]
    
    return PromptWithVersions(
        id=prompt.id,
        name=prompt.name,
        target_theme=prompt.target_theme,
        is_active=prompt.is_active,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
        current_version=versions[0].version if versions else None,
        versions=versions,
    )


async def create_prompt(
    db: AsyncSession,
    create_data: PromptCreate,
    created_by: UUID | None = None,
) -> PromptWithVersions:
    """Create a new prompt with initial version.
    
    Args:
        db: Database session.
        create_data: Prompt creation data.
        created_by: Creator user ID.
        
    Returns:
        Created prompt with version.
    """
    # Create prompt
    prompt = AIPrompt(
        name=create_data.name,
        target_theme=create_data.target_theme,
    )
    db.add(prompt)
    await db.flush()
    
    # Create initial version
    version = AIPromptVersion(
        prompt_id=prompt.id,
        version=1,
        system_prompt=create_data.system_prompt,
        temperature=create_data.temperature,
        model=create_data.model,
        max_tokens=create_data.max_tokens,
        created_by=created_by,
    )
    db.add(version)
    await db.commit()
    
    await db.refresh(prompt)
    return await get_prompt_by_id(db, prompt.id)


async def update_prompt(
    db: AsyncSession,
    prompt_id: UUID,
    update_data: PromptUpdate,
) -> AIPrompt | None:
    """Update a prompt.
    
    Args:
        db: Database session.
        prompt_id: Prompt UUID.
        update_data: Update payload.
        
    Returns:
        Updated prompt if found.
    """
    query = select(AIPrompt).where(AIPrompt.id == prompt_id)
    result = await db.execute(query)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        return None
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(prompt, key, value)
    
    await db.commit()
    await db.refresh(prompt)
    return prompt


async def create_prompt_version(
    db: AsyncSession,
    prompt_id: UUID,
    create_data: PromptVersionCreate,
    created_by: UUID | None = None,
) -> PromptVersionResponse | None:
    """Create a new version for a prompt.
    
    Args:
        db: Database session.
        prompt_id: Prompt UUID.
        create_data: Version creation data.
        created_by: Creator user ID.
        
    Returns:
        Created version if prompt exists.
    """
    # Check prompt exists
    prompt_query = select(AIPrompt).where(AIPrompt.id == prompt_id)
    prompt_result = await db.execute(prompt_query)
    prompt = prompt_result.scalar_one_or_none()
    
    if not prompt:
        return None
    
    # Get next version number
    version_query = select(func.max(AIPromptVersion.version)).where(
        AIPromptVersion.prompt_id == prompt_id
    )
    version_result = await db.execute(version_query)
    current_max = version_result.scalar() or 0
    
    # Create new version
    version = AIPromptVersion(
        prompt_id=prompt_id,
        version=current_max + 1,
        system_prompt=create_data.system_prompt,
        temperature=create_data.temperature,
        model=create_data.model,
        max_tokens=create_data.max_tokens,
        eval_weights=create_data.eval_weights,
        created_by=created_by,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    
    return PromptVersionResponse(
        id=version.id,
        prompt_id=version.prompt_id,
        version=version.version,
        system_prompt=version.system_prompt,
        temperature=version.temperature,
        model=version.model,
        max_tokens=version.max_tokens,
        eval_weights=version.eval_weights,
        created_by=version.created_by,
        created_at=version.created_at,
    )


async def test_prompt(request: PromptTestRequest) -> PromptTestResponse:
    """Test a prompt with AI model.
    
    Note: This is a placeholder. Actual implementation would use LangChain.
    
    Args:
        request: Test request with prompt and message.
        
    Returns:
        AI response.
    """
    # TODO: Implement actual LangChain/Gemini integration
    # For now, return a mock response
    return PromptTestResponse(
        response=f"[Mock Response] System: {request.system_prompt[:50]}... User: {request.user_message}",
        model=request.model,
        usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
    )
