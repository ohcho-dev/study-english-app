"""Themes API router - Theme management endpoints."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession
from app.schemas.theme import (
    THEME_JSON_TEMPLATE,
    ThemeCreate,
    ThemeListResponse,
    ThemeRollbackRequest,
    ThemeUpdate,
    ThemeVersionCreate,
    ThemeVersionResponse,
    ThemeWithVersions,
)
from app.services import theme_service

router = APIRouter(prefix="/themes", tags=["themes"])


@router.get("", response_model=ThemeListResponse)
async def list_themes(db: DbSession) -> ThemeListResponse:
    """Get all themes.
    
    Returns:
        List of themes.
    """
    return await theme_service.get_all_themes(db)


@router.get("/active", response_model=ThemeWithVersions | None)
async def get_active_theme(db: DbSession) -> ThemeWithVersions | None:
    """Get the currently active theme.
    
    Returns:
        Active theme with current version or null.
    """
    return await theme_service.get_active_theme(db)


@router.get("/template")
async def get_json_template() -> dict:
    """Get the JSON template for theme creation.
    
    Returns:
        Theme JSON template with default values.
    """
    return THEME_JSON_TEMPLATE


@router.get("/{theme_id}", response_model=ThemeWithVersions)
async def get_theme(
    theme_id: UUID,
    db: DbSession,
) -> ThemeWithVersions:
    """Get a theme with all versions.
    
    Args:
        theme_id: Theme UUID.
        
    Returns:
        Theme with version history.
    """
    theme = await theme_service.get_theme_by_id(db, theme_id)
    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found",
        )
    return theme


@router.post("", response_model=ThemeWithVersions, status_code=status.HTTP_201_CREATED)
async def create_theme(
    create_data: ThemeCreate,
    db: DbSession,
) -> ThemeWithVersions:
    """Create a new theme with initial version.
    
    Args:
        create_data: Theme creation data including light/dark mode settings.
        
    Returns:
        Created theme with initial version.
    """
    return await theme_service.create_theme(db, create_data)


@router.patch("/{theme_id}", response_model=ThemeWithVersions)
async def update_theme(
    theme_id: UUID,
    update_data: ThemeUpdate,
    db: DbSession,
) -> ThemeWithVersions:
    """Update a theme's metadata (name, description, is_active).
    
    Args:
        theme_id: Theme UUID.
        update_data: Update data.
        
    Returns:
        Updated theme.
    """
    theme = await theme_service.update_theme(db, theme_id, update_data)
    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found",
        )
    return await theme_service.get_theme_by_id(db, theme_id)


@router.get("/{theme_id}/versions", response_model=list[ThemeVersionResponse])
async def get_theme_versions(
    theme_id: UUID,
    db: DbSession,
) -> list[ThemeVersionResponse]:
    """Get all versions of a theme.
    
    Args:
        theme_id: Theme UUID.
        
    Returns:
        List of theme versions.
    """
    return await theme_service.get_theme_versions(db, theme_id)


@router.post(
    "/{theme_id}/versions",
    response_model=ThemeVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_theme_version(
    theme_id: UUID,
    create_data: ThemeVersionCreate,
    db: DbSession,
) -> ThemeVersionResponse:
    """Create a new version for a theme (save current settings).
    
    Args:
        theme_id: Theme UUID.
        create_data: Version creation data with light/dark mode settings.
        
    Returns:
        Created version.
    """
    version = await theme_service.create_theme_version(db, theme_id, create_data)
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found",
        )
    return version


@router.post("/{theme_id}/rollback", response_model=ThemeVersionResponse)
async def rollback_theme(
    theme_id: UUID,
    rollback_data: ThemeRollbackRequest,
    db: DbSession,
) -> ThemeVersionResponse:
    """Rollback to a specific version (creates a new version with the same settings).
    
    Args:
        theme_id: Theme UUID.
        rollback_data: Rollback request with target version ID.
        
    Returns:
        New version (copy of the target version).
    """
    version = await theme_service.rollback_to_version(
        db, theme_id, rollback_data.version_id
    )
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme or version not found",
        )
    return version
