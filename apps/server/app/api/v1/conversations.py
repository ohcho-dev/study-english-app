"""Conversation scenario validation API routes.

This module provides API endpoints for:
- Conversation templates (CRUD)
- Conversation sessions
- RUN0 voice processing pipeline
- Metrics and dashboard
"""

import math
import uuid
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status

from app.api.deps import DbSession
from app.core.database import AsyncSessionLocal
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
from app.services.conversation.my_turn_service import MyTurnService
from app.services.conversation.template_service import TemplateService
from app.services.conversation.tts_service import TTSService
from app.services.conversation.signaling import manager
from app.services.conversation.webrtc_service import webrtc_service


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


@router.get("/director-prompt-spec")
async def get_director_prompt_spec():
    """Get the immutable Base Prompt and Protocol for Scenario Director."""
    from app.services.conversation.scenario_director import ScenarioDirector
    return {
        "base_prompt": ScenarioDirector.BASE_PROMPT,
        "output_format": ScenarioDirector.TASK_AND_OUTPUT_FORMAT
    }


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


@router.post("/sessions/{session_id}/start")
async def start_my_turn_session(
    db: DbSession,
    session_id: UUID,
    background_tasks: BackgroundTasks,
    user_name: str = Form("User", description="User's name"),
):
    """Start a My Turn session (triggers initial turn)."""
    service = MyTurnService(db)
    try:
        return await service.start_session(session_id, user_name, background_tasks)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sessions/{session_id}/audio")
async def process_my_turn_audio(
    db: DbSession,
    session_id: UUID,
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(..., description="Audio file"),
):
    """Process user audio for My Turn session."""
    service = MyTurnService(db)
    
    # Read audio
    audio_data = await audio_file.read()
    
    # Determine format
    content_type = audio_file.content_type or ""
    audio_format = "webm"
    if "wav" in content_type or audio_file.filename.endswith(".wav"):
        audio_format = "wav"
    elif "mp3" in content_type or audio_file.filename.endswith(".mp3"):
        audio_format = "mp3"
        
    try:
        return await service.process_user_turn(session_id, audio_data, audio_format, background_tasks)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))



@router.get("/sessions/{session_id}/metrics")
async def get_session_metrics(db: DbSession, session_id: UUID):
    """Get metrics for a session. Returns empty metrics if none exist."""
    service = SessionService(db)
    metrics = await service.get_session_metrics(session_id)
    
    if not metrics:
        # Return empty metrics instead of 404
        return {
            "id": uuid.uuid4(),  # Temporary ID since none exists
            "session_id": session_id,
            "e2e_avg_ms": None,
            "e2e_p50_ms": None,
            "e2e_p95_ms": None,
            "asr_avg_ms": None,
            "llm_avg_ms": None,
            "tts_avg_ms": None,
            "total_turns": 0,
            "user_turns": 0,
            "asr_retry_count": 0,
            "error_count": 0,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "estimated_cost_usd": 0.0,
            "created_at": datetime.utcnow(),
        }
    
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
    
    # Log incoming parameters for debugging
    print(f"RUN0 Request: voice_id={voice_id}, difficulty={difficulty}, has_prompt={bool(system_prompt)}")
    if system_prompt:
        print(f"RUN0 System Prompt Preview: {system_prompt[:50]}...")

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
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error: {str(e)}",
        ) from e


@router.post("/run0/log", response_model=Run0LogResponse)
async def log_client_timestamp(db: DbSession, request: Run0LogRequest):
    """Log client-side timestamp when audio started playing.
    
    This completes the E2E latency measurement (t3 - t0).
    """
    service = Run0Service(db)
    return await service.log_client_timestamp(request)


@router.post("/sessions/{session_id}/greeting")
async def generate_session_greeting(
    db: DbSession,
    session_id: UUID,
    voice_id: str | None = Query(None, description="TTS voice ID to use"),
    custom_greeting: str | None = Query(None, description="Custom greeting text override"),
):
    """Generate and return the first speaker's greeting for a session.
    
    This endpoint should be called after creating a session to get
    the auto-greeting from the first speaker (Moderator or AI).
    
    Args:
        voice_id: Optional TTS voice ID override (e.g., 'en-US-Wavenet-D').
        custom_greeting: Optional custom greeting text to use instead of template/generated.
    
    Returns:
        Dict with greeting_text, audio_url, audio_base64, speaker_name, speaker_type.
    """
    service = Run0Service(db)
    
    try:
        result = await service.generate_greeting(
            session_id,
            voice_id=voice_id,
            custom_greeting=custom_greeting,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get("/run0/test-phrases", response_model=list[str])
async def get_test_phrases(db: DbSession):
    """Get default test phrases for RUN0 testing."""
    service = Run0Service(db)
    return await service.get_test_phrases()


# ============================================================================
# Signaling Endpoints
# ============================================================================


@router.websocket("/sessions/{session_id}/ws")
async def session_websocket(websocket: WebSocket, session_id: UUID):
    """WebSocket endpoint for real-time signaling."""
    session_id_str = str(session_id)
    await manager.connect(session_id_str, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle WebRTC signaling
            if data.get("type") == "offer":
                # Received SDP Offer from client -> create Answer
                response = await webrtc_service.handle_offer(session_id_str, data["sdp"])
                await manager.send_message(session_id_str, response)
                
            elif data.get("type") == "ice-candidate":
                # Received ICE candidate
                # In full implementation, pass to PC
                pass

            elif data.get("type") == "turn_complete":
                # Handle turn completion signal from client
                # complete_turn now uses asyncio.create_task internally for non-blocking AI processing
                try:
                    async with AsyncSessionLocal() as db:
                        service = MyTurnService(db)
                        await service.complete_turn(session_id)
                except Exception as e:
                    logger.error(f"Error handling turn_complete for session {session_id}: {e}", exc_info=True)
                    await manager.send_message(session_id_str, {
                        "type": "error",
                        "message": f"Turn processing error: {str(e)}"
                    })
                
    except WebSocketDisconnect:
        manager.disconnect(session_id_str)
        await webrtc_service.close(session_id_str)


# ============================================================================
# Voice Configuration Endpoints
# ============================================================================


@router.get("/voices")
async def list_available_voices():
    """Get list of available TTS voices."""
    return TTSService.get_available_voices()
