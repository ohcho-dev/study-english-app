"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.schemas.common import HealthResponse

# Configure logging to suppress verbose SQLAlchemy logs
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

# Audio directory for TTS files
AUDIO_DIR = Path(__file__).parent.parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    import asyncio
    from app.services.conversation.my_turn_service import cleanup_stale_sessions, cleanup_active_sessions_on_startup
    
    # Run immediate cleanup for server restart
    await cleanup_active_sessions_on_startup()
    
    # Start background cleanup task (check every 30 mins)
    cleanup_task = asyncio.create_task(cleanup_stale_sessions(check_interval=1800))
    
    yield
    
    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="AI English Learning Service Backend API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(v1_router, prefix=settings.API_V1_PREFIX)

# Mount static files for audio
app.mount("/static", StaticFiles(directory=Path(__file__).parent.parent / "static"), name="static")


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint.
    
    Returns:
        Health status and version information.
    """
    return HealthResponse(status="healthy", version="0.1.0")


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Root endpoint.
    
    Returns:
        Welcome message with API documentation link.
    """
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
    }
