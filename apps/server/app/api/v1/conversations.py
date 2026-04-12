"""Conversation scenario validation API routes.

This module provides API endpoints for:
- Conversation templates (CRUD)
- Conversation sessions
- RUN0 voice processing pipeline
- Metrics and dashboard
"""

import logging
import math
import re
import uuid
from datetime import datetime, timezone
from uuid import UUID

from zoneinfo import ZoneInfo

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
from app.schemas.observation import SessionObservationResponse
from app.services.conversation.run0_service import Run0Service
from app.services.conversation.session_service import SessionService
from app.services.conversation.my_turn_service import MyTurnService
from app.services.conversation.template_service import TemplateService
from app.services.conversation.tts_service import TTSService
from app.services.conversation.signaling import manager
from app.services.conversation.webrtc_service import webrtc_service


router = APIRouter(prefix="/conversations", tags=["Conversations"])
logger = logging.getLogger(__name__)
_KST = ZoneInfo("Asia/Seoul")
_INVALID_XML_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")


def _format_timestamp_ms(value: float | int | None) -> str | None:
    if value is None:
        return None
    try:
        ts = float(value)
    except (TypeError, ValueError):
        return None
    if ts <= 0:
        return None
    dt = datetime.fromtimestamp(ts / 1000.0, tz=timezone.utc).astimezone(_KST)
    return f"{dt:%Y-%m-%d %H:%M:%S}.{int(dt.microsecond / 1000):03d} KST"


def _sanitize_excel_value(value):
    if value is None:
        return None
    if isinstance(value, str):
        return _INVALID_XML_RE.sub("", value)
    if isinstance(value, (dict, list)):
        return _INVALID_XML_RE.sub("", str(value))
    return value


def _append_row(ws, values):
    ws.append([_sanitize_excel_value(v) for v in values])


def _relative_seconds(base: float | int | None, target: float | int | None) -> float | None:
    if base is None or target is None:
        return None
    try:
        b = float(base)
        t = float(target)
    except (TypeError, ValueError):
        return None
    if b <= 0 or t < b:
        return None
    return round((t - b) / 1000.0, 2)


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
    import logging
    logging.warning(f"DEBUG: update_template payload: {data.model_dump(exclude={'participants'})}")
    logging.warning(f"DEBUG: director_llm_model explicitly: {data.director_llm_model}")
    
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



@router.put("/templates/{template_id}/participant-models")
async def save_participant_models(
    db: DbSession,
    template_id: UUID,
    models: list[dict],
):
    """Save per-participant model & voice settings (admin only).
    
    Body: [{"participant_id": "uuid", "llm_model": "...", "stt_model": "...",
            "tts_model": "...", "tts_provider": "...", "voice_id": "...",
            "speaking_rate": 1.0, "difficulty": 1}]
    """
    service = TemplateService(db)
    template = await service.get_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
    
    from sqlalchemy import select
    from app.models.conversation import ConversationParticipant
    
    updated = []
    for entry in models:
        pid = entry.get("participant_id")
        if not pid:
            continue
        
        stmt = select(ConversationParticipant).where(
            ConversationParticipant.id == pid,
            ConversationParticipant.template_id == template_id,
        )
        result = await db.execute(stmt)
        participant = result.scalar_one_or_none()
        
        if participant:
            if "llm_model" in entry:
                participant.llm_model = entry["llm_model"]
            if "stt_model" in entry:
                participant.stt_model = entry["stt_model"]
            if "stt_mode" in entry:
                participant.stt_mode = entry["stt_mode"]
            if "stt_streaming_display" in entry:
                participant.stt_streaming_display = entry["stt_streaming_display"]
            if "tts_model" in entry:
                participant.tts_model = entry["tts_model"]
            if "tts_provider" in entry:
                participant.tts_provider = entry["tts_provider"]
            if "voice_id" in entry and entry["voice_id"]:
                participant.voice_id = entry["voice_id"]
            if "difficulty" in entry:
                participant.difficulty = entry["difficulty"]
            if "speaking_rate" in entry:
                # Store speaking_rate in voice_settings JSONB
                vs = dict(participant.voice_settings or {})
                vs["speaking_rate"] = entry["speaking_rate"]
                participant.voice_settings = vs
            updated.append(str(participant.id))
    
    await db.commit()
    return {"updated": updated, "count": len(updated)}


@router.post("/sessions/{session_id}/text")
async def process_text_input(
    db: DbSession,
    session_id: UUID,
    background_tasks: BackgroundTasks,
    text: str = Form(..., description="User's text input"),
    t0_user_end: float = Form(0.0, description="Client timestamp when recording stopped"),
    t1_server_final: float = Form(0.0, description="Server timestamp when STT is_final received"),
    t_recording_start: float = Form(0.0, description="Client timestamp when recording started (ms)"),
    t_first_speech: float = Form(0.0, description="Client timestamp when first speech detected via VAD (ms)"),
):
    """Process user text input for My Turn session (skips STT).
    
    Used in text input mode or after streaming STT provides final text.
    """
    service = MyTurnService(db)
    
    try:
        return await service.process_user_turn(
            session_id=session_id,
            audio_data=None,
            audio_format=None,
            background_tasks=background_tasks,
            t0_user_end=t0_user_end,
            text_input=text,
            t1_server_final=t1_server_final,
            t_recording_start=t_recording_start,
            t_first_speech=t_first_speech,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sessions/{session_id}/energy-flow")
async def generate_energy_flow(
    db: DbSession,
    session_id: UUID,
    ryan_utterance: str = Form(..., description="Ryan's EMF Shift Korean utterance"),
    student_response: str = Form(..., description="Student's English response"),
    control_verb: str = Form("", description="Control verb hint (optional)"),
    level: int = Form(1, description="Current difficulty level"),
):
    """Generate energy flow comparison table for a control verb.

    This endpoint is called in PARALLEL with the main pipeline,
    providing fast energy flow visualization while the student waits
    for the full pipeline response (evaluator → planner → conductor).
    """
    from app.services.conversation.energy_flow_service import EnergyFlowService

    service = EnergyFlowService()
    result, duration_ms = await service.generate(
        ryan_utterance=ryan_utterance,
        student_response=student_response,
        control_verb=control_verb,
        level=level,
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate energy flow data",
        )

    return {
        "energy_flow": result,
        "duration_ms": duration_ms,
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
    t_recording_start: float = Form(0.0, description="Client timestamp when recording started (ms)"),
    t_first_speech: float = Form(0.0, description="Client timestamp when first speech was detected via VAD (ms)"),
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
        return await service.process_user_turn(
            session_id,
            audio_data,
            audio_format,
            background_tasks,
            t0_user_end,
            t_recording_start=t_recording_start,
            t_first_speech=t_first_speech,
        )
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
        {"id": "chirp_3", "name": "Chirp 3 ⭐", "description": "최신 고정확도 다국어 모델 (추천, V2 API)", "provider": "google"},
        {"id": "chirp_2", "name": "Chirp 2", "description": "차세대 고정확도 모델 (V2 API)", "provider": "google"},
        {"id": "chirp", "name": "Chirp", "description": "범용 음성 인식 모델", "provider": "google"},
        {"id": "latest_long", "name": "Latest Long", "description": "대화용 오디오에 최적화 (V1 API)", "provider": "google"},
        {"id": "latest_short", "name": "Latest Short", "description": "짧은 발화에 최적화 (V1 API)", "provider": "google"},
        {"id": "command_and_search", "name": "Command and Search", "description": "짧은 명령/검색어에 최적화 (고속, V1 API)", "provider": "google"},
        {"id": "phone_call", "name": "Phone Call", "description": "전화 통화 품질 오디오에 최적화 (V1 API)", "provider": "google"},
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
    stt_model: str = Form("latest_long", description="STT model (latest_long, chirp_2, chirp_3)"),
    stt_mode: str = Form("sync", description="STT mode (sync, streaming)"),
    llm_model: str = Form("gemini-2.5-flash", description="LLM model name"),
    tts_provider: str = Form("google-cloud", description="TTS provider (google-cloud, gemini)"),
    tts_model: str | None = Form(None, description="TTS model for Gemini TTS"),
    tts_mode: str = Form("sync", description="TTS mode (sync, streaming)"),
    reference_text: str | None = Form(None, description="Reference text for WER/CER calculation"),
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
            stt_mode=stt_mode,
            llm_model=llm_model,
            tts_provider=tts_provider,
            tts_model=tts_model,
            tts_mode=tts_mode,
            reference_text=reference_text,
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


@router.post("/run0/text", response_model=Run0VoiceResponse)
async def process_text(
    db: DbSession,
    transcript: str = Form(..., description="Pre-transcribed text from streaming STT"),
    t0_user_end: float = Form(..., description="Client timestamp when recording stopped (ms)"),
    t1_asr_final: float = Form(..., description="Client timestamp when STT final received (ms)"),
    session_id: UUID | None = Form(None, description="Existing session ID"),
    voice_id: str = Form("en-US-Wavenet-F", description="TTS voice ID"),
    system_prompt: str | None = Form(None, description="Custom system prompt"),
    stt_model: str = Form("chirp_3", description="STT model used for streaming"),
    stt_mode: str = Form("streaming", description="STT mode"),
    llm_model: str = Form("gemini-2.5-flash", description="LLM model name"),
    tts_provider: str = Form("google-cloud", description="TTS provider"),
    tts_model: str | None = Form(None, description="TTS model for Gemini TTS"),
    tts_mode: str = Form("sync", description="TTS mode"),
    reference_text: str | None = Form(None, description="Reference text for WER/CER"),
    warmup_iterations: int = Form(2, ge=0, description="Warmup iterations"),
    stt_confidence: float | None = Form(None, description="STT confidence from streaming"),
    stt_latency_ms: float | None = Form(None, description="Client-measured STT latency in ms (streaming mode)"),
    server_final_timestamp_ms: float | None = Form(None, description="Server timestamp when is_final received (ms)"),
):
    """Process pre-transcribed text through LLM → TTS pipeline.
    
    Used in streaming STT mode where the transcript is already available
    from the WebSocket streaming recognition. Skips STT processing entirely.
    """
    service = Run0Service(db)
    
    try:
        result = await service.process_text(
            transcript=transcript,
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
            session_id=session_id,
            voice_id=voice_id,
            system_prompt=system_prompt,
            stt_model=stt_model,
            stt_mode=stt_mode,
            llm_model=llm_model,
            tts_provider=tts_provider,
            tts_model=tts_model,
            tts_mode=tts_mode,
            warmup_iterations=warmup_iterations,
            reference_text=reference_text,
            stt_confidence=stt_confidence,
            stt_latency_ms=stt_latency_ms,
            server_final_timestamp_ms=server_final_timestamp_ms,
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


# ============================================================================
# Streaming STT WebSocket
# ============================================================================


@router.websocket("/ws/stt/stream")
async def websocket_stt_stream(websocket: WebSocket):
    """WebSocket endpoint for streaming STT.
    
    Protocol:
    1. Client sends config JSON: {"model": "chirp_3", "language": "en-US", ...}
    2. Client sends binary audio frames
    3. Server sends JSON results: {"type": "interim"|"final", "transcript": "...", ...}
    4. Client sends {"type": "stop"} or closes connection to end
    """
    import json
    import asyncio
    from app.services.conversation.streaming_stt_service import StreamingSTTSession

    await websocket.accept()
    logger.info("Streaming STT WebSocket connected")

    try:
        # 1. Receive config message
        config_msg = await websocket.receive_text()
        config = json.loads(config_msg)
        
        model = config.get("model", "chirp_3")
        language = config.get("language", "en-US")
        interim = config.get("interim_results", True)
        speech_end_timeout = config.get("speech_end_timeout", 5.0)
        phrase_hints = config.get("phrase_hints")
        enable_word_confidence = config.get("enable_word_confidence", False)
        sample_rate = config.get("sample_rate", 48000)

        logger.info(f"Streaming STT config: model={model}, lang={language}, sample_rate={sample_rate}")

        # 2. Shared audio queue — WebSocket reader pushes chunks, gRPC sessions consume
        audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        stop_received = False

        async def ws_audio_reader():
            """Read audio from WebSocket and push to shared queue."""
            nonlocal stop_received
            chunk_count = 0
            while True:
                try:
                    message = await asyncio.wait_for(
                        websocket.receive(), timeout=1.0
                    )
                    if "bytes" in message and message["bytes"]:
                        chunk_count += 1
                        if chunk_count == 1:
                            logger.info(f"WS STT: first audio chunk received ({len(message['bytes'])} bytes)")
                        elif chunk_count % 50 == 0:
                            logger.info(f"WS STT: {chunk_count} audio chunks received")
                        await audio_queue.put(message["bytes"])
                    elif "text" in message and message["text"]:
                        data = json.loads(message["text"])
                        if data.get("type") == "stop":
                            logger.info(f"WS STT: stop received after {chunk_count} chunks")
                            stop_received = True
                            await audio_queue.put(None)  # Signal end
                            return
                except asyncio.TimeoutError:
                    continue
                except WebSocketDisconnect:
                    logger.info(f"WS STT: disconnected after {chunk_count} chunks")
                    stop_received = True
                    await audio_queue.put(None)
                    return

        # Start WebSocket reader as background task
        reader_task = asyncio.create_task(ws_audio_reader())

        # 3. Stream results with auto-restart on is_final
        # Each gRPC session ends after is_final, so we create new ones for subsequent utterances
        try:
            while not stop_received:
                async def session_audio_generator():
                    """Yield audio chunks from shared queue for one gRPC session."""
                    while True:
                        try:
                            chunk = await asyncio.wait_for(audio_queue.get(), timeout=2.0)
                            if chunk is None:
                                return  # Stop signal
                            yield chunk
                        except asyncio.TimeoutError:
                            if stop_received:
                                return
                            continue

                session = StreamingSTTSession(
                    model=model,
                    language_code=language,
                    interim_results=interim,
                    speech_end_timeout_sec=speech_end_timeout,
                    phrase_hints=phrase_hints,
                    enable_word_confidence=enable_word_confidence,
                    sample_rate=sample_rate,
                )

                got_final = False
                async for result in session.stream(session_audio_generator()):
                    await websocket.send_json(result)
                    if result.get("is_final"):
                        got_final = True

                if not got_final or stop_received:
                    break
                logger.info("WS STT: session ended with is_final, starting new session for next utterance")

        finally:
            reader_task.cancel()
            try:
                await reader_task
            except asyncio.CancelledError:
                pass

        await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("Streaming STT WebSocket disconnected")
    except Exception as e:
        logger.error(f"Streaming STT error: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ============================================================================
# Narrative Sync v0.2 — Pipeline Endpoints
# ============================================================================


@router.get("/sessions/{session_id}/pipeline-logs")
async def get_pipeline_logs(
    db: DbSession,
    session_id: UUID,
    module: str | None = Query(None, description="Filter by module: evaluator, planner, conductor"),
    trace_id: str | None = Query(None, description="Filter by trace_id"),
):
    """Get pipeline execution logs for a session.

    Returns Evaluator/Planner/Conductor execution records with
    I/O JSON, duration, and model info.
    """
    from sqlalchemy import select
    from app.models.pipeline_log import PipelineLog

    stmt = select(PipelineLog).where(
        PipelineLog.session_id == session_id
    ).order_by(PipelineLog.created_at.asc())

    if module:
        stmt = stmt.where(PipelineLog.module_name == module)
    if trace_id:
        stmt = stmt.where(PipelineLog.trace_id == trace_id)

    result = await db.execute(stmt)
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "trace_id": log.trace_id,
                "session_id": str(log.session_id),
                "turn_index": log.turn_index,
                "module_name": log.module_name,
                "schema_version": log.schema_version,
                "input_json": log.input_json,
                "output_json": log.output_json,
                "duration_ms": log.duration_ms,
                "model_name": log.model_name,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": len(logs),
    }


@router.get("/templates/{template_id}/prompts")
async def get_template_prompts(
    db: DbSession,
    template_id: UUID,
):
    """Get all prompts for a template (basic + v0.2 modules)."""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")

    return {
        "pipeline_mode": getattr(template, "pipeline_mode", "basic") or "basic",
        "basic_prompt": template.director_system_prompt,
        "evaluator_prompt": getattr(template, "evaluator_prompt", None),
        "planner_prompt": getattr(template, "planner_prompt", None),
        "conductor_prompt": getattr(template, "conductor_prompt", None),
        "evaluator_llm_model": getattr(template, "evaluator_llm_model", None),
        "planner_llm_model": getattr(template, "planner_llm_model", None),
        "conductor_llm_model": getattr(template, "conductor_llm_model", None),
        "level_definitions": getattr(template, "level_definitions", None),
    }


@router.put("/templates/{template_id}/prompts")
async def update_template_prompts(
    db: DbSession,
    template_id: UUID,
    data: dict,
):
    """Update prompts for a template.

    Body: { pipeline_mode?, basic_prompt?, evaluator_prompt?, planner_prompt?, conductor_prompt?,
            evaluator_llm_model?, planner_llm_model?, conductor_llm_model?, level_definitions? }
    """
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")

    if "pipeline_mode" in data:
        template.pipeline_mode = data["pipeline_mode"]
    if "basic_prompt" in data:
        template.director_system_prompt = data["basic_prompt"]
    if "evaluator_prompt" in data:
        template.evaluator_prompt = data["evaluator_prompt"]
    if "planner_prompt" in data:
        template.planner_prompt = data["planner_prompt"]
    if "conductor_prompt" in data:
        template.conductor_prompt = data["conductor_prompt"]
    if "evaluator_llm_model" in data:
        template.evaluator_llm_model = data["evaluator_llm_model"]
    if "planner_llm_model" in data:
        template.planner_llm_model = data["planner_llm_model"]
    if "conductor_llm_model" in data:
        template.conductor_llm_model = data["conductor_llm_model"]
    if "level_definitions" in data:
        template.level_definitions = data["level_definitions"]

    await db.commit()

    return {
        "success": True,
        "pipeline_mode": template.pipeline_mode,
    }


@router.get("/pipeline/evaluator-prompt-spec")
async def get_evaluator_prompt_spec():
    """Get the default Evaluator base prompt for reference."""
    from app.services.conversation.evaluator_service import EVALUATOR_BASE_PROMPT
    return {"base_prompt": EVALUATOR_BASE_PROMPT}


@router.get("/pipeline/conductor-prompt-spec")
async def get_conductor_prompt_spec():
    """Get the default Conductor base prompt for reference."""
    from app.services.conversation.conductor_service import CONDUCTOR_BASE_PROMPT
    return {"base_prompt": CONDUCTOR_BASE_PROMPT}


@router.get("/templates/{template_id}/prompt-history")
async def get_template_prompt_history(
    db: DbSession,
    template_id: UUID,
    module: str | None = None,
):
    """Get historical prompt versions used in sessions of a template.

    Returns distinct prompts per module, ordered by most recent usage.
    Optional filter by module name (evaluator, planner, conductor).
    """
    from sqlalchemy import select, text
    from app.models.pipeline_log import PipelineLog
    from app.models.conversation import ConversationSession

    query = text("""
        SELECT DISTINCT ON (pl.module_name, md5(pl.prompt_used))
            pl.module_name,
            pl.prompt_used,
            pl.model_name,
            pl.created_at,
            pl.session_id
        FROM pipeline_logs pl
        JOIN conversation_sessions cs ON pl.session_id = cs.id
        WHERE cs.template_id = :template_id
          AND pl.prompt_used IS NOT NULL
          AND pl.prompt_used != ''
          {module_filter}
        ORDER BY pl.module_name, md5(pl.prompt_used), pl.created_at DESC
    """.replace("{module_filter}", "AND pl.module_name = :module" if module else ""))

    params = {"template_id": str(template_id)}
    if module:
        params["module"] = module

    result = await db.execute(query, params)
    rows = result.fetchall()

    history = []
    for row in rows:
        history.append({
            "module_name": row[0],
            "prompt_used": row[1],
            "model_name": row[2],
            "used_at": row[3].isoformat() if row[3] else None,
            "session_id": str(row[4]) if row[4] else None,
        })

    return {"items": history, "total": len(history)}


# ============================================================================
# Session Observation Endpoints
# ============================================================================


@router.get(
    "/sessions/{session_id}/observation",
    response_model=SessionObservationResponse,
)
async def get_session_observation(
    session_id: UUID,
    db: DbSession,
) -> dict:
    """세션 관찰 데이터 조회."""
    from app.services.conversation.observation_service import ObservationService

    service = ObservationService(db)
    obs = await service.get_observation(session_id)
    if not obs:
        raise HTTPException(
            status_code=404,
            detail="Observation not found. Session may not be completed yet.",
        )
    return _build_observation_response(obs)


@router.post(
    "/sessions/{session_id}/observation/generate",
    response_model=SessionObservationResponse,
)
async def generate_session_observation(
    session_id: UUID,
    db: DbSession,
) -> dict:
    """관찰 데이터 수동 생성/재생성 (Layer 1+2)."""
    from app.services.conversation.observation_service import ObservationService

    service = ObservationService(db)
    try:
        obs = await service.generate_observation(session_id)
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _build_observation_response(obs)


def _build_observation_response(obs: object) -> dict:
    """SessionObservation ORM 인스턴스 → API 응답 dict 변환."""
    from app.schemas.observation import ObservationLayer1, ObservationLayer2, ObservationLayer3

    has_layer3 = obs.learning_behavior_summary is not None
    return {
        "id": obs.id,
        "session_id": obs.session_id,
        "account_id": obs.account_id,
        "layer1": ObservationLayer1(
            session_duration_sec=obs.session_duration_sec,
            total_user_turns=obs.total_user_turns or 0,
            total_ai_turns=obs.total_ai_turns or 0,
            avg_user_utterance_length=obs.avg_user_utterance_length,
            max_user_utterance_length=obs.max_user_utterance_length,
            min_user_utterance_length=obs.min_user_utterance_length,
            utterance_length_trend=obs.utterance_length_trend,
            avg_user_response_interval_sec=obs.avg_user_response_interval_sec,
            short_reply_count=obs.short_reply_count or 0,
            silence_timeout_count=obs.silence_timeout_count or 0,
            first_user_response_time_sec=obs.first_user_response_time_sec,
            completion_status=obs.completion_status,
            word_count_per_turn=obs.word_count_per_turn,
            long_latency_turn_count=obs.long_latency_turn_count or 0,
            long_latency_turn_ratio=obs.long_latency_turn_ratio,
            long_gap_count=obs.long_gap_count or 0,
            followup_after_short_answer=obs.followup_after_short_answer or 0,
        ),
        "layer2": ObservationLayer2(
            avg_overall_score=obs.avg_overall_score,
            score_trend=obs.score_trend,
            level_progression=obs.level_progression,
            max_level_reached=obs.max_level_reached,
            level_up_count=obs.level_up_count or 0,
            level_down_count=obs.level_down_count or 0,
            primary_issues=obs.primary_issues,
            correction_count=obs.correction_count or 0,
            fluency_wpm_trend=obs.fluency_wpm_trend,
            template_specific_data=obs.template_specific_data,
        ),
        "layer3": ObservationLayer3(
            learning_behavior_summary=obs.learning_behavior_summary,
            engagement_level=obs.engagement_level,
            key_learning_points=obs.key_learning_points,
            struggle_points=obs.struggle_points,
            communication_style=obs.communication_style,
            topic_maintenance_score=obs.topic_maintenance_score,
            question_back_count=obs.question_back_count,
            natural_conversation_score=obs.natural_conversation_score,
            improvement_suggestions=obs.improvement_suggestions,
            elaboration_adequacy=obs.elaboration_adequacy,
            explicit_clarification_analysis=obs.explicit_clarification_analysis,
            response_start_quality=obs.response_start_quality,
            response_start_quality_detail=obs.response_start_quality_detail,
            flow_maintenance=obs.flow_maintenance,
            flow_maintenance_detail=obs.flow_maintenance_detail,
            coping_attempt=obs.coping_attempt,
            clarification_success=obs.clarification_success,
            avoidance_vs_response=obs.avoidance_vs_response,
        ),
        "generated_at": obs.generated_at,
        "reporting_llm_model": obs.reporting_llm_model,
        "reporting_llm_duration_ms": obs.reporting_llm_duration_ms,
        "has_layer3": has_layer3,
    }


# ============================================================================
# Layer 3: Reporting LLM 수동 트리거
# ============================================================================


@router.post(
    "/sessions/{session_id}/observation/analyze",
    response_model=SessionObservationResponse,
)
async def analyze_session_observation(
    session_id: UUID,
    db: DbSession,
) -> dict:
    """Layer 3 AI 분석 실행 (수동 트리거).

    Layer 1+2가 먼저 생성되어 있어야 합니다.
    없으면 자동으로 Layer 1+2를 먼저 생성한 후 분석합니다.
    """
    from app.services.conversation.observation_service import ObservationService
    from app.services.conversation.reporting_llm_service import ReportingLLMService

    # Layer 1+2가 존재하는지 확인 — 없으면 자동 생성
    obs_service = ObservationService(db)
    obs = await obs_service.get_observation(session_id)
    if not obs:
        try:
            obs = await obs_service.generate_observation(session_id)
            await db.commit()
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    # Layer 3 분석 실행
    reporting_service = ReportingLLMService(db)
    try:
        await reporting_service.analyze_session(session_id)
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Layer 3 analysis failed for {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}",
        )

    # 업데이트된 관찰 데이터 반환
    obs = await obs_service.get_observation(session_id)
    return _build_observation_response(obs)


# ============================================================================
# Reporting LLM 프롬프트 관리
# ============================================================================


@router.get("/reporting-prompt")
async def get_active_reporting_prompt(db: DbSession) -> dict:
    """현재 활성 Reporting LLM 프롬프트 조회."""
    from sqlalchemy import select as _select
    from app.models.reporting_prompt_setting import ReportingPromptSetting
    from app.services.conversation.reporting_llm_service import DEFAULT_SYSTEM_PROMPT

    result = await db.execute(
        _select(ReportingPromptSetting)
        .where(ReportingPromptSetting.is_active.is_(True))
        .order_by(ReportingPromptSetting.updated_at.desc())
        .limit(1)
    )
    prompt = result.scalar_one_or_none()

    if not prompt:
        # DB 프롬프트 없음 — is_default=True, system_prompt=null
        # UI는 null을 보고 /reporting-prompt/default를 호출해서 비교 표시.
        # 실제 프롬프트 텍스트는 /reporting-prompt/default에서만 제공.
        return {
            "id": None,
            "name": "기본 프롬프트 (코드 내장)",
            "system_prompt": None,
            "llm_model": "gemini-3.1-pro-preview",
            "temperature": "0.3",
            "is_active": True,
            "is_default": True,
        }
    return {
        "id": str(prompt.id),
        "name": prompt.name,
        "system_prompt": prompt.system_prompt,
        "llm_model": prompt.llm_model,
        "temperature": prompt.temperature,
        "is_active": prompt.is_active,
        "is_default": False,
        "created_at": prompt.created_at.isoformat() if prompt.created_at else None,
        "updated_at": prompt.updated_at.isoformat() if prompt.updated_at else None,
    }


@router.put("/reporting-prompt")
async def update_reporting_prompt(db: DbSession, body: dict) -> dict:
    """Reporting LLM 프롬프트 업데이트 (새 버전 생성).

    기존 활성 프롬프트를 비활성화하고 새 프롬프트를 활성 상태로 생성합니다.
    """
    from sqlalchemy import select as _select
    from app.models.reporting_prompt_setting import ReportingPromptSetting

    system_prompt = body.get("system_prompt", "")
    if not system_prompt or not system_prompt.strip():
        raise HTTPException(status_code=400, detail="system_prompt is required")

    # 기존 활성 프롬프트 비활성화
    existing = await db.execute(
        _select(ReportingPromptSetting)
        .where(ReportingPromptSetting.is_active.is_(True))
    )
    for row in existing.scalars().all():
        row.is_active = False

    # 새 프롬프트 생성
    new_prompt = ReportingPromptSetting(
        name=body.get("name", "사용자 정의 프롬프트"),
        system_prompt=system_prompt.strip(),
        llm_model=body.get("llm_model", "gemini-2.5-pro"),
        temperature=str(body.get("temperature", "0.3")),
        is_active=True,
    )
    db.add(new_prompt)
    await db.commit()
    await db.refresh(new_prompt)

    return {
        "id": str(new_prompt.id),
        "name": new_prompt.name,
        "llm_model": new_prompt.llm_model,
        "is_active": True,
        "message": "프롬프트가 업데이트되었습니다",
    }


@router.get("/reporting-prompt/history")
async def get_reporting_prompt_history(db: DbSession) -> dict:
    """Reporting LLM 프롬프트 버전 이력 조회."""
    from sqlalchemy import select as _select
    from app.models.reporting_prompt_setting import ReportingPromptSetting

    result = await db.execute(
        _select(ReportingPromptSetting)
        .order_by(ReportingPromptSetting.created_at.desc())
        .limit(20)
    )
    prompts = result.scalars().all()
    return {
        "items": [
            {
                "id": str(p.id),
                "name": p.name,
                "llm_model": p.llm_model,
                "temperature": p.temperature,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in prompts
        ],
        "total": len(prompts),
    }


@router.get("/reporting-prompt/default")
async def get_default_reporting_prompt() -> dict:
    """코드 내장 기본 프롬프트 텍스트를 반환. Admin UI에서 리셋 시 사용."""
    from app.services.conversation.reporting_llm_service import DEFAULT_SYSTEM_PROMPT

    return {
        "system_prompt": DEFAULT_SYSTEM_PROMPT,
        "llm_model": "gemini-3.1-pro-preview",
        "temperature": "0.3",
    }


# ============================================================================
# Excel Export
# ============================================================================


@router.get("/sessions/{session_id}/export/observation-excel")
async def export_observation_excel(
    session_id: UUID,
    db: DbSession,
):
    """관찰 데이터를 Excel로 내보내기 (다중 시트).

    시트 구성:
    - 개요: Layer 1+2 전체 메트릭
    - 턴별 상세: 대화 + Pipeline 데이터
    - AI 분석 보고서: Layer 3 (있는 경우)
    """
    import io

    import openpyxl
    from fastapi.responses import StreamingResponse
    from sqlalchemy import select

    from app.models.conversation import ConversationTurn
    from app.models.pipeline_log import PipelineLog
    from app.services.conversation.observation_service import ObservationService

    obs_service = ObservationService(db)
    obs = await obs_service.get_observation(session_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found. Generate it first.")

    # 턴 데이터 조회
    turns_result = await db.execute(
        select(ConversationTurn)
        .where(ConversationTurn.session_id == session_id)
        .order_by(ConversationTurn.turn_index)
    )
    turns = list(turns_result.scalars().all())

    # Pipeline 로그 조회
    pipeline_result = await db.execute(
        select(PipelineLog)
        .where(PipelineLog.session_id == session_id)
        .order_by(PipelineLog.turn_index)
    )
    pipeline_logs = list(pipeline_result.scalars().all())

    # Excel 생성
    wb = openpyxl.Workbook()

    ws_overview = wb.active
    ws_overview.title = "개요"
    _write_overview_sheet(ws_overview, obs)

    ws_turns = wb.create_sheet("턴별 상세")
    _write_turns_sheet(ws_turns, turns, pipeline_logs)

    if obs.learning_behavior_summary:
        ws_analysis = wb.create_sheet("AI 분석 보고서")
        _write_analysis_sheet(ws_analysis, obs)

    # Pipeline 상세 시트 (v0.2 세션에만 의미 있음)
    if pipeline_logs:
        ws_pipeline = wb.create_sheet("Pipeline 상세")
        _write_pipeline_detail_sheet(ws_pipeline, turns, pipeline_logs)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    date_str = obs.generated_at.strftime("%Y%m%d") if obs.generated_at else "unknown"
    filename = f"observation_{str(session_id)[:8]}_{date_str}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _write_overview_sheet(ws, obs) -> None:
    """개요 시트 — Layer 1+2 전체 메트릭."""
    from openpyxl.styles import Font

    _append_row(ws, ["=== Layer 1: Rule-Based 메트릭 ==="])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)

    metrics_l1 = [
        ("세션 시간 (초)", obs.session_duration_sec),
        ("총 사용자 턴", obs.total_user_turns),
        ("총 AI 턴", obs.total_ai_turns),
        ("평균 발화 길이 (단어)", obs.avg_user_utterance_length),
        ("최대 발화 길이", obs.max_user_utterance_length),
        ("최소 발화 길이", obs.min_user_utterance_length),
        ("발화 길이 추이", obs.utterance_length_trend),
        ("평균 응답 간격 (초)", obs.avg_user_response_interval_sec),
        ("짧은 답변 수 (≤3단어)", obs.short_reply_count),
        ("침묵 타임아웃 수", obs.silence_timeout_count),
        ("첫 응답 시간 (초)", obs.first_user_response_time_sec),
        ("완료 상태", obs.completion_status),
        ("높은 레이턴시 턴 수", obs.long_latency_turn_count),
        ("높은 레이턴시 비율", obs.long_latency_turn_ratio),
        ("긴 간격 수 (>5초)", obs.long_gap_count),
        ("짧은 답변 후 개선 횟수", obs.followup_after_short_answer),
    ]
    for label, value in metrics_l1:
        _append_row(ws, [label, value])

    _append_row(ws, [])
    _append_row(ws, ["=== Layer 2: Pipeline 집계 ==="])
    ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)

    metrics_l2 = [
        ("평균 Overall Score", obs.avg_overall_score),
        ("점수 추이", obs.score_trend),
        ("최고 도달 레벨", obs.max_level_reached),
        ("레벨 업 횟수", obs.level_up_count),
        ("레벨 다운 횟수", obs.level_down_count),
        ("교정 횟수", obs.correction_count),
        ("핵심 이슈 TOP 3", ", ".join(obs.primary_issues) if obs.primary_issues else None),
    ]
    for label, value in metrics_l2:
        _append_row(ws, [label, value])

    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 25


def _write_turns_sheet(ws, turns, pipeline_logs) -> None:
    """턴별 상세 시트."""
    import openpyxl.utils
    from openpyxl.styles import Alignment, Font, PatternFill

    headers = [
        "턴#", "유형", "화자", "발화 내용", "단어 수", "응답 간격(초)",
        "E2E(ms)", "Evaluator 점수", "주요 이슈", "레벨", "Path",
        "교정", "더 나은 표현",
    ]
    _append_row(ws, headers)
    fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    font = Font(bold=True, color="FFFFFF")
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center")

    eval_by_turn: dict = {}
    plan_by_turn: dict = {}
    cond_by_turn: dict = {}
    for log in pipeline_logs:
        if not log.output_json:
            continue
        if log.module_name == "evaluator":
            eval_by_turn[log.turn_index] = log.output_json
        elif log.module_name == "planner":
            plan_by_turn[log.turn_index] = log.output_json
        elif log.module_name == "conductor":
            cond_by_turn[log.turn_index] = log.output_json

    for t in turns:
        word_count = len(t.content_text.split()) if t.content_text else 0
        response_interval = None
        if t.t_first_speech and t.t_recording_start and t.t_first_speech >= t.t_recording_start:
            response_interval = round((t.t_first_speech - t.t_recording_start) / 1000.0, 2)

        e2e_ms = None
        if t.t0_user_end and t.t3_audio_play_start:
            e2e_ms = round(t.t3_audio_play_start - t.t0_user_end, 0)

        eval_data = eval_by_turn.get(t.turn_index, {})
        plan_data = plan_by_turn.get(t.turn_index, {})
        cond_data = cond_by_turn.get(t.turn_index, {})

        eval_score = eval_data.get("aggregate", {}).get("overall_score") if isinstance(eval_data, dict) else None
        primary_issue = eval_data.get("diagnosis", {}).get("primary_issue") if isinstance(eval_data, dict) else None
        level = plan_data.get("persona_plan", {}).get("current_level") if isinstance(plan_data, dict) else None
        path = plan_data.get("decision", {}).get("path") if isinstance(plan_data, dict) else None
        corrections = ", ".join(cond_data.get("corrections", [])) if isinstance(cond_data, dict) else None
        better_expr = ", ".join(cond_data.get("better_expressions", [])) if isinstance(cond_data, dict) else None

        turn_type_str = t.turn_type.value if hasattr(t.turn_type, "value") else str(t.turn_type)

        _append_row(ws, [
            t.turn_index,
            turn_type_str,
            t.speaker_name or "",
            t.content_text or "",
            word_count if turn_type_str == "user" else None,
            response_interval,
            e2e_ms,
            eval_score,
            primary_issue,
            level,
            path,
            corrections,
            better_expr,
        ])

    widths = [6, 10, 12, 50, 8, 12, 10, 10, 12, 18, 8, 14, 30, 30]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w


def _write_pipeline_detail_sheet(ws, turns, pipeline_logs) -> None:
    """Pipeline 상세 시트 — turn-by-turn Evaluator/Planner/Conductor 전체 데이터."""
    import json
    import openpyxl.utils
    from openpyxl.styles import Alignment, Font, PatternFill

    # ── 헤더 ──
    headers = [
        # 기본
        "턴#", "유형", "발화 내용", "단어 수", "WPM",
        # Evaluator
        "종합 점수", "개념 추출(A)", "핵심 동사(B)", "확장(C)",
        "모방 점수", "복잡도", "slot_avg",
        "주요 이슈", "보조 이슈", "권장 액션",
        # Planner
        "레벨(전)", "레벨(후)", "Path", "이유",
        "연속 고점 횟수",
        # Conductor
        "교정 표현", "더 나은 표현", "피드백",
        # 타이밍
        "t_recording_start", "t_first_speech", "Δfirst_speech(s)", "t0_user_end", "Δuser_end(s)", "E2E(ms)",
    ]
    _append_row(ws, headers)

    # 헤더 스타일
    fill_eval = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    fill_plan = PatternFill(start_color="70AD47", end_color="70AD47", fill_type="solid")
    fill_cond = PatternFill(start_color="ED7D31", end_color="ED7D31", fill_type="solid")
    fill_time = PatternFill(start_color="9E480E", end_color="9E480E", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")

    col_ranges = {
        "base": range(1, 6),        # A–E (기본)
        "eval": range(6, 16),       # F–O (Evaluator)
        "plan": range(16, 21),      # P–T (Planner)
        "cond": range(21, 24),      # U–W (Conductor)
        "time": range(24, 28),      # X–AA (타이밍)
    }
    fills = {
        "base": PatternFill(start_color="2F3E46", end_color="2F3E46", fill_type="solid"),
        "eval": fill_eval, "plan": fill_plan, "cond": fill_cond, "time": fill_time,
    }
    for group, cols in col_ranges.items():
        for col in cols:
            cell = ws.cell(row=1, column=col)
            cell.fill = fills[group]
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

    # ── Pipeline 인덱싱 ──
    eval_by_turn: dict = {}
    plan_by_turn: dict = {}
    cond_by_turn: dict = {}
    for log in pipeline_logs:
        if not log.output_json:
            continue
        if log.module_name == "evaluator":
            eval_by_turn[log.turn_index] = log.output_json
        elif log.module_name == "planner":
            plan_by_turn[log.turn_index] = log.output_json
        elif log.module_name == "conductor":
            cond_by_turn[log.turn_index] = log.output_json

    # ── 이전 레벨 추적 (level before) ──
    prev_level_map: dict[int, int] = {}
    sorted_ti = sorted(plan_by_turn.keys())
    running_level = 1
    for ti in sorted_ti:
        prev_level_map[ti] = running_level
        pd = plan_by_turn[ti]
        if isinstance(pd, dict):
            new_lv = pd.get("persona_plan", {}).get("current_level") or running_level
            running_level = new_lv

    # ── 행 작성 ──
    for t in turns:
        turn_type_str = t.turn_type.value if hasattr(t.turn_type, "value") else str(t.turn_type)
        word_count = len(t.content_text.split()) if t.content_text else 0

        e2e_ms = None
        if t.t0_user_end and t.t3_audio_play_start:
            e2e_ms = round(t.t3_audio_play_start - t.t0_user_end, 0)

        ed = eval_by_turn.get(t.turn_index, {}) if isinstance(eval_by_turn.get(t.turn_index), dict) else {}
        pd = plan_by_turn.get(t.turn_index, {}) if isinstance(plan_by_turn.get(t.turn_index), dict) else {}
        cd = cond_by_turn.get(t.turn_index, {}) if isinstance(cond_by_turn.get(t.turn_index), dict) else {}

        # Evaluator
        agg = ed.get("aggregate", {})
        ns = ed.get("narrative_scores", {})
        fl = ed.get("fluency", {})
        diag = ed.get("diagnosis", {})

        slot_a = ns.get("slot_a", {}).get("score") if isinstance(ns.get("slot_a"), dict) else None
        slot_b = ns.get("slot_b", {}).get("score") if isinstance(ns.get("slot_b"), dict) else None
        slot_c = ns.get("slot_c", {}).get("score") if isinstance(ns.get("slot_c"), dict) else None
        wpm = fl.get("words_per_minute") if isinstance(fl, dict) else None
        secondary = ", ".join(diag.get("secondary_issues", [])) if isinstance(diag, dict) else None

        # Planner
        dec = pd.get("decision", {})
        pp = pd.get("persona_plan", {})
        level_before = prev_level_map.get(t.turn_index)
        level_after = pp.get("current_level") if isinstance(pp, dict) else None
        path = dec.get("path") if isinstance(dec, dict) else None
        reasons_raw = dec.get("reason", []) if isinstance(dec, dict) else []
        reasons_str = " | ".join(str(r) for r in reasons_raw) if reasons_raw else None

        # consecutive_high_scores: reason 텍스트에서 추출 or 0
        consec = None
        for r in (reasons_raw or []):
            if "streak=" in str(r):
                try:
                    consec = int(str(r).split("streak=")[1].split()[0])
                except Exception:
                    pass

        # Conductor
        corr = ", ".join(cd.get("corrections", [])) if isinstance(cd, dict) else None
        better = ", ".join(cd.get("better_expressions", [])) if isinstance(cd, dict) else None
        feedback = cd.get("feedback_text", "")[:200] if isinstance(cd, dict) else None

        formatted_recording_start = _format_timestamp_ms(t.t_recording_start)
        formatted_first_speech = _format_timestamp_ms(t.t_first_speech)
        formatted_user_end = _format_timestamp_ms(t.t0_user_end)
        relative_first_speech = _relative_seconds(t.t_recording_start, t.t_first_speech)
        relative_user_end = _relative_seconds(t.t_recording_start, t.t0_user_end)

        row = [
            t.turn_index, turn_type_str, t.content_text or "", word_count,
            wpm,
            # Evaluator
            agg.get("overall_score") if isinstance(agg, dict) else None,
            slot_a, slot_b, slot_c,
            agg.get("imitation_score") if isinstance(agg, dict) else None,
            agg.get("complexity_score") if isinstance(agg, dict) else None,
            agg.get("slot_avg") if isinstance(agg, dict) else None,
            diag.get("primary_issue") if isinstance(diag, dict) else None,
            secondary,
            diag.get("recommended_action") if isinstance(diag, dict) else None,
            # Planner
            level_before, level_after, path, reasons_str, consec,
            # Conductor
            corr, better, feedback,
            # Timing
            formatted_recording_start,
            formatted_first_speech,
            relative_first_speech,
            formatted_user_end,
            relative_user_end,
            e2e_ms,
        ]
        _append_row(ws, row)

        # 행 배경 (user 턴 강조)
        if turn_type_str == "user":
            row_fill = PatternFill(start_color="EBF3FB", end_color="EBF3FB", fill_type="solid")
            for col in range(1, len(headers) + 1):
                ws.cell(row=ws.max_row, column=col).fill = row_fill

    # 컬럼 폭
    widths2 = [
        6, 8, 45, 8, 8,          # base
        10, 8, 8, 8, 8, 8, 8,    # eval scores
        18, 20, 16,              # eval diagnosis
        8, 8, 14, 50, 8,         # planner
        25, 25, 40,              # conductor
        16, 16, 12, 16, 12, 10,  # timing
    ]
    for i, w in enumerate(widths2, 1):
        if i <= len(headers):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

    # 행 래핑
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=False, vertical="top")



def _write_analysis_sheet(ws, obs) -> None:
    """AI 분석 보고서 시트 (Layer 3)."""
    from openpyxl.styles import Font

    bold = Font(bold=True, size=11)

    sections = [
        ("학습 행동 요약", obs.learning_behavior_summary),
        ("참여도", obs.engagement_level),
        ("대화 스타일", obs.communication_style),
        ("주제 유지율", obs.topic_maintenance_score),
        ("자연스러움 점수", obs.natural_conversation_score),
        ("되묻기 횟수", obs.question_back_count),
        ("반응 시작 품질", obs.response_start_quality),
        ("흐름 유지", obs.flow_maintenance),
    ]
    for label, value in sections:
        _append_row(ws, [label, str(value) if value is not None else "-"])
        ws.cell(row=ws.max_row, column=1).font = bold

    _append_row(ws, [])

    if obs.key_learning_points:
        _append_row(ws, ["=== 핵심 학습 포인트 ==="])
        ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)
        for point in obs.key_learning_points:
            _append_row(ws, ["•", point])

    _append_row(ws, [])

    if obs.struggle_points:
        _append_row(ws, ["=== 어려움 포인트 ==="])
        ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)
        for point in obs.struggle_points:
            _append_row(ws, ["•", point])

    _append_row(ws, [])

    if obs.improvement_suggestions:
        _append_row(ws, ["=== 개선 제안 ==="])
        ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)
        for sug in obs.improvement_suggestions:
            _append_row(ws, ["•", sug])

    _append_row(ws, [])

    if obs.elaboration_adequacy and isinstance(obs.elaboration_adequacy, dict):
        _append_row(ws, ["=== 상세도 적정성 분석 ==="])
        ws.cell(row=ws.max_row, column=1).font = Font(bold=True, size=12)
        _append_row(ws, ["전체 점수", obs.elaboration_adequacy.get("overall_score")])
        _append_row(ws, ["추이", obs.elaboration_adequacy.get("trend")])
        _append_row(ws, [])
        if obs.elaboration_adequacy.get("evaluated_turns"):
            _append_row(ws, ["턴#", "질문 유형", "가중치", "단어 수", "점수", "판정", "피드백"])
            for et in obs.elaboration_adequacy["evaluated_turns"]:
                if isinstance(et, dict):
                    _append_row(ws, [
                        et.get("turn_index"),
                        et.get("question_type"),
                        et.get("question_weight"),
                        et.get("word_count"),
                        et.get("elaboration_score"),
                        et.get("judgment"),
                        et.get("feedback"),
                    ])

    ws.column_dimensions["A"].width = 25
    ws.column_dimensions["B"].width = 60
