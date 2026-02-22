"""Conversation scenario validation API routes.

This module provides API endpoints for:
- Conversation templates (CRUD)
- Conversation sessions
- RUN0 voice processing pipeline
- Metrics and dashboard
"""

import logging
import math
import uuid
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, File, Form, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect, status

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
    SessionLogRequest,
    SessionLogResponse,
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
logger = logging.getLogger(__name__)


# ============================================================================
# Template Endpoints
# ============================================================================


@router.get("/templates", response_model=PaginatedTemplates)
async def list_templates(
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    active_only: bool = Query(True, description="Only return active templates"),
    authorization: str | None = Header(None),
):
    """Get all conversation templates with pagination."""
    # JWT에서 role 확인 — tester면 공개 템플릿만 반환
    tester_only = False
    if authorization and authorization.startswith("Bearer "):
        from app.core.security import verify_token
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        if payload and payload.get("role") == "tester":
            tester_only = True

    service = TemplateService(db)
    items, total = await service.get_all(
        page=page, size=size, active_only=active_only, tester_only=tester_only,
    )
    
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


@router.post("/sessions/export")
async def export_sessions(
    db: DbSession,
    session_ids: list[UUID],
):
    """Export selected sessions to Excel."""
    from fastapi.responses import FileResponse
    import os
    
    service = SessionService(db)
    try:
        file_path = await service.export_sessions(session_ids)
        filename = f"session_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        # FileResponse automatically handles closing the file handle, 
        # but the temp file remains on disk. 
        # For production, we might want a BackgroundTask to delete it after sending, 
        # but FileResponse makes that tricky without custom logic. 
        # For this scope, we'll let OS temp cleanup handle it or rely on low volume.
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )



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
    
    # FORCE DISCONNECT (Physical Session Termination)
    # Ensure any active WebSocket connection is closed when session ends
    session_id_str = str(session_id)
    if session_id_str in manager.active_connections:
        try:
            websocket = manager.active_connections[session_id_str]
            # 1000: Normal Closure
            await websocket.close(code=1000, reason="Session ended by user")
            logger.info(f"[end_session] Force closed WebSocket for session {session_id_str}")
        except Exception as e:
            logger.warning(f"[end_session] Error closing WebSocket for session {session_id_str}: {e}")
        finally:
            manager.disconnect(session_id_str)
            
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
    t0_user_end: float = Form(0.0, description="Client timestamp when user stopped speaking"),
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
        return await service.process_user_turn(session_id, audio_data, audio_format, background_tasks, t0_user_end)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sessions/log", response_model=SessionLogResponse)
async def log_session_client_timestamp(db: DbSession, request: SessionLogRequest):
    """Log client-side timestamp (t3 - audio play start).
    
    Generic endpoint for any session (Run0 or My Turn).
    """
    service = SessionService(db)
    turn = await service.update_turn_timestamp(request.turn_id, request.t3_audio_play_start)
    
    if turn:
        await service.calculate_metrics(turn.session_id)
        return SessionLogResponse(success=True)
        
    return SessionLogResponse(success=False)


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
# RUN0 Model Options
# ============================================================================


@router.get("/run0/models/stt", summary="Get available STT models")
async def get_stt_models():
    """Get list of available Speech-to-Text models."""
    return [
        {"id": "latest_long", "name": "Latest Long", "description": "대화용 오디오에 최적화 (기본값)", "provider": "google"},
        {"id": "latest_short", "name": "Latest Short", "description": "짧은 발화에 최적화", "provider": "google"},
        {"id": "command_and_search", "name": "Command and Search", "description": "짧은 명령/검색어에 최적화 (고속)", "provider": "google"},
        {"id": "phone_call", "name": "Phone Call", "description": "전화 통화 품질 오디오에 최적화", "provider": "google"},
        {"id": "chirp_2", "name": "Chirp 2", "description": "차세대 고정확도 모델", "provider": "google"},
        {"id": "chirp", "name": "Chirp", "description": "범용 음성 인식 모델", "provider": "google"},
    ]


@router.get("/run0/models/llm", summary="Get available LLM models")
async def get_llm_models():
    """Get list of available LLM models for Run0."""
    from app.services.ai_lab.model_registry import MODEL_REGISTRY
    models = []
    for model_id, info in MODEL_REGISTRY.items():
        if info.category in ("general", "reasoning"):
            models.append({
                "id": info.id,
                "name": info.name,
                "provider": info.provider,
                "description": info.description,
                "category": info.category,
            })
    return models


@router.get("/run0/models/tts", summary="Get available TTS providers, models, and voices")
async def get_tts_options():
    """Get structured TTS options by provider."""
    from app.services.conversation.gemini_tts_service import GeminiTTSService
    
    gc_voices = TTSService.get_available_voices()
    gemini_models = GeminiTTSService.get_available_models()
    gemini_voices = GeminiTTSService.get_available_voices()
    
    return {
        "providers": [
            {
                "id": "google-cloud",
                "name": "Google Cloud TTS",
                "description": "안정적이고 다양한 음성 지원 (추천)",
                "voices": gc_voices,
            },
            {
                "id": "gemini",
                "name": "Gemini TTS",
                "description": "AI 기반 자연스러운 음성 생성",
                "models": gemini_models,
                "voices": gemini_voices,
            },
        ],
    }


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
    stt_model: str = Form("latest_long", description="STT model (latest_long, chirp_2, latest_short)"),
    llm_model: str = Form("gemini-2.5-flash", description="LLM model name"),
    tts_provider: str = Form("google-cloud", description="TTS provider (google-cloud, gemini)"),
    tts_model: str | None = Form(None, description="TTS model for Gemini TTS"),
    difficulty: int | None = Form(None, ge=1, le=5, description="Difficulty level (1-5)"),
    estimated_minutes: int | None = Form(None, ge=1, description="Estimated session duration"),
    warmup_iterations: int = Form(2, ge=0, description="Number of warmup iterations to exclude from metrics"),
):
    """Process voice input through STT → LLM → TTS pipeline.
    
    This is the main RUN0 endpoint for voice-based conversation testing.
    Can work standalone (no session/template) or with an existing session.
    """
    # session_id / template_id are both optional for standalone Run0
    
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
            stt_model=stt_model,
            llm_model=llm_model,
            tts_provider=tts_provider,
            tts_model=tts_model,
            difficulty=difficulty,
            estimated_minutes=estimated_minutes,
            warmup_iterations=warmup_iterations,
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
        # Mark session as COMPLETED to stop any running AI turns
        try:
            async with AsyncSessionLocal() as db:
                service = MyTurnService(db)
                session = await service.session_service.get_by_id(session_id)
                if session and session.status == SessionStatus.ACTIVE:
                    session.status = SessionStatus.COMPLETED
                    await db.commit()
                    logger.info(f"Session {session_id} marked as COMPLETED due to WebSocket disconnect")
        except Exception as e:
            logger.error(f"Error marking session {session_id} as completed on disconnect: {e}")


# ============================================================================
# Voice Configuration Endpoints
# ============================================================================


@router.get("/voices")
async def list_available_voices():
    """Get list of available TTS voices."""
    return TTSService.get_available_voices()
