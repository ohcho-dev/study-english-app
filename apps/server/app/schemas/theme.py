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

    secondary: str = Field(description="Secondary color")
    secondary_foreground: str = Field(alias="secondary-foreground", description="Secondary text color")
    muted: str = Field(description="Muted background color")
    muted_foreground: str = Field(alias="muted-foreground", description="Muted text color")
    accent: str = Field(description="Accent color")
    accent_foreground: str = Field(alias="accent-foreground", description="Accent text color")
    destructive: str = Field(description="Destructive/error color")
    destructive_foreground: str = Field(alias="destructive-foreground", description="Destructive text color")
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


# JSON Template - HEX format (원본 HSL 색상을 정확히 변환)
THEME_JSON_TEMPLATE = {
    "light_mode": {
        # 원본: 0 0% 100% → 흰색
        "background": "#ffffff",
        # 원본: 220 10% 10% → 아주 어두운 회청색
        "foreground": "#17191c",
        "card": "#ffffff",
        "card-foreground": "#17191c",
        "popover": "#ffffff",
        "popover-foreground": "#17191c",
        # 원본: 220 80% 55% → 파란색
        "primary": "#2e6fe6",
        "primary-foreground": "#ffffff",
        # 원본: 220 10% 96%
        "secondary": "#f2f3f4",
        "secondary-foreground": "#5c6166",
        "muted": "#f2f3f4",
        "muted-foreground": "#686d73",
        "accent": "#edeff0",
        "accent-foreground": "#17191c",
        "destructive": "#ed3f3f",
        "destructive-foreground": "#ffffff",
        "success": "#16a34a",
        "success-foreground": "#ffffff",
        "warning": "#f5a623",
        "warning-foreground": "#ffffff",
        "border": "#e2e4e6",
        "input": "#e2e4e6",
        "ring": "#2e6fe6",
    },
    "dark_mode": {
        # 원본: 224 30% 8% → 매우 어두운 남색
        "background": "#0e1117",
        "foreground": "#f9fafb",
        "card": "#181c24",
        "card-foreground": "#f9fafb",
        "popover": "#181c24",
        "popover-foreground": "#f9fafb",
        # 원본: 220 80% 60%
        "primary": "#4285f4",
        "primary-foreground": "#ffffff",
        "secondary": "#252a34",
        "secondary-foreground": "#c9ccce",
        "muted": "#252a34",
        "muted-foreground": "#858a8f",
        "accent": "#2d3340",
        "accent-foreground": "#f9fafb",
        "destructive": "#ed3f3f",
        "destructive-foreground": "#ffffff",
        "success": "#22c55e",
        "success-foreground": "#ffffff",
        "warning": "#f5a623",
        "warning-foreground": "#ffffff",
        "border": "#252a34",
        "input": "#252a34",
        "ring": "#4285f4",
    },
}
