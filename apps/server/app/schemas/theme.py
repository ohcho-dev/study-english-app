"""Theme-related Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# Theme Color Schema
class ThemeColors(BaseModel):
    """Color values for a theme mode (light or dark)."""
    
    background: str = Field(description="Background color in HSL format")
    foreground: str = Field(description="Foreground/text color")
    card: str = Field(description="Card background color")
    card_foreground: str = Field(alias="card-foreground", description="Card text color")
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
    border: str = Field(description="Border color")
    input: str = Field(description="Input border color")
    ring: str = Field(description="Focus ring color")
    
    model_config = {"populate_by_name": True}


# Theme Version Schemas
class ThemeVersionBase(BaseModel):
    """Base schema for theme version."""
    
    light_mode: dict = Field(description="Light mode color settings")
    dark_mode: dict = Field(description="Dark mode color settings")


class ThemeVersionCreate(ThemeVersionBase):
    """Schema for creating a new theme version."""
    
    pass


class ThemeVersionResponse(ThemeVersionBase):
    """Schema for theme version response."""
    
    id: UUID
    theme_id: UUID
    version: int
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
    
    light_mode: dict = Field(description="Initial light mode settings")
    dark_mode: dict = Field(description="Initial dark mode settings")


class ThemeUpdate(BaseModel):
    """Schema for updating theme metadata."""
    
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    is_active: bool | None = None


class ThemeResponse(ThemeBase):
    """Schema for theme response (without versions)."""
    
    id: UUID
    is_active: bool
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


# JSON Template
THEME_JSON_TEMPLATE = {
    "light_mode": {
        "background": "0 0% 100%",
        "foreground": "220 10% 10%",
        "card": "0 0% 100%",
        "card-foreground": "220 10% 10%",
        "popover": "0 0% 100%",
        "popover-foreground": "220 10% 10%",
        "primary": "220 80% 55%",
        "primary-foreground": "0 0% 100%",
        "secondary": "220 10% 96%",
        "secondary-foreground": "220 10% 40%",
        "muted": "220 10% 96%",
        "muted-foreground": "220 10% 45%",
        "accent": "220 10% 94%",
        "accent-foreground": "220 10% 10%",
        "destructive": "0 84% 60%",
        "destructive-foreground": "0 0% 100%",
        "border": "220 10% 90%",
        "input": "220 10% 90%",
        "ring": "220 80% 55%",
    },
    "dark_mode": {
        "background": "224 30% 8%",
        "foreground": "220 10% 98%",
        "card": "224 25% 12%",
        "card-foreground": "220 10% 98%",
        "popover": "224 25% 12%",
        "popover-foreground": "220 10% 98%",
        "primary": "220 80% 60%",
        "primary-foreground": "0 0% 100%",
        "secondary": "224 20% 18%",
        "secondary-foreground": "220 10% 80%",
        "muted": "224 20% 18%",
        "muted-foreground": "220 10% 55%",
        "accent": "224 20% 22%",
        "accent-foreground": "220 10% 98%",
        "destructive": "0 84% 60%",
        "destructive-foreground": "0 0% 100%",
        "border": "224 20% 18%",
        "input": "224 20% 18%",
        "ring": "220 80% 60%",
    },
}
