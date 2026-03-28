"""
My Turn Service.

This module orchestrates the "My Turn" conversation flow.
It handles session initialization, user input processing, and AI response generation.
"""

import asyncio
import logging
import time
from typing import Optional
from uuid import UUID

from app.api.deps import DbSession
from app.models.conversation import ConversationSession, ParticipantType, SessionStatus, TurnType
from app.services.conversation.session_service import SessionService
from app.services.conversation.turn_orchestrator import TurnOrchestrator
from app.services.conversation.signaling import manager
from app.services.conversation.scenario_director import ScenarioDirector
from fastapi import BackgroundTasks
import json
from sqlalchemy import select, update

logger = logging.getLogger(__name__)

# Safety limit to prevent infinite AI-to-AI loops
MAX_CONSECUTIVE_AI_TURNS = 10


def detect_mentioned_participant(text: str, participants, exclude_speaker_name: str = None):
    """Detect if text mentions a specific participant by name.
    
    Scans the text for participant names (sorted by length descending to avoid
    partial matches like "Min" matching before "Min Kyung").
    Excludes user-type participants (addressing the user is default behavior).
    Excludes the current speaker (can't mention yourself).
    
    Returns the mentioned participant or None.
    """
    if not text or not participants:
        return None
    
    # Filter: non-user participants, exclude current speaker
    candidates = [
        p for p in participants
        if p.participant_type != ParticipantType.USER
        and p.name != exclude_speaker_name
    ]
    
    # Sort by name length descending (longer names first to avoid partial matches)
    candidates.sort(key=lambda p: len(p.name), reverse=True)
    
    # Check the last 1-2 sentences (most likely to contain the addressed participant)
    # Split by sentence-ending punctuation
    sentences = text.replace('!', '.').replace('?', '.').split('.')
    tail = '. '.join(s.strip() for s in sentences[-2:] if s.strip())
    
    for p in candidates:
        if p.name in tail:
            return p
    
    return None

async def run_ai_turn_background(session_id: UUID, participant_id: str, instruction: Optional[str] = None, return_to_user_after: bool = False, user_emotion: Optional[str] = None):
    """Background task wrapper for AI turn processing."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        service = MyTurnService(db)
        # We need to re-fetch session and participant
        session = await service.session_service.get_by_id_with_template(session_id)
        if not session:
            logger.error(f"Session {session_id} not found in background task")
            return
        
        # Find participant
        participant = next((p for p in session.template.participants if str(p.id) == participant_id), None)
        if participant:
             # HARD STOP CHECK: If session is not active, do not run AI turn
             if session.status != SessionStatus.ACTIVE:
                 logger.info(f"[run_ai_turn] Session {session_id} is {session.status}. Skipping AI turn for {participant.name}.")
                 return

             # Retry logic for AI turn processing
             max_retries = 3
             for attempt in range(max_retries):
                 try:
                     await service.process_ai_turn(session, participant, instruction, return_to_user_after=return_to_user_after, user_emotion=user_emotion)
                     break  # Success
                 except Exception as e:
                     logger.error(f"Error in background AI turn (Attempt {attempt + 1}/{max_retries}): {e}", exc_info=True)
                     if attempt == max_retries - 1:
                         # Last attempt failed
                         # TODO: Marking session as ERROR or notifying client might be better?
                         # For now, just logging error effectively.
                         logger.critical(f"Failed to process AI turn for session {session_id} after {max_retries} attempts.")
                     else:
                         import asyncio
                         await asyncio.sleep(1) # Wait 1s before retry
        else:
             logger.error(f"Participant {participant_id} not found in session {session_id}")


async def monitor_user_timeout(session_id: UUID, turn_index: int, timeout_seconds: int = 300):
    """Waits for timeout, then terminates session if still on valid turn."""
    # Use a separate DB session for the background check
    from app.core.database import AsyncSessionLocal
    
    # Initial wait
    await asyncio.sleep(timeout_seconds)
    
    try:
        async with AsyncSessionLocal() as db:
            service = MyTurnService(db)
            session = await service.session_service.get_by_id(session_id)
            
            # Check conditions: Session active AND turn index hasn't changed (user still hasn't spoken)
            if (session 
                and session.status == SessionStatus.ACTIVE 
                and session.current_turn_index == turn_index):
                
                logger.info(f"[monitor_user_timeout] Timeout reached for session {session_id} (turn {turn_index}). Auto-terminating.")
                session.status = SessionStatus.COMPLETED
                session.error_message = "Session timed out (5 minutes due to inactivity)"
                await db.commit()
                
                # Notify client
                await manager.send_message(str(session.id), {
                    "type": "error",
                    "message": "Session timed out due to inactivity."
                })
                await manager.send_message(str(session.id), {"type": "session_completed"})
    except Exception as e:
        logger.error(f"[monitor_user_timeout] Error: {e}")


async def cleanup_stale_sessions(check_interval: int = 1800):
    """Background task to periodically clean up zombie sessions."""
    logger.info(f"Starting stale session cleanup task (interval={check_interval}s, criteria: inactive > 3m AND started > 5m)")
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select, and_
    from datetime import datetime, timedelta
    
    while True:
        try:
            await asyncio.sleep(check_interval)
            
            async with AsyncSessionLocal() as db:
                now = datetime.utcnow()
                # Condition:
                # 1. Active session
                # 2. Inactive for > 3 minutes (updated_at < now - 3m)
                # 3. Started > 5 minutes ago (started_at < now - 5m) - to safeguard very fresh sessions
                
                inactive_threshold = now - timedelta(minutes=3)
                started_threshold = now - timedelta(minutes=5)
                
                stmt = select(ConversationSession).where(
                    and_(
                        ConversationSession.status == SessionStatus.ACTIVE,
                        ConversationSession.updated_at < inactive_threshold,
                        ConversationSession.started_at < started_threshold
                    )
                )
                result = await db.execute(stmt)
                stale_sessions = result.scalars().all()
                
                count = 0
                for session in stale_sessions:
                    session.status = SessionStatus.COMPLETED
                    session.error_message = f"Auto-closed by cleanup (inactive > 3m, started > 5m)"
                    count += 1
                
                if count > 0:
                    await db.commit()
                    logger.info(f"[cleanup_stale_sessions] Closed {count} zombie sessions.")
                    
        except asyncio.CancelledError:
            logger.info("Stale session cleanup task cancelled.")
            break
        except Exception as e:
            logger.error(f"[cleanup_stale_sessions] Error: {e}")
            await asyncio.sleep(60) # Wait a bit before retrying on error


async def cleanup_active_sessions_on_startup():
    """Run once on startup to mark all 'Active' sessions as 'Completed' (Server Restart)."""
    logger.info("Running startup cleanup for active sessions...")
    from app.core.database import AsyncSessionLocal
    from datetime import datetime
    
    try:
        async with AsyncSessionLocal() as db:
            stmt = (
                update(ConversationSession)
                .where(ConversationSession.status == SessionStatus.ACTIVE)
                .values(
                    status=SessionStatus.COMPLETED,
                    error_message="Session interrupted by server restart",
                    ended_at=datetime.utcnow()
                )
            )
            result = await db.execute(stmt)
            await db.commit()
            if result.rowcount > 0:
                logger.info(f"Startup Cleanup: Marked {result.rowcount} active sessions as COMPLETED.")
    except Exception as e:
        logger.error(f"Error in startup session cleanup: {e}")


class MyTurnService:
    def __init__(self, db: DbSession):
        self.db = db
        self.session_service = SessionService(db)

    async def start_session(self, session_id: UUID, user_name: str, background_tasks: BackgroundTasks = None) -> dict:
        """Starts a My Turn session and triggers the first turn."""
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session:
            raise ValueError("Session not found")

        # Update session with user name and active status
        session.user_name = user_name
        session.status = SessionStatus.ACTIVE
        await self.db.commit()

        # Initialize Orchestrator
        orchestrator = TurnOrchestrator(session, session.template)
        
        # Initialize script state in variant if template has sequence
        script_index = None
        if session.template.turn_sequence:
             script_index = 0
             try:
                 variant_data = json.loads(session.variant) if session.variant else {}
                 variant_data["current_script_index"] = 0
                 session.variant = json.dumps(variant_data)
                 # We don't commit here yet, will commit below
             except Exception as e:
                 logger.error(f"Failed to init script state: {e}")

        # Determine first turn (index -1 -> 0)
        # Use script_index if available
        next_turn_info = await orchestrator.determine_next_turn(-1, script_index=script_index)
        
        if not next_turn_info:
            logger.info(f"[MyTurnService] start_session: no next turn, session completed")
            return {"status": "completed"}

        # Update session state
        session.current_turn_index = 0
        session.current_speaker_id = next_turn_info["next_participant"].id
        session.current_speaker_type = next_turn_info["turn_type"]
        await self.db.commit()

        first_speaker = next_turn_info["next_participant"]
        logger.info(
            f"[MyTurnService] start_session: first speaker = {first_speaker.name} "
            f"(type={first_speaker.participant_type.value}, is_user_turn={next_turn_info['is_user_turn']})"
        )

        # Notify client via WebSocket
        await manager.send_message(str(session_id), {
            "type": "turn_changed",
            "turn_index": 0,
            "speaker": {
                "id": str(first_speaker.id),
                "name": first_speaker.name,
                "type": next_turn_info["turn_type"],
                "avatar_url": first_speaker.avatar_url,
            },
            "is_user_turn": next_turn_info["is_user_turn"]
        })

        # If it's AI turn, trigger AI processing (always use background task)
        if not next_turn_info["is_user_turn"]:
            if background_tasks:
                background_tasks.add_task(
                    run_ai_turn_background, 
                    session_id, 
                    str(first_speaker.id)
                )
            else:
                # WebSocket context: use asyncio.create_task for non-blocking
                logger.info(f"[MyTurnService] start_session: launching AI turn via asyncio.create_task")
                asyncio.create_task(
                    run_ai_turn_background(
                        session_id,
                        str(first_speaker.id)
                    )
                )

        return {
            "session_id": str(session_id),
            "status": "active",
            "current_turn": 0,
            "speaker": first_speaker.name
        }

    async def complete_turn(self, session_id: UUID, script_index: int = None, return_to_user_after: bool = False):
        """Advances turn index and determines next speaker."""
        # 0. Re-fetch session status to ensure active
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session:
            raise ValueError("Session not found")

        # HARD STOP CHECK
        if session.status != SessionStatus.ACTIVE:
            logger.info(f"[complete_turn] Session {session_id} is {session.status}. Stopping turn orchestration.")
            return

        # FORCE REFRESH: Ensure we have the latest variant flags commit by process_user_turn
        # This handles the case where process_user_turn updated variant but this session object is stale
        await self.db.refresh(session, attribute_names=["variant"])

        # 1. Advance Turn Index
        prev_turn_index = session.current_turn_index
        session.current_turn_index += 1
        
        logger.info(
            f"[MyTurnService] complete_turn: session={session_id}, "
            f"turn_index {prev_turn_index} → {session.current_turn_index}"
        )
        
        # 2. Determine Next Speaker
        orchestrator = TurnOrchestrator(session, session.template)
        
        # Get current script index
        variant = {}  # Initialize default
        if session.variant:
            try:
                variant = json.loads(session.variant)
                logger.info(f"[complete_turn] Loaded variant: {variant}")
            except Exception as e:
                logger.error(f"[complete_turn] Failed to parse variant: {e}")
                
        if script_index is None:
             script_index = variant.get("current_script_index")

        # Check if we should return to user (set by process_user_turn on hesitation OR explicitly passed)
        # NEW LOGIC: We check the Turn History for the :ENCOURAGEMENT tag in model_name.
        from sqlalchemy import select, desc
        from app.models.conversation import ConversationTurn
        
        last_turn_stmt = (
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session.id)
            .order_by(desc(ConversationTurn.created_at))
            .limit(1)
        )
        last_turn_res = await self.db.execute(last_turn_stmt)
        last_turn = last_turn_res.scalar_one_or_none()
        
        if last_turn:
            logger.info(f"[complete_turn] DEBUG: Last Turn ID={last_turn.id}, Index={last_turn.turn_index}, Model={last_turn.model_name}, Speaker={last_turn.speaker_name}")
        else:
            logger.info(f"[complete_turn] DEBUG: No Last Turn Found for Session {session.id}")

        was_encouragement = False
        if last_turn and last_turn.model_name and ":ENCOURAGEMENT" in last_turn.model_name:
             was_encouragement = True
             logger.info(f"[complete_turn] Detected ENCOURAGEMENT tag in model_name='{last_turn.model_name}' -> Force User Turn")
        
        should_return_to_user = return_to_user_after or was_encouragement
        
        if should_return_to_user:
            # Clear flag if needed (nothing to clear in DB history)
            pass
            
            # Find the user participant
            user_participant = None
            if session.template and session.template.participants:
                for p in sorted(session.template.participants, key=lambda x: x.order_index):
                    if p.participant_type == ParticipantType.USER:
                        user_participant = p
                        break
            
            if user_participant:
                logger.info(f"[MyTurnService] Returning turn to user after AI encouragement")
                next_turn_info = {
                    "next_participant": user_participant,
                    "turn_type": "user",
                    "is_user_turn": True
                }
            else:
                # Fallback to normal orchestration
                next_turn_info = await orchestrator.determine_next_turn(
                    session.current_turn_index - 1,
                    script_index=script_index
                )
        else:
            next_turn_info = await orchestrator.determine_next_turn(
                session.current_turn_index - 1, # Pass the index of the turn that just finished
                script_index=script_index
            )
        

        if next_turn_info:
            next_participant = next_turn_info["next_participant"]
            is_user_turn = next_turn_info["is_user_turn"]
            
            # Update Session State
            session.current_speaker_id = next_participant.id
            session.current_speaker_type = next_turn_info["turn_type"]
            
            # Advance script_index if using script mode
            if script_index is not None and "script_index" in next_turn_info:
                new_script_index = script_index + 1
                variant["current_script_index"] = new_script_index
                session.variant = json.dumps(variant)
                logger.info(f"[MyTurnService] Script index advanced: {script_index} → {new_script_index}")
            
            # SAFETY CHECK: Ensure session is still active before committing next turn state
            # This prevents race condition where user ends session while AI turn is processed
            status_check = await self.db.execute(
                select(ConversationSession.status).where(ConversationSession.id == session.id)
            )
            current_status = status_check.scalar()
            if current_status != SessionStatus.ACTIVE:
                logger.info(f"[MyTurnService] Session {session_id} became {current_status} (not active). Aborting turn update.")
                return

            await self.db.commit()
            
            logger.info(
                f"[MyTurnService] complete_turn: next speaker = {next_participant.name} "
                f"(type={next_participant.participant_type.value}, is_user_turn={is_user_turn})"
            )
            
            # Notify Client
            await manager.send_message(str(session.id), {
                "type": "turn_changed",
                "turn_index": session.current_turn_index,
                "speaker": {
                    "id": str(next_participant.id),
                    "name": next_participant.name,
                    "type": next_turn_info["turn_type"],
                    "avatar_url": next_participant.avatar_url,
                },
                "is_user_turn": is_user_turn
            })

            # Trigger AI if next speaker is not the user
            if not is_user_turn:
                instruction = next_turn_info.get("instruction")
                
                # Safety check: prevent infinite AI loop
                consecutive_ai = variant.get("_consecutive_ai_turns", 0) + 1
                variant["_consecutive_ai_turns"] = consecutive_ai
                session.variant = json.dumps(variant)
                await self.db.commit()
                
                if consecutive_ai > MAX_CONSECUTIVE_AI_TURNS:
                    logger.error(
                        f"[MyTurnService] SAFETY LIMIT: {consecutive_ai} consecutive AI turns exceeded! "
                        f"Stopping AI chain for session {session_id}."
                    )
                    await manager.send_message(str(session.id), {
                        "type": "error",
                        "message": f"Safety limit: {MAX_CONSECUTIVE_AI_TURNS} consecutive AI turns reached. Please check template configuration."
                    })
                    return
                
                # We don't have background_tasks here, so always use asyncio.create_task
                logger.info(
                    f"[MyTurnService] Launching AI turn for {next_participant.name} "
                    f"via asyncio.create_task (consecutive_ai={consecutive_ai})"
                )
                asyncio.create_task(
                    run_ai_turn_background(
                        session_id,
                        str(next_participant.id),
                        instruction
                    )
                )

        else:
            # Session Complete
            logger.info(f"[MyTurnService] Session {session_id} completed (no next turn).")
            session.status = SessionStatus.COMPLETED
            await self.db.commit()
            await manager.send_message(str(session.id), {"type": "session_completed"})

    async def get_chat_history(self, session_id: UUID, limit: int = 10) -> str:
        """Retrieves formatted chat history for LLM context."""
        turns = await self.session_service.get_session_turns(session_id, limit=limit)
        history_text = ""
        for turn in turns:  # Turns are now returned in ASC order (chronological)
            speaker = turn.speaker_name
            text = turn.content_text
            history_text += f"{speaker}: {text}\n"
        return history_text

    # Emotion → TTS parameter adjustments
    EMOTION_TTS_MAP = {
        "happy": {"pitch": 2.0, "speaking_rate_adj": 0.05},
        "excited": {"pitch": 3.0, "speaking_rate_adj": 0.1},
        "nervous": {"pitch": -1.0, "speaking_rate_adj": -0.1},
        "confused": {"pitch": 0.0, "speaking_rate_adj": -0.15},
        "frustrated": {"pitch": -2.0, "speaking_rate_adj": -0.05},
        "shy": {"pitch": -1.0, "speaking_rate_adj": -0.1},
        "neutral": {"pitch": 0.0, "speaking_rate_adj": 0.0},
    }

    async def _complete_turn_wrapper(self, session_id: UUID, script_index: int = None):
        """Wrapper for complete_turn that creates a new DB session for background tasks."""
        from app.core.database import AsyncSessionLocal
        
        async with AsyncSessionLocal() as db:
            service = MyTurnService(db)
            await service.complete_turn(session_id, script_index=script_index, return_to_user_after=False)

    async def process_ai_turn(self, session: ConversationSession, participant, instruction: Optional[str] = None, return_to_user_after: bool = False, user_emotion: Optional[str] = None):
        """Generates AI response and saves it as a new turn."""
        # Status Check
        if session.status != SessionStatus.ACTIVE:
            logger.info(f"[process_ai_turn] Session {session.id} is {session.status}. Aborting.")
            return

        logger.info(f"Processing AI turn for {participant.name} in session {session.id}, instruction: {instruction}")
        
        # 0. Resolve Configuration (Session Override > Participant Default)
        session_config = {}
        if session.variant:
             try:
                 session_config = json.loads(session.variant)
             except Exception as e:
                 logger.error(f"Failed to parse session variant config: {e}")

        # Voice Settings
        voice_id = participant.voice_id
        tts_provider = participant.tts_provider or 'google-cloud'
        tts_model = participant.tts_model or ''
        # Parse participant voice_settings if string or dict
        p_voice_settings = participant.voice_settings or {}
        if isinstance(p_voice_settings, str):
             try:
                 p_voice_settings = json.loads(p_voice_settings)
             except:
                 p_voice_settings = {}
        
        speaking_rate = p_voice_settings.get('speaking_rate', 1.0)
        difficulty = participant.difficulty or 1
        
        if 'participants' in session_config:
            p_config = session_config['participants'].get(str(participant.id), {})
            if 'voice_id' in p_config and p_config['voice_id']:
                voice_id = p_config['voice_id']
            if 'speaking_rate' in p_config:
                speaking_rate = float(p_config['speaking_rate'])
            if 'difficulty' in p_config:
                difficulty = int(p_config['difficulty'])
            if 'tts_provider' in p_config and p_config['tts_provider']:
                tts_provider = p_config['tts_provider']
            if 'tts_model' in p_config and p_config['tts_model']:
                tts_model = p_config['tts_model']
        
        logger.info(
            f"[process_ai_turn] {participant.name}: voice_id={voice_id}, "
            f"tts_provider={tts_provider}, tts_model={tts_model}, "
            f"speaking_rate={speaking_rate}, difficulty={difficulty}"
        )

        # 1. Build LLM Context
        history = await self.get_chat_history(session.id, limit=20) # Increased context-limit
        system_prompt = session.template.system_prompt
        
        # Adjust prompt based on difficulty (basic mode only; v0.2 uses pipeline level system)
        difficulty_instruction = ""
        pipeline_mode = getattr(session.template, 'pipeline_mode', 'basic') or 'basic'
        if pipeline_mode != "v0.2":
            if difficulty <= 1:
                difficulty_instruction = "Use very simple vocabulary and short sentences (A1 level)."
            elif difficulty == 2:
                difficulty_instruction = "Use simple vocabulary and clear sentences (A2 level)."
            elif difficulty == 3:
                difficulty_instruction = "Use intermediate vocabulary (B1 level)."
            elif difficulty >= 4:
                difficulty_instruction = "Use advanced vocabulary and natural expressions (B2/C1 level)."

        # Build participants list
        participants_desc = "Participants in this conversation:\n"
        
        if session.template and session.template.participants:
             for p in sorted(session.template.participants, key=lambda x: x.order_index):
                 role = p.participant_type.value
                 p_name = p.name
                 
                 # If this is a USER participant, use the actual user's name if available
                 if p.participant_type == ParticipantType.USER:
                     if session.user_name:
                         p_name = f"{session.user_name} (Role: {p.name})"
                     else:
                         p_name = f"{p.name}"
                 
                 participants_desc += f"- {p_name} ({role}): {p.persona or ''}\n"
                 
        context = f"""
        **YOUR IDENTITY:**
        Name: {participant.name}
        Role: {participant.participant_type.value}
        Persona: {participant.persona or 'Friendly AI'}
        
        {participants_desc}
        
        **SCENE CONTEXT:**
        {session.template.scene_context or ''}
        Instruction Level: {difficulty_instruction}
        
        **CONVERSATION HISTORY:**
        {history}
        
        **SYSTEM INSTRUCTIONS:**
        {system_prompt}
        """
        
        # Add Specific Instruction from Director
        if instruction:
            context += f"\n\n[DIRECTOR'S INSTRUCTION]: {instruction}\nFollow this instruction strictly."
        
        # ── v0.2 PIPELINE RESULT INJECTION ──
        pipeline_mode = getattr(session.template, 'pipeline_mode', 'basic') or 'basic'
        pipeline_result = session_config.get("_pipeline_result")
        
        if pipeline_mode == "v0.2" and pipeline_result:
            participant_type = participant.participant_type.value if hasattr(participant.participant_type, 'value') else str(participant.participant_type)
            
            if participant_type == "moderator":
                # Moderator uses feedback_text from Conductor
                feedback = pipeline_result.get("feedback_text", "")
                feedback_instruction = pipeline_result.get("feedback_instruction", "")
                if feedback:
                    context += f"\n\n[CONDUCTOR FEEDBACK]:\n{feedback}"
                    corrections = pipeline_result.get("corrections", [])
                    better_expr = pipeline_result.get("better_expressions", [])
                    if corrections:
                        context += f"\nCorrections: {', '.join(corrections)}"
                    if better_expr:
                        context += f"\nBetter expressions: {', '.join(better_expr)}"
                    if feedback_instruction:
                        context += f"\n{feedback_instruction}"
            else:
                # AI participants get script or level instruction from Conductor
                level = pipeline_result.get("level", 1)
                level_instr = pipeline_result.get("level_instruction", "")
                speaker_scripts = pipeline_result.get("speaker_scripts", {})
                
                my_script = speaker_scripts.get(participant.name, {})
                if my_script.get("text"):
                    instruction = my_script.get("instruction", "")
                    context += f'\n\n[CONDUCTOR SCRIPT]:\n"{my_script["text"]}"'
                    if instruction:
                        context += f"\n{instruction}"
                elif level_instr:
                    context += f"\n\n[LEVEL INSTRUCTION]: Level {level}. {level_instr}"
        
        # Add Emotion Context (Phase 5)
        if user_emotion and user_emotion != "neutral":
            context += f"\n[USER EMOTION]: The user seems {user_emotion}. Adjust your tone and response accordingly — be empathetic and match the emotional context."

        # 2. Call LLM
        t1_llm_start = time.time() * 1000
        
        import google.generativeai as genai
        from app.core.config import settings
        
        # 2. Pre-LLM Status Check (in case context building took time)
        refetched_session = await self.session_service.get_by_id(session.id) # Re-fetch status
        if not refetched_session or refetched_session.status != SessionStatus.ACTIVE.value:
             logger.info(f"[process_ai_turn] Session ended before LLM call. Aborting.")
             return

        reply_text = ""
        
        # Determine LLM Model (resolution: session variant > participant DB > default)
        llm_model = participant.llm_model or "gemini-2.5-flash"
        if session.variant:
            try:
                variant_data = json.loads(session.variant)
                # Check for participant-specific config first
                if "participants" in variant_data:
                    p_config = variant_data["participants"].get(str(participant.id), {})
                    if "llm_model" in p_config:
                        llm_model = p_config["llm_model"]
                # Fallback to global setting if exists (legacy or director)
                elif "llm_model" in variant_data:
                    llm_model = variant_data["llm_model"]
            except:
                pass
        
        # Configure GenAI only if key is available
        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            model = genai.GenerativeModel(llm_model)
            
            # Build contextual generation prompt
            pipeline_mode = getattr(session.template, 'pipeline_mode', 'basic') or 'basic'
            
            # --- Check if we can bypass LLM ---
            should_bypass_llm = False
            pre_generated_text = ""
            last_error = None
            
            # 1st priority: Use greeting_message for initial turns (no pipeline result = opening turn)
            if not pipeline_result and hasattr(participant, 'greeting_message') and participant.greeting_message:
                should_bypass_llm = True
                pre_generated_text = participant.greeting_message
                logger.info(f"[process_ai_turn] Using greeting_message for {participant.name}: {pre_generated_text[:50]}...")
            
            # 2nd priority: Use Conductor script from pipeline
            elif pipeline_mode == "v0.2" and pipeline_result:
                speaker_scripts = pipeline_result.get("speaker_scripts", {})
                my_script = speaker_scripts.get(participant.name, {})
                if my_script.get("text"):
                    should_bypass_llm = True
                    pre_generated_text = my_script.get("text")
            
            if should_bypass_llm:
                logger.info(f"[process_ai_turn] Bypassing LLM for {participant.name}. Using Conductor script directly.")
                reply_text = pre_generated_text
                t1_llm_start = time.time() * 1000
                generation_prompt = "[LLM Bypassed - Used Conductor Script]\n" + pre_generated_text
            else:
                if pipeline_mode == "v0.2":
                    # v0.2: System prompt from Admin controls all behavior.
                    # Only add minimal output formatting instruction.
                    generation_prompt = f"""{context}
    
    It is now YOUR turn to speak as {participant.name}.
    Output ONLY the spoken text. No name prefix.
    """
                else:
                    # basic mode: keep legacy behavior
                    last_speaker_hint = ""
                    if history:
                        lines = history.strip().split("\n")
                        if lines:
                            last_line = lines[-1]
                            if ":" in last_line:
                                last_speaker_name = last_line.split(":")[0].strip()
                                last_speaker_hint = f"The last person who spoke was '{last_speaker_name}'."
                    
                    generation_prompt = f"""{context}
    
    {last_speaker_hint}
    
    It is now YOUR turn to speak as {participant.name}.
    IMPORTANT RULES:
    - Respond to the LAST SPEAKER directly (whether it was a user or another AI participant).
    - If the last speaker was another AI, engage with THEIR comment naturally (agree, disagree, add to the topic, react).
    - If the last speaker was the USER, respond to the user directly.
    - Keep your response relatively short (1-3 sentences). This is a conversation, not a monologue.
    - Use the persona and vocabulary level defined above.
    - output ONLY the spoken text. No "{participant.name}:" prefix.
    """
                
                # Generate with retry (max 3 attempts)
                MAX_RETRIES = 3
                last_error = None
                for attempt in range(MAX_RETRIES):
                    try:
                        # Re-capture t1_llm_start right before actual generation for maximum accuracy
                        t1_llm_start = time.time() * 1000
                        response = model.generate_content(generation_prompt)
                        reply_text = response.text.strip()
                        last_error = None
                        break
                    except Exception as e:
                        last_error = e
                        if attempt < MAX_RETRIES - 1:
                            logger.warning(f"[process_ai_turn] LLM attempt {attempt + 1}/{MAX_RETRIES} failed for {participant.name}: {e}. Retrying...")
                        await asyncio.sleep(1)  # Brief delay before retry
                    else:
                        logger.error(f"[process_ai_turn] LLM failed after {MAX_RETRIES} attempts for {participant.name}: {e}")
            
            if last_error:
                raise Exception(f"AI turn LLM generation failed after {MAX_RETRIES} attempts: {last_error}")
        else:
            logger.warning("GOOGLE_AI_API_KEY not set. Using dummy response.")
            reply_text = "Hello! I am an AI participant."
        
        t2_llm_final = time.time() * 1000

        # 3. TTS Generation
        # Dispatch based on tts_provider setting
        
        # Pre-TTS Status Check
        session = await self.session_service.get_by_id(session.id)
        if session.status != SessionStatus.ACTIVE:
             logger.info(f"[process_ai_turn] Session ended before TTS call. Aborting.")
             return

        audio_base64 = None
        try:
            if tts_provider == 'gemini':
                from app.services.conversation.gemini_tts_service import GeminiTTSService
                gemini_tts = GeminiTTSService()
                tts_result = await gemini_tts.synthesize(
                    text=reply_text,
                    model=tts_model or "gemini-2.5-flash-tts",
                    voice_name=voice_id or "Kore",
                    user_emotion=user_emotion,
                    save_file=False,
                )
                audio_base64 = tts_result.get("audio_base64")
                
                # Fallback to Google Cloud TTS if Gemini returned no audio
                if not audio_base64:
                    logger.warning(f"Gemini TTS returned no audio, falling back to Google Cloud TTS")
                    raise Exception("Gemini TTS returned empty audio")
            else:
                from app.services.conversation.tts_service import TTSService
                tts_service = TTSService()
                # Apply emotion-based TTS adjustments (Phase 5)
                emotion_adj = self.EMOTION_TTS_MAP.get(user_emotion or "neutral", {"pitch": 0.0, "speaking_rate_adj": 0.0})
                adjusted_rate = max(0.5, min(2.0, speaking_rate + emotion_adj.get("speaking_rate_adj", 0.0)))
                adjusted_pitch = emotion_adj.get("pitch", 0.0)
                
                tts_result = await tts_service.synthesize(
                    text=reply_text,
                    voice_id=voice_id or "en-US-Neural2-F",
                    speaking_rate=adjusted_rate,
                    pitch=adjusted_pitch,
                    save_file=False,
                )
                audio_base64 = tts_result.get("audio_base64")
        except Exception as e:
            logger.error(f"TTS Error ({tts_provider}): {e}")
            # Fallback: If Gemini failed, try Google Cloud TTS
            if tts_provider == 'gemini':
                try:
                    logger.info(f"Falling back to Google Cloud TTS...")
                    from app.services.conversation.tts_service import TTSService
                    tts_service = TTSService()
                    tts_result = await tts_service.synthesize(
                        text=reply_text,
                        voice_id="en-US-Neural2-F",
                        speaking_rate=speaking_rate,
                        save_file=False,
                    )
                    audio_base64 = tts_result.get("audio_base64")
                    logger.info(f"Google Cloud TTS fallback succeeded")
                except Exception as fallback_e:
                    logger.error(f"Google Cloud TTS fallback also failed: {fallback_e}")
                    audio_base64 = None
            else:
                audio_base64 = None
            
        t2_5_tts_ready = time.time() * 1000

        # 4. Save to DB 
        # STATE TRACKING: Append tag to model_name if this is an encouragement turn.
        # This persists the intent in the Turn History, avoiding session object race conditions.
        saved_model_name = llm_model 
        if return_to_user_after:
            saved_model_name += ":ENCOURAGEMENT"
            
        # Determine actual TurnType from participant (handles moderator vs AI)
        actual_turn_type = TurnType.MODERATOR if getattr(participant.participant_type, 'value', participant.participant_type) == 'moderator' else TurnType.AI
            
        await self.session_service.add_turn(
            session_id=session.id,
            turn_type=actual_turn_type,
            speaker_name=participant.name,
            content_text=reply_text,
            model_name=saved_model_name,
            t1_asr_final=t1_llm_start,   # Used by TurnResponse to compute llm_latency_ms
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            tts_provider=tts_provider,
            tts_voice=voice_id,
        )
        
        # 5. METRICS: Find last USER turn to associate latencies
        # We need to find the most recent turn by User to attach LLM/TTS latency
        try:
            from sqlalchemy import select, desc
            from app.models.conversation import ConversationTurn
            
            stmt = (
                select(ConversationTurn)
                .where(ConversationTurn.session_id == session.id)
                .where(ConversationTurn.turn_type == TurnType.USER)
                .order_by(desc(ConversationTurn.turn_index))
                .limit(1)
            )
            result = await self.session_service.db.execute(stmt)
            last_user_turn = result.scalar_one_or_none()
            
            user_turn_id = None
            if last_user_turn:
                user_turn_id = str(last_user_turn.id)
                
                # Only update timestamps if this is the FIRST AI response for this user turn
                # This ensures we measure "Latency to First Response", which matches user perception.
                if not last_user_turn.t2_llm_final:
                    last_user_turn.t2_llm_final = t2_llm_final
                    last_user_turn.t2_5_tts_ready = t2_5_tts_ready
                    # Backfill t1_5_llm_start if not already set
                    if not last_user_turn.t1_5_llm_start:
                        last_user_turn.t1_5_llm_start = t1_llm_start
                    await self.session_service.db.commit()
                    
                    # Update metrics immediately
                    await self.session_service.calculate_metrics(session.id)
                else:
                    logger.info(f"Skipping metric update for Turn {last_user_turn.id} (already has response timestamp).")
        except Exception as e:
            logger.error(f"Failed to update metrics for AI turn: {e}")
            user_turn_id = None
        
        # 6. Send Response to Client
        await manager.send_message(str(session.id), {
            "type": "ai_response",
            "speaker": participant.name,
            "text": reply_text,
            "config": {
                "speaking_rate": speaking_rate,
                "difficulty": difficulty
            },
            "audio": audio_base64,
            "turn_id": user_turn_id  # Pass this for client t3 logging
        })
        
        # NOTE: We do NOT advance orchestrator here. We wait for 'turn_complete' signal from client.
        # This ensures the AI text is fully spoken before the next turn is calculated.

    async def process_user_turn(self, session_id: UUID, audio_data: bytes = None, audio_format: str = None, background_tasks: BackgroundTasks = None, t0_user_end: float = 0.0, text_input: str = None, t1_server_final: float = 0.0):
        """Processes user audio or text input."""
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session:
             raise ValueError("Session not found")

        # 1. STT (skip if text_input provided)
        stt_result = {}
        t1_5_llm_start = time.time() * 1000  # POST arrival time = t1.5
        if text_input:
            transcript = text_input
            # Streaming: use server's is_final timestamp if available
            if t1_server_final and t1_server_final > 0:
                t1_asr_final = t1_server_final
            else:
                t1_asr_final = time.time() * 1000
        else:
            from app.services.conversation.stt_service import STTService
            stt_service = STTService()
            
            # Resolve STT model from session config > participant DB > default
            stt_model = "chirp_3"
            if session.variant:
                try:
                    variant_data = json.loads(session.variant)
                    
                    # 1. Find the User participant ID from the template participants
                    user_participant_id = None
                    if session.template and session.template.participants:
                        # Assuming ParticipantType is accessible or we check as string
                        user_participant = next(
                            (p for p in session.template.participants 
                             if (hasattr(p.participant_type, 'value') and p.participant_type.value == 'user') or 
                                str(p.participant_type) == 'user' or 
                                str(p.participant_type) == 'ParticipantType.USER'), 
                            None
                        )
                        if user_participant:
                            user_participant_id = str(user_participant.id)

                    # 2. Extract the user's explicit stt_model setting
                    if "participants" in variant_data and user_participant_id:
                        p_config = variant_data["participants"].get(user_participant_id, {})
                        if "stt_model" in p_config and p_config["stt_model"]:
                            stt_model = p_config["stt_model"]
                            logger.info(f"[process_user_turn] Using User's custom STT model: {stt_model} for participant {user_participant_id}")
                except Exception as e:
                    logger.warning(f"Failed to resolve custom User STT model: {e}")
                    pass
            
            stt_result = await stt_service.smart_transcribe(
                audio_data=audio_data,
                audio_format=audio_format,
                model=stt_model,
            )
            transcript = stt_result.get("transcript", "")
            t1_asr_final = time.time() * 1000
            t1_5_llm_start = t1_asr_final  # Sync: no network transit
        
        # 2. Save Turn
        await self.session_service.add_turn(
            session_id=session.id,
            turn_type=TurnType.USER,
            speaker_name=session.user_name or "User",
            content_text=transcript,
            audio_duration_ms=stt_result.get("duration_ms") if not text_input else None,
            stt_provider="text" if text_input else "google",
            stt_model=stt_result.get("recognition_api", "v1") if not text_input else None,
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
            t1_5_llm_start=t1_5_llm_start,
        )
        
        # Calculate intermediate metrics (ASR latency)
        # Note: t2 and t2.5 will be updated when AI responds
        await self.session_service.calculate_metrics(session.id)
        
        # 3. Pipeline Branching: v0.2 (Expert Pipeline) or basic (ScenarioDirector)
        pipeline_mode = getattr(session.template, 'pipeline_mode', 'basic') or 'basic'
        
        history = await self.get_chat_history(session.id)
        
        # Get current script index
        script_index = None
        variant = {}
        if session.variant:
            try:
                variant = json.loads(session.variant)
                script_index = variant.get("current_script_index")
            except: 
                pass
        
        if pipeline_mode == "v0.2":
            # ════════════════════════════════════════════════════════════
            # v0.2 EXPERT PIPELINE: Evaluator → Planner → Conductor
            # ════════════════════════════════════════════════════════════
            import uuid as _uuid
            from app.services.conversation.evaluator_service import EvaluatorService
            from app.services.conversation.planner_service import PlannerService, SessionState
            from app.services.conversation.conductor_service import ConductorService
            from app.models.pipeline_log import PipelineLog

            trace_id = str(_uuid.uuid4())
            turn_id = str(session.current_turn_index)

            # Build effective scene_context: append user_topic from session variant if present
            effective_scene_context = session.template.scene_context or ""
            user_topic = variant.get("user_topic")
            if user_topic:
                effective_scene_context += f"\n\nUser's requested topic for this session: {user_topic}"

            logger.info(f"[process_user_turn] v0.2 Pipeline: trace_id={trace_id}")
            
            # --- EVALUATOR ---
            evaluator = EvaluatorService(
                llm_model=getattr(session.template, 'evaluator_llm_model', None) or "gemini-2.0-flash",
                custom_prompt=getattr(session.template, 'evaluator_prompt', None),
            )
            eval_output, eval_duration = await evaluator.evaluate(
                transcript=transcript,
                topic=session.template.topic,
                target_level=session.template.difficulty,
                scene_context=effective_scene_context,
                history_text=history,
                trace_id=trace_id,
                session_id=str(session.id),
                turn_id=turn_id,
            )
            
            # Log Evaluator
            eval_log = PipelineLog(
                trace_id=trace_id,
                session_id=session.id,
                turn_index=session.current_turn_index,
                module_name="evaluator",
                input_json={"transcript": transcript, "topic": session.template.topic},
                output_json=eval_output.model_dump(),
                duration_ms=eval_duration,
                model_name=evaluator.llm_model,
                prompt_used=evaluator.custom_prompt or "",
            )
            self.db.add(eval_log)
            
            logger.info(
                f"[v0.2 Evaluator] overall_score={eval_output.aggregate.overall_score}, "
                f"primary_issue={eval_output.diagnosis.primary_issue}, "
                f"duration={eval_duration:.0f}ms"
            )
            
            # --- PLANNER ---
            planner = PlannerService(
                llm_model=getattr(session.template, 'planner_llm_model', None) or "gemini-2.0-flash",
                custom_prompt=getattr(session.template, 'planner_prompt', None),
                level_definitions=getattr(session.template, 'level_definitions', None),
            )
            
            session_state = SessionState.from_variant(variant)
            logger.warning(f"[v0.2 Pipeline] custom_state LOADED: {session_state.custom_state}")

            plan_output, plan_duration = await planner.decide(
                eval_output=eval_output,
                session_state=session_state,
                participants=session.template.participants if session.template else None,
                trace_id=trace_id,
                turn_id=turn_id,
                history_text=history,
            )
            
            # Update session state in variant
            variant["_pipeline_state"] = session_state.to_dict()
            logger.warning(f"[v0.2 Pipeline] custom_state SAVED: {session_state.custom_state}")
            
            # Log Planner
            plan_log = PipelineLog(
                trace_id=trace_id,
                session_id=session.id,
                turn_index=session.current_turn_index,
                module_name="planner",
                input_json=eval_output.model_dump(),
                output_json=plan_output.model_dump(),
                duration_ms=plan_duration,
                model_name=planner.llm_model,
                prompt_used=planner.custom_prompt or "",
            )
            self.db.add(plan_log)
            
            logger.info(
                f"[v0.2 Planner] path={plan_output.decision.path}, "
                f"action={plan_output.decision.action_code}, "
                f"speakers={plan_output.persona_plan.speakers}, "
                f"duration={plan_duration:.0f}ms"
            )
            
            # --- CONDUCTOR ---
            conductor = ConductorService(
                llm_model=getattr(session.template, 'conductor_llm_model', None) or "gemini-2.0-flash",
                custom_prompt=getattr(session.template, 'conductor_prompt', None),
                level_definitions=getattr(session.template, 'level_definitions', None),
            )
            conductor_output, conductor_duration = await conductor.generate_scripts(
                planner_output=plan_output,
                participants=session.template.participants if session.template else None,
                scene_context=effective_scene_context,
                history_text=history,
                user_transcript=transcript,
                user_name=session.user_name,
                system_prompt=session.template.system_prompt,
                trace_id=trace_id,
                turn_id=turn_id,
                custom_state=session_state.custom_state,
            )
            
            # Log Conductor
            cond_log = PipelineLog(
                trace_id=trace_id,
                session_id=session.id,
                turn_index=session.current_turn_index,
                module_name="conductor",
                input_json=plan_output.model_dump(),
                output_json=conductor_output.model_dump(),
                duration_ms=conductor_duration,
                model_name=conductor.llm_model,
                prompt_used=conductor.custom_prompt or "",
            )
            self.db.add(cond_log)
            
            logger.info(
                f"[v0.2 Conductor] scripts={len(conductor_output.scripts)}, "
                f"feedback={len(conductor_output.feedback_text)} chars, "
                f"duration={conductor_duration:.0f}ms"
            )
            
            # Update Script Index based on Evaluator score
            if eval_output.aggregate.overall_score >= 60:
                if script_index is not None:
                    script_index += 1
                    variant["current_script_index"] = script_index
            
            # ── STORE PIPELINE RESULTS IN VARIANT ──
            # These will be read by process_ai_turn for each participant
            speaker_scripts = {}
            for s in conductor_output.scripts:
                speaker_scripts[s.speaker_name] = {
                    "text": s.text,
                    "instruction": s.instruction,
                }
            
            variant["_pipeline_result"] = {
                "feedback_text": conductor_output.feedback_text,
                "feedback_instruction": conductor_output.feedback_instruction,
                "level": plan_output.persona_plan.current_level,
                "level_instruction": conductor_output.level_instruction,
                "corrections": conductor_output.corrections,
                "better_expressions": conductor_output.better_expressions,
                "energy_flow": conductor_output.energy_flow,
                "speaker_scripts": speaker_scripts,
                "user_emotion": conductor_output.user_emotion,
            }
            
            # Reset consecutive AI turn counter
            variant["_consecutive_ai_turns"] = 0
            session.variant = json.dumps(variant)
            
            # Commit pipeline logs + variant
            await self.db.commit()
            
            # ── NORMAL TURN FLOW: use complete_turn for round-robin ──
            # This will advance to the next speaker (moderator first) via TurnOrchestrator
            if background_tasks:
                background_tasks.add_task(
                    self._complete_turn_wrapper,
                    session_id,
                    script_index,
                )
            else:
                asyncio.create_task(
                    self._complete_turn_wrapper(session_id, script_index)
                )
            
            return {
                "transcript": transcript,
                "next_turn": session.current_turn_index,
                "pipeline": "v0.2",
                "trace_id": trace_id,
                "level": plan_output.persona_plan.current_level,
                "corrections": conductor_output.corrections,
                "better_expressions": conductor_output.better_expressions,
                "feedback_text": conductor_output.feedback_text,
            }
        
        # ════════════════════════════════════════════════════════════
        # BASIC MODE (existing ScenarioDirector — unchanged)
        # ════════════════════════════════════════════════════════════
        
        director = ScenarioDirector(session)
        
        # Target step is usually next step in sequence
        target_step_index = (script_index if script_index is not None else -1) + 1
        
        director_output = await director.evaluate_turn(transcript, history, target_step_index)
        logger.info(f"Director Evaluation: {director_output.to_dict()}")
        
        # Update Script Index based on Director
        if director_output.should_continue_script:
            if script_index is not None:
                script_index += 1
                variant["current_script_index"] = script_index
        
        # Reset consecutive AI turn counter since user just spoke
        variant["_consecutive_ai_turns"] = 0
        session.variant = json.dumps(variant)

        
        # 4. Determine next turn based on Director evaluation.
        # NORMAL (PASS): Round-robin through all AIs sequentially (AI1 → AI2 → AI3 → User)
        # HESITATION (FAIL etc): Only 1 AI responds with encouragement → back to User
        
        needs_encouragement = director_output.evaluation in (
            "FAIL", "Clarification_Needed", "Simulate_Reaction"
        )
        
        if needs_encouragement:
            # ── HESITATION PATH: 1 AI → User ──
            logger.info(f"[process_user_turn] User needs encouragement (eval={director_output.evaluation})")
            
            # Pick bridge participant: Director-specified > fallback to first AI
            bridge_participant = None
            if session.template and session.template.participants:
                ai_participants = [
                    p for p in sorted(session.template.participants, key=lambda x: x.order_index)
                    if p.participant_type != ParticipantType.USER
                ]
                
                # If Director specified a bridge_speaker, find by name
                if director_output.bridge_speaker and ai_participants:
                    bridge_participant = next(
                        (p for p in ai_participants if p.name == director_output.bridge_speaker),
                        None
                    )
                    if bridge_participant:
                        logger.info(f"[process_user_turn] Director chose bridge: {bridge_participant.name}")
                    else:
                        logger.warning(f"[process_user_turn] Director bridge_speaker '{director_output.bridge_speaker}' not found")
                
                # Fallback: first AI participant
                if not bridge_participant and ai_participants:
                    bridge_participant = ai_participants[0]
                    logger.info(f"[process_user_turn] Fallback bridge: {bridge_participant.name}")
            
            if bridge_participant:
                encouragement_instruction = (
                    f"{director_output.instruction}\n"
                    "IMPORTANT: The user is struggling or hesitating. "
                    "Be brief and encouraging (1-2 sentences max). "
                    "Help them or gently guide them."
                )
                
                session.current_turn_index += 1
                session.current_speaker_id = bridge_participant.id
                session.current_speaker_type = bridge_participant.participant_type
                
                # Note: We rely on return_to_user_after=True passed to background task
                # to tag the turn-to-be-created with :ENCOURAGEMENT in model_name.
                
                # Reverting manual execution to avoid potential ORM conflict
                await self.db.commit()
                
                logger.info(
                    f"[process_user_turn] HESITATION → bridge: {bridge_participant.name} "
                    f"(return_to_user=True)"
                )
                
                await manager.send_message(str(session.id), {
                    "type": "turn_changed",
                    "turn_index": session.current_turn_index,
                    "speaker": {
                        "id": str(bridge_participant.id),
                        "name": bridge_participant.name,
                        "type": str(bridge_participant.participant_type.value) if hasattr(bridge_participant.participant_type, 'value') else str(bridge_participant.participant_type),
                    },
                    "is_user_turn": False
                })
                
                emotion = director_output.user_emotion if director_output else None
                if background_tasks:
                    background_tasks.add_task(
                        run_ai_turn_background, 
                        session_id, 
                        str(bridge_participant.id),
                        encouragement_instruction,
                        True,  # return_to_user_after=True
                        emotion  # user_emotion
                    )
                else:
                    asyncio.create_task(
                        run_ai_turn_background(
                            session_id,
                            str(bridge_participant.id),
                            encouragement_instruction,
                            True,  # return_to_user_after=True
                            emotion  # user_emotion
                        )
                    )
                
                return {
                    "transcript": transcript,
                    "next_turn": session.current_turn_index
                }
        
        # ── NORMAL PATH (PASS): Round-robin through all participants ──
        orchestrator = TurnOrchestrator(session, session.template)
        next_turn_info = await orchestrator.determine_next_turn(
            session.current_turn_index,
            script_index=script_index
        )
        
        # Override instruction if Director provided one
        if next_turn_info and director_output.instruction:
            next_turn_info["instruction"] = director_output.instruction
        
        # Turn Routing Override (Phase 6): Director next_speaker > mention > bridge_speaker > round-robin
        if next_turn_info and session.template and session.template.participants:
            override_participant = None
            override_source = None
            
            # Priority 1: Director's next_speaker (intelligent turn distribution)
            if director_output.next_speaker:
                override_participant = next(
                    (p for p in session.template.participants 
                     if p.name == director_output.next_speaker and p.participant_type != ParticipantType.USER),
                    None
                )
                if override_participant:
                    override_source = "Director next_speaker"
            
            # Priority 2: Director's bridge_speaker (for non-PASS, but also works here)
            if not override_participant and director_output.bridge_speaker:
                override_participant = next(
                    (p for p in session.template.participants 
                     if p.name == director_output.bridge_speaker and p.participant_type != ParticipantType.USER),
                    None
                )
                if override_participant:
                    override_source = "Director bridge_speaker"
            
            # Priority 3: User mention detection
            if not override_participant:
                mentioned = detect_mentioned_participant(
                    transcript, session.template.participants
                )
                if mentioned:
                    override_participant = mentioned
                    override_source = "User mention"
            
            # Apply override
            if override_participant and str(override_participant.id) != str(next_turn_info["next_participant"].id):
                logger.info(
                    f"[process_user_turn] {override_source}: routing to {override_participant.name} "
                    f"(instead of round-robin {next_turn_info['next_participant'].name})"
                )
                next_turn_info["next_participant"] = override_participant
                next_turn_info["turn_type"] = override_participant.participant_type.value if hasattr(override_participant.participant_type, 'value') else str(override_participant.participant_type)
                next_turn_info["is_user_turn"] = override_participant.participant_type == ParticipantType.USER
        
        if next_turn_info:
            session.current_turn_index += 1
            session.current_speaker_id = next_turn_info["next_participant"].id
            session.current_speaker_type = next_turn_info["turn_type"]
            await self.db.commit()
            
            logger.info(
                f"[process_user_turn] NORMAL → next: {next_turn_info['next_participant'].name} "
                f"(is_user_turn={next_turn_info['is_user_turn']})"
            )
            
            await manager.send_message(str(session.id), {
                "type": "turn_changed",
                "turn_index": session.current_turn_index,
                "speaker": {
                    "id": str(next_turn_info["next_participant"].id),
                    "name": next_turn_info["next_participant"].name,
                    "type": next_turn_info["turn_type"],
                },
                "is_user_turn": next_turn_info["is_user_turn"]
            })
            
            # Trigger AI if next speaker is AI
            if not next_turn_info["is_user_turn"]:
                instruction = next_turn_info.get("instruction")
                emotion = director_output.user_emotion if director_output else None
                if background_tasks:
                    background_tasks.add_task(
                        run_ai_turn_background,
                        session_id,
                        str(next_turn_info["next_participant"].id),
                        instruction,
                        False,  # return_to_user_after
                        emotion  # user_emotion
                    )
                else:
                    asyncio.create_task(
                        run_ai_turn_background(
                            session_id,
                            str(next_turn_info["next_participant"].id),
                            instruction,
                            False,  # return_to_user_after
                            emotion  # user_emotion
                        )
                    )
        
        return {
            "transcript": transcript,
            "next_turn": session.current_turn_index
        }

 
