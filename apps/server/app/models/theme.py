"""Theme and ThemeVersion models for app theming."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Theme(Base, UUIDMixin, TimestampMixin):
    """Theme model - represents a theme configuration."""
    
    __tablename__ = "themes"
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    versions = relationship(
        "ThemeVersion",
        back_populates="theme",
        order_by="desc(ThemeVersion.version)",
        lazy="selectin",
    )
    
    @property
    def current_version(self) -> "ThemeVersion | None":
        """Get the latest version of this theme."""
        return self.versions[0] if self.versions else None


class ThemeVersion(Base, UUIDMixin):
    """ThemeVersion model - represents a version of theme settings."""
    
    __tablename__ = "theme_versions"
    
    theme_id = Column(UUID(as_uuid=True), ForeignKey("themes.id"), nullable=False)
    version = Column(Integer, nullable=False)
    light_mode = Column(JSONB, nullable=False)
    dark_mode = Column(JSONB, nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=True)  # Optional: admin user ID
    created_at = Column(DateTime, nullable=False)
    
    # Relationships
    theme = relationship("Theme", back_populates="versions")
