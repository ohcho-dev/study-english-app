"""Theme service - business logic for theme management."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.theme import Theme, ThemeVersion
from app.schemas.theme import (
    ThemeCreate,
    ThemeListResponse,
    ThemeResponse,
    ThemeUpdate,
    ThemeVersionCreate,
    ThemeVersionResponse,
    ThemeWithVersions,
)


async def get_all_themes(db: AsyncSession) -> ThemeListResponse:
    """Get all themes.
    
    Args:
        db: Database session.
        
    Returns:
        List of themes with total count.
    """
    result = await db.execute(select(Theme).order_by(Theme.created_at.desc()))
    themes = result.scalars().all()
    
    return ThemeListResponse(
        items=[ThemeResponse.model_validate(t) for t in themes],
        total=len(themes),
    )


async def get_theme_by_id(db: AsyncSession, theme_id: UUID) -> ThemeWithVersions | None:
    """Get a theme by ID with all versions.
    
    Args:
        db: Database session.
        theme_id: Theme UUID.
        
    Returns:
        Theme with versions or None if not found.
    """
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.versions))
        .where(Theme.id == theme_id)
    )
    theme = result.scalar_one_or_none()
    
    if not theme:
        return None
    
    versions = [ThemeVersionResponse.model_validate(v) for v in theme.versions]
    current_version = versions[0] if versions else None
    
    return ThemeWithVersions(
        id=theme.id,
        name=theme.name,
        description=theme.description,
        is_active=theme.is_active,
        default_mode=theme.default_mode,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
        versions=versions,
        current_version=current_version,
    )


async def get_active_theme(db: AsyncSession) -> ThemeWithVersions | None:
    """Get the currently active theme.
    
    Args:
        db: Database session.
        
    Returns:
        Active theme with current version or None.
    """
    result = await db.execute(
        select(Theme)
        .options(selectinload(Theme.versions))
        .where(Theme.is_active == True)
    )
    theme = result.scalar_one_or_none()
    
    if not theme:
        return None
    
    versions = [ThemeVersionResponse.model_validate(v) for v in theme.versions]
    current_version = versions[0] if versions else None
    
    return ThemeWithVersions(
        id=theme.id,
        name=theme.name,
        description=theme.description,
        is_active=theme.is_active,
        default_mode=theme.default_mode,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
        versions=versions,
        current_version=current_version,
    )


async def create_theme(db: AsyncSession, create_data: ThemeCreate) -> ThemeWithVersions:
    """Create a new theme with initial version.
    
    Args:
        db: Database session.
        create_data: Theme creation data.
        
    Returns:
        Created theme with initial version.
    """
    now = datetime.utcnow()
    
    # Create theme
    theme = Theme(
        name=create_data.name,
        description=create_data.description,
        is_active=False,
        created_at=now,
        updated_at=now,
    )
    db.add(theme)
    await db.flush()  # Get the theme ID
    
    # Create initial version
    version = ThemeVersion(
        theme_id=theme.id,
        version=1,
        light_mode=create_data.light_mode,
        dark_mode=create_data.dark_mode,
        created_at=now,
    )
    db.add(version)
    await db.commit()
    await db.refresh(theme)
    
    return await get_theme_by_id(db, theme.id)


async def update_theme(
    db: AsyncSession, theme_id: UUID, update_data: ThemeUpdate
) -> Theme | None:
    """Update theme metadata.
    
    Args:
        db: Database session.
        theme_id: Theme UUID.
        update_data: Update data.
        
    Returns:
        Updated theme or None if not found.
    """
    result = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = result.scalar_one_or_none()
    
    if not theme:
        return None
    
    # If activating this theme, deactivate others
    if update_data.is_active is True:
        await db.execute(
            select(Theme).where(Theme.id != theme_id)
        )
        # Deactivate all other themes
        all_themes_result = await db.execute(select(Theme).where(Theme.id != theme_id))
        for other_theme in all_themes_result.scalars().all():
            other_theme.is_active = False
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(theme, field, value)
    
    theme.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(theme)
    
    return theme


async def create_theme_version(
    db: AsyncSession, theme_id: UUID, create_data: ThemeVersionCreate
) -> ThemeVersionResponse | None:
    """Create a new version for a theme.
    
    Args:
        db: Database session.
        theme_id: Theme UUID.
        create_data: Version creation data.
        
    Returns:
        Created version or None if theme not found.
    """
    # Check theme exists
    result = await db.execute(select(Theme).where(Theme.id == theme_id))
    theme = result.scalar_one_or_none()
    
    if not theme:
        return None
    
    # Get next version number
    version_result = await db.execute(
        select(func.max(ThemeVersion.version)).where(ThemeVersion.theme_id == theme_id)
    )
    max_version = version_result.scalar() or 0
    
    # Create new version
    version = ThemeVersion(
        theme_id=theme_id,
        version=max_version + 1,
        description=create_data.description,
        light_mode=create_data.light_mode,
        dark_mode=create_data.dark_mode,
        created_at=datetime.utcnow(),
    )
    db.add(version)
    
    # Update theme timestamp
    theme.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(version)
    
    return ThemeVersionResponse.model_validate(version)


async def rollback_to_version(
    db: AsyncSession, theme_id: UUID, version_id: UUID
) -> ThemeVersionResponse | None:
    """Rollback to a specific version by creating a new version with the same settings.
    
    Args:
        db: Database session.
        theme_id: Theme UUID.
        version_id: Version ID to rollback to.
        
    Returns:
        New version (copy of the target version) or None if not found.
    """
    # Get the target version
    result = await db.execute(
        select(ThemeVersion).where(
            ThemeVersion.id == version_id,
            ThemeVersion.theme_id == theme_id,
        )
    )
    target_version = result.scalar_one_or_none()
    
    if not target_version:
        return None
    
    # Create new version with same settings
    return await create_theme_version(
        db,
        theme_id,
        ThemeVersionCreate(
            light_mode=target_version.light_mode,
            dark_mode=target_version.dark_mode,
        ),
    )


async def get_theme_versions(
    db: AsyncSession, theme_id: UUID
) -> list[ThemeVersionResponse]:
    """Get all versions of a theme.
    
    Args:
        db: Database session.
        theme_id: Theme UUID.
        
    Returns:
        List of theme versions ordered by version desc.
    """
    result = await db.execute(
        select(ThemeVersion)
        .where(ThemeVersion.theme_id == theme_id)
        .order_by(ThemeVersion.version.desc())
    )
    versions = result.scalars().all()
    
    return [ThemeVersionResponse.model_validate(v) for v in versions]
