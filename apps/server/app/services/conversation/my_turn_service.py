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


async def run_ai_turn_background(session_id: UUID, participant_id: str, instruction: Optional[str] = None):
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

             try:
                 await service.process_ai_turn(session, participant, instruction)
             except Exception as e:
                 logger.error(f"Error in background AI turn: {e}", exc_info=True)
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

    async def complete_turn(self, session_id: UUID, background_tasks: BackgroundTasks = None):
        """
        Called when client finishes playing audio (or explicitly signals turn completion).
        Advances the turn state and triggers the next speaker.
        """
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session:
            logger.error(f"[MyTurnService] Session {session_id} not found in complete_turn")
            return

        # HARD STOP CHECK
        if session.status != SessionStatus.ACTIVE:
            logger.info(f"[complete_turn] Session {session_id} is {session.status}. Stopping turn orchestration.")
            return

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
        script_index = None
        variant = {}
        if session.variant:
            try:
                variant = json.loads(session.variant)
                script_index = variant.get("current_script_index")
            except:
                pass
                
        # Check if we should return to user (set by process_user_turn on hesitation)
        return_to_user = variant.get("return_to_user_after_next_ai", False)
        
        if return_to_user:
            # Clear the flag
            variant.pop("return_to_user_after_next_ai", None)
            session.variant = json.dumps(variant)
            
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
                
                if background_tasks:
                    background_tasks.add_task(
                        run_ai_turn_background, 
                        session_id, 
                        str(next_participant.id),
                        instruction
                    )
                else:
                    # WebSocket context: use asyncio.create_task for non-blocking processing
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

    async def process_ai_turn(self, session: ConversationSession, participant, instruction: Optional[str] = None):
        """Generates AI response and streams it. Does NOT advance turn state."""
        # 1. Immediate Status Check
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
        
        logger.info(
            f"[process_ai_turn] {participant.name}: voice_id={voice_id}, "
            f"speaking_rate={speaking_rate}, difficulty={difficulty}"
        )

        # 1. Build LLM Context
        history = await self.get_chat_history(session.id, limit=20) # Increased context-limit
        system_prompt = session.template.system_prompt
        
        # Adjust prompt based on difficulty
        difficulty_instruction = ""
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

        # 2. Call LLM
        import google.generativeai as genai
        from app.core.config import settings
        
        # 2. Pre-LLM Status Check (in case context building took time)
        session = await self.session_service.get_by_id(session.id) # Re-fetch status
        if session.status != SessionStatus.ACTIVE:
             logger.info(f"[process_ai_turn] Session ended before LLM call. Aborting.")
             return

        reply_text = ""
        # Configure GenAI only if key is available
        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")
            
            try:
                # Build contextual generation prompt
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
- Do NOT always address the user. Have natural group conversation dynamics.
- Keep responses concise (1-3 sentences).
- Stay in character according to your persona.
"""
                response = await model.generate_content_async(generation_prompt)
                reply_text = response.text.strip()
            except Exception as e:
                logger.error(f"LLM Error: {e}")
                reply_text = "I'm sorry, I'm having trouble thinking right now."
        else:
            logger.warning("GOOGLE_AI_API_KEY not set")
            reply_text = "I cannot speak right now because my brain is missing (API Key)."
        
        t2_llm_final = time.time() * 1000

        # 3. TTS
        from app.services.conversation.tts_service import TTSService

        # Pre-TTS Status Check
        session = await self.session_service.get_by_id(session.id)
        if session.status != SessionStatus.ACTIVE:
             logger.info(f"[process_ai_turn] Session ended before TTS call. Aborting.")
             return

        audio_base64 = None
        try:
            tts_service = TTSService()
            tts_result = await tts_service.synthesize(
                text=reply_text,
                voice_id=voice_id or "en-US-Neural2-F",
                speaking_rate=speaking_rate,
                save_file=False  # Optimization: Don't save to disk for real-time turn
            )
            audio_base64 = tts_result.get("audio_base64")
        except Exception as e:
            logger.error(f"TTS Error: {e}")
            audio_base64 = None
            
        t2_5_tts_ready = time.time() * 1000

        # 4. Save to DB 
        await self.session_service.add_turn(
            session_id=session.id,
            turn_type=TurnType.AI,
            speaker_name=participant.name,
            content_text=reply_text,
            model_name="gemini-2.0-flash",
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
            user_turn_id = None
            if last_user_turn:
                user_turn_id = str(last_user_turn.id)
                
                # Only update timestamps if this is the FIRST AI response for this user turn
                # This ensures we measure "Latency to First Response", which matches user perception.
                if not last_user_turn.t2_llm_final:
                    last_user_turn.t2_llm_final = t2_llm_final
                    last_user_turn.t2_5_tts_ready = t2_5_tts_ready
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
        
        # NOTE: We do NOT advance orchestrator here. We wait for 'turn_complete' signal.

    async def process_user_turn(self, session_id: UUID, audio_data: bytes, audio_format: str, background_tasks: BackgroundTasks = None, t0_user_end: float = 0.0):
        """Processes user audio input."""
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session:
             raise ValueError("Session not found")

        # 1. STT
        from app.services.conversation.stt_service import STTService
        stt_service = STTService()
        stt_result = await stt_service.transcribe(audio_data, audio_format)
        transcript = stt_result.get("transcript", "")
        
        t1_asr_final = time.time() * 1000
        
        # 2. Save Turn
        await self.session_service.add_turn(
            session_id=session.id,
            turn_type=TurnType.USER,
            speaker_name=session.user_name or "User",
            content_text=transcript,
            audio_duration_ms=stt_result.get("duration_ms"),
            stt_provider="google",
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
        )
        
        # Calculate intermediate metrics (ASR latency)
        # Note: t2 and t2.5 will be updated when AI responds
        await self.session_service.calculate_metrics(session.id)
        
        # 3. Scenario Director Evaluation
        director = ScenarioDirector(session)
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
        
        # Target step is usually next step in sequence? 
        # Actually ScenarioDirector evaluates if we *can* move to next step or stay.
        # Let's pass the index we *want* to be at.
        target_step_index = (script_index if script_index is not None else -1) + 1
        
        director_output = await director.evaluate_turn(transcript, history, target_step_index)
        logger.info(f"Director Evaluation: {director_output.to_dict()}")
        
        # Update Script Index based on Director
        if director_output.should_continue_script:
            if script_index is not None:
                script_index += 1
                variant["current_script_index"] = script_index
                session.variant = json.dumps(variant)
                # Note: we commit below
        
        # 4. Determine next turn based on Director evaluation.
        # NORMAL (PASS): Round-robin through all AIs sequentially (AI1 → AI2 → AI3 → User)
        # HESITATION (FAIL etc): Only 1 AI responds with encouragement → back to User
        
        needs_encouragement = director_output.evaluation in (
            "FAIL", "Clarification_Needed", "Simulate_Reaction"
        )
        
        if needs_encouragement:
            # ── HESITATION PATH: 1 AI → User ──
            logger.info(f"[process_user_turn] User needs encouragement (eval={director_output.evaluation})")
            
            # Pick first AI as bridge
            bridge_participant = None
            if session.template and session.template.participants:
                for p in sorted(session.template.participants, key=lambda x: x.order_index):
                    if p.participant_type != ParticipantType.USER:
                        bridge_participant = p
                        break
            
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
                
                # Set flag: after THIS 1 AI responds, go back to User
                variant["return_to_user_after_next_ai"] = True
                session.variant = json.dumps(variant)
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
                
                if background_tasks:
                    background_tasks.add_task(
                        run_ai_turn_background,
                        session_id,
                        str(bridge_participant.id),
                        encouragement_instruction
                    )
                else:
                    asyncio.create_task(
                        run_ai_turn_background(
                            session_id,
                            str(bridge_participant.id),
                            encouragement_instruction
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
                if background_tasks:
                    background_tasks.add_task(
                        run_ai_turn_background,
                        session_id,
                        str(next_turn_info["next_participant"].id),
                        instruction
                    )
                else:
                    asyncio.create_task(
                        run_ai_turn_background(
                            session_id,
                            str(next_turn_info["next_participant"].id),
                            instruction
                        )
                    )
        
        return {
            "transcript": transcript,
            "next_turn": session.current_turn_index
        }

 
