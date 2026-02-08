"""Conversation scenario validation API routes.

This module provides API endpoints for:
- Conversation templates (CRUD)
- Conversation sessions
- RUN0 voice processing pipeline
- Metrics and dashboard
"""

import math
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from app.api.deps import DbSession
from app.models.conversation import SessionStatus
from app.schemas.conversation import (
    MeasurementConfigCreate,
    MeasurementConfigResponse,
    MeasurementConfigUpdate,
    PaginatedSessions,
    PaginatedTemplates,
    Run0LogRequest,
    Run0LogResponse,
    Run0VoiceResponse,
    SessionCreate,
    SessionResponse,
    TemplateCreate,
    TemplateListItem,
    TemplateResponse,
    TemplateUpdate,
    TurnResponse,
)
from app.services.conversation.run0_service import Run0Service
from app.services.conversation.session_service import SessionService
from app.services.conversation.template_service import TemplateService
from app.services.conversation.tts_service import TTSService


router = APIRouter(prefix="/conversations", tags=["Conversations"])


# ============================================================================
# Template Endpoints
# ============================================================================


@router.get("/templates", response_model=PaginatedTemplates)
async def list_templates(
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    active_only: bool = Query(True, description="Only return active templates"),
):
    """Get all conversation templates with pagination."""
    service = TemplateService(db)
    items, total = await service.get_all(page=page, size=size, active_only=active_only)
    
    return PaginatedTemplates(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(db: DbSession, template_id: UUID):
    """Get a specific template with all participants."""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    
    return template


@router.post(
    "/templates",
    response_model=TemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(db: DbSession, data: TemplateCreate):
    """Create a new conversation template with participants."""
    service = TemplateService(db)
    return await service.create(data)


@router.patch("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(db: DbSession, template_id: UUID, data: TemplateUpdate):
    """Update a conversation template."""
    service = TemplateService(db)
    template = await service.update(template_id, data)
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    
    return template


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(db: DbSession, template_id: UUID):
    """Delete a conversation template."""
    service = TemplateService(db)
    deleted = await service.delete(template_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )


@router.post("/templates/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(
    db: DbSession,
    template_id: UUID,
    new_name: str = Query(..., description="Name for the duplicated template"),
):
    """Duplicate a conversation template."""
    service = TemplateService(db)
    template = await service.duplicate(template_id, new_name)
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found",
        )
    
    return template


# ============================================================================
# Session Endpoints
# ============================================================================


@router.get("/sessions", response_model=PaginatedSessions)
async def list_sessions(
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    template_id: UUID | None = Query(None),
    status: str | None = Query(None),
):
    """Get all sessions with pagination."""
    service = SessionService(db)
    items, total = await service.get_all(
        page=page,
        size=size,
        template_id=template_id,
        status=status,
    )
    
    return PaginatedSessions(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(db: DbSession, session_id: UUID):
    """Get a specific session."""
    service = SessionService(db)
    session = await service.get_by_id(session_id)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    
    return session


@router.post(
    "/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(db: DbSession, data: SessionCreate):
    """Create a new conversation session."""
    service = SessionService(db)
    return await service.create(data)


@router.post("/sessions/{session_id}/end", response_model=SessionResponse)
async def end_session(
    db: DbSession,
    session_id: UUID,
    status: str = Query("completed", description="Final status"),
    error_message: str | None = Query(None),
):
    """End a conversation session."""
    service = SessionService(db)
    
    # Map string to enum
    status_map = {
        "completed": SessionStatus.COMPLETED,
        "error": SessionStatus.ERROR,
        "paused": SessionStatus.PAUSED,
    }
    final_status = status_map.get(status, SessionStatus.COMPLETED)
    
    session = await service.end_session(
        session_id=session_id,
        status=final_status,
        error_message=error_message,
    )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    
    return session


@router.get("/sessions/{session_id}/turns", response_model=list[TurnResponse])
async def get_session_turns(db: DbSession, session_id: UUID):
    """Get all turns for a session."""
    service = SessionService(db)
    return await service.get_session_turns(session_id)


@router.get("/sessions/{session_id}/metrics")
async def get_session_metrics(db: DbSession, session_id: UUID):
    """Get metrics for a session."""
    service = SessionService(db)
    metrics = await service.get_session_metrics(session_id)
    
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Metrics for session {session_id} not found",
        )
    
    return metrics


# ============================================================================
# RUN0 Voice Processing Endpoints
# ============================================================================


@router.post("/run0/voice", response_model=Run0VoiceResponse)
async def process_voice(
    db: DbSession,
    audio_file: UploadFile = File(..., description="Audio file (webm, wav, mp3)"),
    t0_user_end: float = Form(..., description="Client timestamp when recording stopped (ms)"),
    session_id: UUID | None = Form(None, description="Existing session ID"),
    template_id: UUID | None = Form(None, description="Template ID for new session"),
    voice_id: str = Form("en-US-Wavenet-F", description="TTS voice ID"),
    system_prompt: str | None = Form(None, description="Custom system prompt"),
    difficulty: int | None = Form(None, ge=1, le=5, description="Difficulty level (1-5)"),
    estimated_minutes: int | None = Form(None, ge=1, description="Estimated session duration"),
):
    """Process voice input through STT → LLM → TTS pipeline.
    
    This is the main RUN0 endpoint for voice-based conversation testing.
    
    Args:
        audio_file: Recorded audio from client.
        t0_user_end: Client timestamp when user stopped speaking.
        session_id: Existing session to continue.
        template_id: Template to use for new session.
        voice_id: TTS voice ID for response.
        system_prompt: Optional custom prompt.
        difficulty: Difficulty level (1-5) for new session.
        estimated_minutes: Estimated duration for new session.
        
    Returns:
        Voice response with transcript, reply, audio, and timing metrics.
    """
    if not session_id and not template_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either session_id or template_id is required",
        )
    
    # Read audio file
    audio_data = await audio_file.read()
    
    # Determine audio format from content type or filename
    content_type = audio_file.content_type or ""
    if "webm" in content_type or (audio_file.filename and audio_file.filename.endswith(".webm")):
        audio_format = "webm"
    elif "wav" in content_type or (audio_file.filename and audio_file.filename.endswith(".wav")):
        audio_format = "wav"
    elif "mp3" in content_type or (audio_file.filename and audio_file.filename.endswith(".mp3")):
        audio_format = "mp3"
    else:
        audio_format = "webm"  # Default
    
    service = Run0Service(db)
    
    try:
        result = await service.process_voice(
            audio_data=audio_data,
            audio_format=audio_format,
            t0_user_end=t0_user_end,
            session_id=session_id,
            template_id=template_id,
            voice_id=voice_id,
            system_prompt=system_prompt,
            difficulty=difficulty,
            estimated_minutes=estimated_minutes,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.post("/run0/log", response_model=Run0LogResponse)
async def log_client_timestamp(db: DbSession, request: Run0LogRequest):
    """Log client-side timestamp when audio started playing.
    
    This completes the E2E latency measurement (t3 - t0).
    """
    service = Run0Service(db)
    return await service.log_client_timestamp(request)


@router.get("/run0/test-phrases", response_model=list[str])
async def get_test_phrases(db: DbSession):
    """Get default test phrases for RUN0 testing."""
    service = Run0Service(db)
    return await service.get_test_phrases()


# ============================================================================
# Voice Configuration Endpoints
# ============================================================================


@router.get("/voices")
async def list_available_voices():
    """Get list of available TTS voices."""
    return TTSService.get_available_voices()
