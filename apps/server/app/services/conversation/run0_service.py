"""RUN0 voice processing service.

This module provides the main RUN0 pipeline service that orchestrates
STT → LLM → TTS for voice-based conversation testing.
"""

import time
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.conversation import TurnType
from app.schemas.conversation import (
    Run0LogRequest,
    Run0LogResponse,
    Run0VoiceResponse,
)
from app.services.conversation.session_service import SessionService
from app.services.conversation.stt_service import STTService
from app.services.conversation.tts_service import TTSService
from app.services.conversation.gemini_tts_service import GeminiTTSService

# LLM imports
import google.generativeai as genai


class Run0Service:
    """Service for RUN0 voice pipeline processing.
    
    Orchestrates the full pipeline: Audio → STT → LLM → TTS → Audio.
    Records timing metrics for latency analysis.
    
    Attributes:
        db: Database session.
        stt_service: Speech-to-text service.
        tts_service: Text-to-speech service.
        session_service: Session management service.
    """
    
    # Default system prompt for RUN0 testing
    DEFAULT_SYSTEM_PROMPT = """You are a friendly English conversation partner.
You help users practice English through natural conversation.
Keep responses concise (1-3 sentences) and conversational.
Respond naturally to what the user says.
IMPORTANT: Always respond in English only, regardless of what language the user speaks."""
    
    def __init__(self, db: AsyncSession) -> None:
        """Initialize the RUN0 service.
        
        Args:
            db: Database session.
        """
        self.db = db
        self.stt_service = STTService()
        self.tts_service = TTSService()
        self.gemini_tts_service = GeminiTTSService()
        self.session_service = SessionService(db)
        
        # Configure Gemini
        genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
    
    async def process_voice(
        self,
        audio_data: bytes,
        audio_format: str,
        t0_user_end: float,
        session_id: UUID | None = None,
        template_id: UUID | None = None,
        voice_id: str = "en-US-Wavenet-F",
        system_prompt: str | None = None,
        stt_model: str = "latest_long",
        stt_mode: str = "sync",
        llm_model: str = "gemini-2.5-flash",
        tts_provider: str = "google-cloud",
        tts_model: str | None = None,
        tts_mode: str = "sync",
        difficulty: int | None = None,
        estimated_minutes: int | None = None,
        warmup_iterations: int = 2,
        reference_text: str | None = None,
    ) -> Run0VoiceResponse:
        """Process voice input through the full pipeline.
        
        Args:
            audio_data: Raw audio bytes from client.
            audio_format: Audio format (webm, wav, etc.).
            t0_user_end: Client timestamp when recording stopped.
            session_id: Existing session ID (optional).
            template_id: Template ID for new session (optional).
            voice_id: TTS voice ID.
            system_prompt: Custom system prompt (optional).
            difficulty: Difficulty level for new session (1-5).
            estimated_minutes: Estimated session duration.
            
        Returns:
            Run0VoiceResponse with results and timing.
            
        Raises:
            ValueError: If neither session_id nor template_id provided.
        """
        # Get or create session (optional for standalone Run0)
        if session_id:
            # Check for timeout before processing
            is_timed_out = await self.session_service.check_session_timeout(session_id)
            if is_timed_out:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=409,  # Conflict
                    detail="Session has timed out due to inactivity"
                )
            
            session = await self.session_service.get_by_id(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
        elif template_id:
            from app.schemas.conversation import SessionCreate
            session = await self.session_service.create(
                SessionCreate(
                    template_id=template_id,
                    difficulty=difficulty,
                    estimated_minutes=estimated_minutes,
                )
            )
            session_id = session.id
        else:
            # Standalone Run0 mode — auto-create session for latency tracking
            session = await self.session_service.create_run0_session(
                stt_model=stt_model,
                stt_mode=stt_mode,
                llm_model=llm_model,
                tts_provider=tts_provider,
                tts_model=tts_model,
                tts_mode=tts_mode,
                voice_id=voice_id,
                system_prompt=system_prompt,
                warmup_iterations=warmup_iterations,
            )
            session_id = session.id
        
        # Step 1: STT - Convert speech to text (auto-selects V1/V2 by model)
        stt_result = await self.stt_service.smart_transcribe(
            audio_data=audio_data,
            audio_format=audio_format,
            model=stt_model,
        )
        t1_asr_final = time.time() * 1000  # Current timestamp in ms
        t1_5_llm_start = t1_asr_final  # Sync: no network transit (STT and LLM on same server)
        
        transcript = stt_result["transcript"]
        if not transcript:
            transcript = "[No speech detected]"
        
        # Calculate WER/CER if reference text provided
        accuracy = {"wer": None, "cer": None}
        if reference_text and transcript != "[No speech detected]":
            from app.services.conversation.stt_service import calculate_accuracy
            accuracy = calculate_accuracy(transcript, reference_text)
        
        # Get first AI participant name for context (only if session exists)
        first_ai_speaker = None
        if session_id:
            session = await self.session_service.get_by_id_with_template(session_id)
            if session and session.template and session.template.participants:
                for p in session.template.participants:
                    if p.participant_type == "ai":
                        first_ai_speaker = p.name
                        break
        
        # Step 2: LLM - Generate response
        llm_start = time.time()
        reply_text = await self._generate_llm_response(
            user_input=transcript,
            system_prompt=system_prompt or self.DEFAULT_SYSTEM_PROMPT,
            session_id=session_id,
            speaker_name=first_ai_speaker,
            llm_model=llm_model,
        )
        t2_llm_final = time.time() * 1000
        
        # Calculate tokens (rough estimate)
        input_tokens = len(transcript.split()) * 2  # Rough token estimate
        output_tokens = len(reply_text.split()) * 2
        
        # Step 3: TTS - Convert response to speech
        if tts_provider == "gemini":
            tts_result = await self.gemini_tts_service.synthesize(
                text=reply_text,
                model=tts_model or "gemini-2.5-flash-preview-tts",
                voice_name=voice_id,
                save_file=True,
            )
        else:
            tts_result = await self.tts_service.synthesize(
                text=reply_text,
                voice_id=voice_id,
                save_file=True,
            )
        t2_5_tts_ready = time.time() * 1000
        
        # Save turns to database (session always exists now)
        turn = await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.USER,
            speaker_name="User",
            content_text=transcript,
            audio_duration_ms=stt_result.get("duration_ms"),
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
            t1_5_llm_start=t1_5_llm_start,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            model_name=llm_model,
            stt_provider="google",
            stt_model=stt_model,
            tts_provider=tts_provider,
            tts_voice=voice_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reference_text=reference_text,
            wer=accuracy.get("wer"),
            cer=accuracy.get("cer"),
        )
        turn_id = turn.id
        
        # Also save AI response as a separate turn
        await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.AI,
            speaker_name="AI",
            content_text=reply_text,
            audio_url=tts_result.get("audio_url"),
            audio_duration_ms=tts_result.get("duration_ms"),
        )
        
        # Increment turn_index for next iteration
        await self.session_service.increment_turn_index(session_id)
        
        await self.session_service.calculate_metrics(session_id)
        
        # Calculate latencies (sync: transit = 0, LLM = t2 - t1.5 = t2 - t1)
        asr_latency_ms = int(t1_asr_final - t0_user_end)
        network_transit_ms = 0  # Sync mode: no network transit
        llm_latency_ms = int(t2_llm_final - t1_5_llm_start)
        tts_latency_ms = int(t2_5_tts_ready - t2_llm_final)
        server_total_ms = int(t2_5_tts_ready - t0_user_end)
        
        return Run0VoiceResponse(
            session_id=session_id,
            turn_id=turn_id,
            transcript=transcript,
            reply_text=reply_text,
            audio_url=tts_result.get("audio_url"),
            audio_base64=tts_result.get("audio_base64"),
            t1_asr_final=t1_asr_final,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            asr_latency_ms=asr_latency_ms,
            network_transit_ms=network_transit_ms,
            llm_latency_ms=llm_latency_ms,
            tts_latency_ms=tts_latency_ms,
            server_total_ms=server_total_ms,
            stt_confidence=stt_result.get("confidence"),
            recognition_api=stt_result.get("recognition_api"),
            reference_text=reference_text,
            wer=accuracy.get("wer"),
            cer=accuracy.get("cer"),
        )
    
    async def process_text(
        self,
        transcript: str,
        t0_user_end: float,
        t1_asr_final: float,
        session_id: UUID | None = None,
        voice_id: str = "en-US-Wavenet-F",
        system_prompt: str | None = None,
        stt_model: str = "chirp_3",
        stt_mode: str = "streaming",
        llm_model: str = "gemini-2.5-flash",
        tts_provider: str = "google-cloud",
        tts_model: str | None = None,
        tts_mode: str = "sync",
        warmup_iterations: int = 2,
        reference_text: str | None = None,
        stt_confidence: float | None = None,
        stt_latency_ms: float | None = None,
        server_final_timestamp_ms: float | None = None,
    ) -> Run0VoiceResponse:
        """Process pre-transcribed text through LLM → TTS pipeline.
        
        Used in streaming STT mode where the transcript comes from 
        the WebSocket streaming recognition (client-side).
        No STT processing is done here.
        
        Timestamp design for streaming mode:
            t0_user_end: Client timestamp when recording started/stopped
            t1_asr_final: Server timestamp when gRPC is_final received (= server_final_timestamp_ms)
            t1_5_llm_start: Server timestamp when this POST request arrived
            t2_llm_final: Server timestamp when LLM completed
            t2_5_tts_ready: Server timestamp when TTS completed
        
        STT latency = t1_asr_final - t0_user_end (mixed clocks, unavoidable)
        Network Transit = t1_5_llm_start - t1_asr_final (server-server ✅)
        LLM latency = t2_llm_final - t1_5_llm_start (server-server ✅)
        TTS latency = t2_5_tts_ready - t2_llm_final (server-server ✅)
        """
        # t1.5: Record when the server received this POST request
        t1_5_llm_start = time.time() * 1000
        
        # Use server's is_final timestamp as t1 if available (server clock)
        if server_final_timestamp_ms:
            t1_asr_final = server_final_timestamp_ms
        
        # Get or create session
        if session_id:
            is_timed_out = await self.session_service.check_session_timeout(session_id)
            if is_timed_out:
                from fastapi import HTTPException
                raise HTTPException(status_code=409, detail="Session has timed out")
            session = await self.session_service.get_by_id(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
        else:
            session = await self.session_service.create_run0_session(
                stt_model=stt_model,
                stt_mode=stt_mode,
                llm_model=llm_model,
                tts_provider=tts_provider,
                voice_id=voice_id,
                system_prompt=system_prompt or self.DEFAULT_SYSTEM_PROMPT,
                warmup_iterations=warmup_iterations,
            )
            session_id = session.id
        
        # Calculate WER/CER if reference text provided
        accuracy: dict[str, float | None] = {"wer": None, "cer": None}
        if reference_text and transcript and transcript != "[No speech detected]":
            from app.services.conversation.stt_service import calculate_accuracy
            accuracy = calculate_accuracy(transcript, reference_text)
        
        # Step 1: LLM - Generate response (STT already done on client)
        reply_text = await self._generate_llm_response(
            user_input=transcript,
            system_prompt=system_prompt or self.DEFAULT_SYSTEM_PROMPT,
            session_id=session_id,
            speaker_name=None,
            llm_model=llm_model,
        )
        t2_llm_final = time.time() * 1000
        
        input_tokens = len(transcript.split()) * 2
        output_tokens = len(reply_text.split()) * 2
        
        # Step 2: TTS - Convert response to speech
        if tts_provider == "gemini":
            tts_result = await self.gemini_tts_service.synthesize(
                text=reply_text,
                model=tts_model or "gemini-2.5-flash-preview-tts",
                voice_name=voice_id,
                save_file=True,
            )
        else:
            tts_result = await self.tts_service.synthesize(
                text=reply_text,
                voice_id=voice_id,
                save_file=True,
            )
        t2_5_tts_ready = time.time() * 1000
        
        # Save turns to database
        turn = await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.USER,
            speaker_name="User",
            content_text=transcript,
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
            t1_5_llm_start=t1_5_llm_start,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            model_name=llm_model,
            stt_provider="google",
            stt_model=stt_model,
            tts_provider=tts_provider,
            tts_voice=voice_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reference_text=reference_text,
            wer=accuracy.get("wer"),
            cer=accuracy.get("cer"),
        )
        turn_id = turn.id
        
        await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.AI,
            speaker_name="AI",
            content_text=reply_text,
            audio_url=tts_result.get("audio_url"),
            audio_duration_ms=tts_result.get("duration_ms"),
        )
        
        # Increment turn_index for next iteration
        await self.session_service.increment_turn_index(session_id)
        
        await self.session_service.calculate_metrics(session_id)
        
        # STT latency calculation:
        # - Streaming mode: use client-reported stt_latency_ms if available
        # - Fallback: t1 - t0 (mixed clocks, but best we can do)
        if stt_latency_ms is not None:
            asr_latency_ms = int(stt_latency_ms)
        else:
            asr_latency_ms = max(0, int(t1_asr_final - t0_user_end))
        # Network transit: t1.5 - t1 (server-server, accurate)
        network_transit_ms = max(0, int(t1_5_llm_start - t1_asr_final))
        # LLM: t2 - t1.5 (server-server, pure LLM processing)
        llm_latency_ms = int(t2_llm_final - t1_5_llm_start)
        # TTS: t2.5 - t2 (server-server)
        tts_latency_ms = int(t2_5_tts_ready - t2_llm_final)
        server_total_ms = int(t2_5_tts_ready - t1_5_llm_start)
        
        return Run0VoiceResponse(
            session_id=session_id,
            turn_id=turn_id,
            transcript=transcript,
            reply_text=reply_text,
            audio_url=tts_result.get("audio_url"),
            audio_base64=tts_result.get("audio_base64"),
            t1_asr_final=t1_asr_final,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            asr_latency_ms=asr_latency_ms,
            network_transit_ms=network_transit_ms,
            llm_latency_ms=llm_latency_ms,
            tts_latency_ms=tts_latency_ms,
            server_total_ms=server_total_ms,
            stt_confidence=stt_confidence,
            recognition_api="v2-streaming",
            reference_text=reference_text,
            wer=accuracy.get("wer"),
            cer=accuracy.get("cer"),
        )
    
    async def log_client_timestamp(
        self,
        request: Run0LogRequest,
    ) -> Run0LogResponse:
        """Log client-side timestamp when audio started playing.
        
        Args:
            request: Log request with t3 timestamp.
            
        Returns:
            Log response with E2E latency.
        """
        turn = await self.session_service.update_turn_timestamp(
            turn_id=request.turn_id,
            t3_audio_play_start=request.t3_audio_play_start,
        )
        
        if not turn:
            return Run0LogResponse(
                success=False,
                e2e_latency_ms=0,
            )
        
        # Incremental Metric Update: Calculate metrics now that we have the full turn data including t3
        await self.session_service.calculate_metrics(turn.session_id)
        
        # Calculate E2E latency
        e2e_latency_ms = 0
        if turn.t0_user_end and turn.t3_audio_play_start:
            e2e_latency_ms = int(turn.t3_audio_play_start - turn.t0_user_end)
        
        return Run0LogResponse(
            success=True,
            e2e_latency_ms=e2e_latency_ms,
        )
    
    async def _generate_llm_response(
        self,
        user_input: str,
        system_prompt: str,
        session_id: UUID | None,
        speaker_name: str | None = None,
        llm_model: str = "gemini-2.5-flash",
    ) -> str:
        """Generate LLM response using Gemini.
        
        Args:
            user_input: User's transcribed speech.
            system_prompt: Fallback system prompt if no template context.
            session_id: Session ID for context.
            speaker_name: Current AI speaker name for context.
            
        Returns:
            Generated response text.
        """
        # Get conversation history for context (only if session exists)
        turns = []
        if session_id:
            turns = await self.session_service.get_session_turns(session_id)
        
        # Build dynamic context with persona and scene
        context = system_prompt
        if session_id:
            built_context = await self.build_llm_context(session_id, speaker_name)
            if built_context and built_context != self.DEFAULT_SYSTEM_PROMPT:
                context = built_context

        # Use the model passed from caller
        effective_model = llm_model
        if session_id:
            try:
                session = await self.session_service.get_by_id(session_id)
                if session and session.variant:
                    import json
                    v = json.loads(session.variant)
                    effective_model = v.get("llm_model", llm_model)
            except:
                pass

        # Create model
        model = genai.GenerativeModel(
            model_name=effective_model,
        )
        
        # Prepend system instruction to history as a fake turn if needed
        # or just prepend to the first message if history is empty.
        # Strategy: Add system prompt as a User message, and a dummy Model acknowledgment.
        api_history = []
        
        # Add system context
        api_history.append({"role": "user", "parts": [context]})
        api_history.append({"role": "model", "parts": ["Understood. I will act as the specified persona."]})
        
        # Append actual conversation history
        for turn in turns[-10:]:  # Last 10 turns for context
            if turn.turn_type == "user":
                api_history.append({"role": "user", "parts": [turn.content_text or ""]})
            elif turn.turn_type == "ai":
                api_history.append({"role": "model", "parts": [turn.content_text or ""]})
        
        # Start chat with history
        chat = model.start_chat(history=api_history)
        
        # Generate response
        try:
            response = chat.send_message(user_input)
            return response.text.strip()
        except Exception as e:
            print(f"LLM Generation Error: {e}")
            return "I apologize, but I am having trouble responding right now."
    
    async def get_test_phrases(self) -> list[str]:
        """Get default test phrases for RUN0 testing.
        
        Returns:
            List of test phrases.
        """
        return [
            "Hello everyone, I am ready to start now.",
            "I think the first option is the best choice.",
            "Actually, I am not really sure about that.",
            "What do you think we should do next?",
            "Could you tell me more about the secret?",
        ]
    
        return "\n\n".join(context_parts)

    def _get_difficulty_instruction(self, difficulty: int | None) -> str:
        """Get system instruction for specific difficulty level."""
        if not difficulty:
            return ""
            
        instructions = {
            1: "Use very simple words and short sentences (max 5 words). Speak slowly and clearly like talking to a beginner.",
            2: "Use simple daily vocabulary. Keep sentences short and easy to understand.",
            3: "Use standard conversational English. Speak at a moderate pace.",
            4: "Use more complex sentence structures and varied vocabulary.",
            5: "Use advanced vocabulary, idioms, and speak at a natural, fast pace like a native speaker."
        }
        return instructions.get(difficulty, "")

    async def build_llm_context(
        self,
        session_id: UUID,
        current_speaker_name: str | None = None,
    ) -> str:
        """Build LLM context with participant information.
        
        Args:
            session_id: Session ID.
            current_speaker_name: Name of the current AI speaker.
            
        Returns:
            Formatted context string for LLM.
        """
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session or not session.template:
            return self.DEFAULT_SYSTEM_PROMPT
        
        template = session.template
        participants = template.participants
        
        # Format participant info
        participants_info = []
        current_speaker = None
        for p in participants:
            role_desc = f"- **{p.name}** ({p.participant_type})"
            if p.persona:
                role_desc += f": {p.persona}"
            participants_info.append(role_desc)
            
            if current_speaker_name and p.name == current_speaker_name:
                current_speaker = p
        
        # Build context
        context_parts = []
        
        # Scene context
        if template.scene_context:
            context_parts.append(f"""[Scene Context]
{template.scene_context}""")
        elif template.description:
            context_parts.append(f"""[Scene Context]
{template.description}""")
        
        # Topic
        if template.topic:
            context_parts.append(f"[Topic] {template.topic}")
        
        # Participants
        context_parts.append(f"""[Participants]
{chr(10).join(participants_info)}""")
        
        # User info
        user_name = session.user_name or "User"
        context_parts.append(f"""[User Information]
The student's name is {user_name}. Use their name naturally in conversation.""")
        
        # Difficulty Instruction
        difficulty = session.difficulty or template.difficulty
        diff_instruction = self._get_difficulty_instruction(difficulty)
        
        # Current speaker role
        if current_speaker:
            context_parts.append(f"""[Your Role]
You are {current_speaker.name}. {current_speaker.persona or ''}
{template.system_prompt}

[Difficulty Instruction]
{diff_instruction}""")
        else:
            context_parts.append(f"""[System Instructions]
{template.system_prompt}

[Difficulty Instruction]
{diff_instruction}""")
        
        return "\n\n".join(context_parts)
    
    async def generate_greeting(
        self,
        session_id: UUID,
        voice_id: str | None = None,
        custom_greeting: str | None = None,
    ) -> dict:
        """Generate greeting for the first speaker when session starts.
        
        Args:
            session_id: Session ID.
            voice_id: Optional TTS voice ID override.
            custom_greeting: Optional custom greeting text override.
            
        Returns:
            Dict with greeting text, audio_url, and speaker info.
        """
        session = await self.session_service.get_by_id_with_template(session_id)
        if not session or not session.template:
            raise ValueError(f"Session {session_id} not found or has no template")
        
        template = session.template
        participants = template.participants
        
        # Determine first speaker based on template setting
        first_speaker = template.first_speaker  # moderator_first, ai_first, user_first
        
        if first_speaker == "user_first":
            # User speaks first, no greeting needed
            return {
                "greeting_text": None,
                "audio_url": None,
                "speaker_name": None,
                "speaker_type": "user",
            }
        
        # Find the appropriate greeter
        greeter = None
        if first_speaker == "moderator_first":
            # Find moderator
            for p in participants:
                if p.participant_type == "moderator":
                    greeter = p
                    break
        elif first_speaker == "ai_first":
            # Find first AI (not moderator, not user)
            for p in participants:
                if p.participant_type == "ai":
                    greeter = p
                    break
        
        # Fallback to first non-user participant
        if not greeter:
            for p in participants:
                if p.participant_type != "user":
                    greeter = p
                    break
        
        if not greeter:
            return {
                "greeting_text": None,
                "audio_url": None,
                "speaker_name": None,
                "speaker_type": None,
            }
        
        # Get greeting text (priority: custom_greeting > participant > template > LLM generated)
        greeting_text = custom_greeting or greeter.greeting_message or template.greeting_message
        
        # If no preset greeting, generate one using LLM
        if not greeting_text:
            context = await self.build_llm_context(
                session_id=session_id,
                current_speaker_name=greeter.name,
            )
            
            # Determine model
            llm_model = "gemini-2.5-flash"
            if session.variant:
                try:
                    import json
                    v = json.loads(session.variant)
                    llm_model = v.get("llm_model", "gemini-2.5-flash")
                except:
                    pass

            model = genai.GenerativeModel(model_name=llm_model)
            user_name = session.user_name or "the student"
            
            prompt = f"""{context}

[Task]
Generate a friendly, natural greeting to start the conversation.
The greeting should:
1. Introduce yourself as {greeter.name}
2. Greet {user_name} warmly
3. Set the stage for the conversation topic
4. Be 1-3 sentences long

Respond ONLY with the greeting, nothing else."""
            
            response = model.generate_content(prompt)
            greeting_text = response.text.strip()
        
        # Get voice (priority: passed voice_id > participant voice_id > default)
        final_voice_id = voice_id or greeter.voice_id or "en-US-Wavenet-F"
        tts_result = await self.tts_service.synthesize(
            text=greeting_text,
            voice_id=final_voice_id,
            save_file=True,
        )
        
        # Save greeting as a turn
        await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.MODERATOR if greeter.participant_type == "moderator" else TurnType.AI,
            speaker_name=greeter.name,
            content_text=greeting_text,
            audio_url=tts_result.get("audio_url"),
            audio_duration_ms=tts_result.get("duration_ms"),
            tts_provider="google",
            tts_voice=voice_id,
        )
        
        # Update session's current speaker type
        await self.session_service.update_current_speaker(
            session_id=session_id,
            speaker_type="user",  # After greeting, it's user's turn
        )
        
        return {
            "greeting_text": greeting_text,
            "audio_url": tts_result.get("audio_url"),
            "audio_base64": tts_result.get("audio_base64"),
            "speaker_name": greeter.name,
            "speaker_type": greeter.participant_type,
            "audio_duration_ms": tts_result.get("duration_ms"),
        }

