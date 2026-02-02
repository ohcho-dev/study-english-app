"""Theme-related Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# Theme Color Schema
class ThemeColors(BaseModel):
    """Color values for a theme mode (light or dark). Uses HEX format (#RRGGBB)."""
    
    background: str = Field(description="Background color in HEX format (#RRGGBB)")
    foreground: str = Field(description="Foreground/text color")
    card: str = Field(description="Card background color")
    card_foreground: str = Field(alias="card-foreground", description="Card text color")
    popover: str = Field(default="#ffffff", description="Popover background color")
    popover_foreground: str = Field(alias="popover-foreground", default="#17191c", description="Popover text color")
    primary: str = Field(description="Primary accent color")
    primary_foreground: str = Field(alias="primary-foreground", description="Primary text color")
    primary_light: str | None = Field(alias="primary-light", default=None, description="Primary pressed/hover color")

    secondary: str = Field(description="Secondary color")
    secondary_foreground: str = Field(alias="secondary-foreground", description="Secondary text color")
    secondary_light: str | None = Field(alias="secondary-light", default=None, description="Secondary pressed/hover color")
    muted: str = Field(description="Muted background color")
    muted_foreground: str = Field(alias="muted-foreground", description="Muted text color")
    accent: str = Field(description="Accent color")
    accent_foreground: str = Field(alias="accent-foreground", description="Accent text color")
    accent_light: str | None = Field(alias="accent-light", default=None, description="Accent pressed/hover color")
    destructive: str = Field(description="Destructive/error color")
    destructive_foreground: str = Field(alias="destructive-foreground", description="Destructive text color")
    destructive_light: str | None = Field(alias="destructive-light", default=None, description="Destructive pressed/hover color")
    success: str = Field(default="#16a34a", description="Success color")
    success_foreground: str = Field(alias="success-foreground", default="#ffffff", description="Success text color")
    warning: str = Field(default="#f5a623", description="Warning color")
    warning_foreground: str = Field(alias="warning-foreground", default="#ffffff", description="Warning text color")
    border: str = Field(description="Border color")
    input: str = Field(description="Input border color")
    ring: str = Field(description="Focus ring color")
    
    model_config = {"populate_by_name": True}


# Theme Version Schemas
class ThemeVersionBase(BaseModel):
    """Base schema for theme version."""
    
    light_mode: dict = Field(description="Light mode color settings (HEX format)")
    dark_mode: dict = Field(description="Dark mode color settings (HEX format)")


class ThemeVersionCreate(ThemeVersionBase):
    """Schema for creating a new theme version."""
    
    description: str | None = Field(default=None, description="Version description/note")


class ThemeVersionResponse(ThemeVersionBase):
    """Schema for theme version response."""
    
    id: UUID
    theme_id: UUID
    version: int
    description: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


# Theme Schemas
class ThemeBase(BaseModel):
    """Base schema for theme."""
    
    name: str = Field(min_length=1, max_length=100, description="Theme name")
    description: str | None = Field(default=None, description="Theme description")


class ThemeCreate(ThemeBase):
    """Schema for creating a new theme with initial version."""
    
    light_mode: dict = Field(description="Initial light mode settings (HEX format)")
    dark_mode: dict = Field(description="Initial dark mode settings (HEX format)")


class ThemeUpdate(BaseModel):
    """Schema for updating theme metadata."""
    
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    is_active: bool | None = None
    default_mode: str | None = Field(default=None, description="App default mode: light, dark, system")


class ThemeResponse(ThemeBase):
    """Schema for theme response (without versions)."""
    
    id: UUID
    is_active: bool
    default_mode: str = Field(default='system', description="App default mode: light, dark, system")
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ThemeWithVersions(ThemeResponse):
    """Schema for theme with version history."""
    
    versions: list[ThemeVersionResponse] = Field(default_factory=list)
    current_version: ThemeVersionResponse | None = None


class ThemeListResponse(BaseModel):
    """Schema for listing themes."""
    
    items: list[ThemeResponse]
    total: int


class ThemeRollbackRequest(BaseModel):
    """Schema for rollback request."""
    
    version_id: UUID = Field(description="Version ID to rollback to")


# JSON Template - HEX format (Matching User CSS - Orange Primary)
THEME_JSON_TEMPLATE = {
    "light_mode": {
        "background": "#ffffff",
        "foreground": "#020817",
        "card": "#ffffff",
        "card-foreground": "#020817",
        "popover": "#ffffff",
        "popover-foreground": "#020817",
        "primary": "#f97316",
        "primary-foreground": "#ffffff",
        "primary-light": "#fb9248",  # calculated
        "secondary": "#3b82f6",
        "secondary-foreground": "#ffffff",
        "secondary-light": "#609bf8",  # calculated
        "muted": "#f1f5f9",
        "muted-foreground": "#64748b",
        "accent": "#e2e8f0",  # Slate-200 (Darker for visibility)
        "accent-foreground": "#0f172a",
        "accent-light": "#eef2f6",  # calculated from new accent
        "destructive": "#ef4444",
        "destructive-foreground": "#ffffff",
        "destructive-light": "#f36b6b",
        "success": "#16a34a",
        "success-foreground": "#ffffff",
        "warning": "#f97316",
        "warning-foreground": "#ffffff",
        "border": "#cbd5e1",  # Slate-300 (Darker for visibility)
        "input": "#cbd5e1",
        "ring": "#f97316",
    },
    "dark_mode": {
        "background": "#020817",
        "foreground": "#f8fafc",
        "card": "#1e293b",
        "card-foreground": "#f8fafc",
        "popover": "#020817",
        "popover-foreground": "#f8fafc",
        "primary": "#f97316",
        "primary-foreground": "#ffffff",
        "primary-light": "#fb9248",
        "secondary": "#3b82f6",
        "secondary-foreground": "#ffffff",
        "secondary-light": "#609bf8",
        "muted": "#1e293b",
        "muted-foreground": "#94a3b8",
        "accent": "#334155",  # Slate-700 (Lighter for visibility on dark)
        "accent-foreground": "#f8fafc",
        "accent-light": "#515d6e",  # calculated
        "destructive": "#7f1d1d",
        "destructive-foreground": "#ffffff",
        "destructive-light": "#a13e3e",
        "success": "#166534",
        "success-foreground": "#ffffff",
        "warning": "#f97316",
        "warning-foreground": "#ffffff",
        "border": "#334155",  # Slate-700 (Lighter for visibility on dark)
        "input": "#334155",
        "ring": "#f97316",
    },
}
