"""Common schemas used across the application."""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class HealthResponse(BaseModel):
    """Health check response schema."""
    
    status: str = Field(default="healthy", description="Health status")
    version: str = Field(default="0.1.0", description="API version")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""
    
    items: list[T] = Field(default_factory=list, description="List of items")
    total: int = Field(description="Total number of items")
    page: int = Field(default=1, description="Current page number")
    size: int = Field(default=20, description="Number of items per page")
    pages: int = Field(description="Total number of pages")


class MessageResponse(BaseModel):
    """Simple message response schema."""
    
    message: str = Field(description="Response message")


class ErrorResponse(BaseModel):
    """Error response schema."""
    
    detail: str = Field(description="Error detail message")
