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
        difficulty: int | None = None,
        estimated_minutes: int | None = None,
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
        # Get or create session
        if session_id:
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
            raise ValueError("Either session_id or template_id required")
        
        # Step 1: STT - Convert speech to text
        stt_result = await self.stt_service.transcribe(
            audio_data=audio_data,
            audio_format=audio_format,
        )
        t1_asr_final = time.time() * 1000  # Current timestamp in ms
        
        transcript = stt_result["transcript"]
        if not transcript:
            transcript = "[No speech detected]"
        
        # Step 2: LLM - Generate response
        llm_start = time.time()
        reply_text = await self._generate_llm_response(
            user_input=transcript,
            system_prompt=system_prompt or self.DEFAULT_SYSTEM_PROMPT,
            session_id=session_id,
        )
        t2_llm_final = time.time() * 1000
        
        # Calculate tokens (rough estimate)
        input_tokens = len(transcript.split()) * 2  # Rough token estimate
        output_tokens = len(reply_text.split()) * 2
        
        # Step 3: TTS - Convert response to speech
        tts_result = await self.tts_service.synthesize(
            text=reply_text,
            voice_id=voice_id,
            save_file=True,
        )
        t2_5_tts_ready = time.time() * 1000
        
        # Save turn to database
        turn = await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.USER,
            speaker_name="User",
            content_text=transcript,
            audio_duration_ms=stt_result.get("duration_ms"),
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            model_name="gemini-2.0-flash",
            stt_provider="google",
            tts_provider="google",
            tts_voice=voice_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        
        # Also save AI response as a separate turn
        await self.session_service.add_turn(
            session_id=session_id,
            turn_type=TurnType.AI,
            speaker_name="AI",
            content_text=reply_text,
            audio_url=tts_result.get("audio_url"),
            audio_duration_ms=tts_result.get("duration_ms"),
        )
        
        # Calculate latencies
        asr_latency_ms = int(t1_asr_final - t0_user_end)
        llm_latency_ms = int(t2_llm_final - t1_asr_final)
        tts_latency_ms = int(t2_5_tts_ready - t2_llm_final)
        server_total_ms = int(t2_5_tts_ready - t0_user_end)
        
        return Run0VoiceResponse(
            session_id=session_id,
            turn_id=turn.id,
            transcript=transcript,
            reply_text=reply_text,
            audio_url=tts_result.get("audio_url"),
            audio_base64=tts_result.get("audio_base64"),
            t1_asr_final=t1_asr_final,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            asr_latency_ms=asr_latency_ms,
            llm_latency_ms=llm_latency_ms,
            tts_latency_ms=tts_latency_ms,
            server_total_ms=server_total_ms,
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
        session_id: UUID,
    ) -> str:
        """Generate LLM response using Gemini.
        
        Args:
            user_input: User's transcribed speech.
            system_prompt: System prompt for the conversation.
            session_id: Session ID for context.
            
        Returns:
            Generated response text.
        """
        # Get conversation history for context
        turns = await self.session_service.get_session_turns(session_id)
        
        # Build conversation history
        history = []
        for turn in turns[-10:]:  # Last 10 turns for context
            if turn.turn_type == "user":
                history.append({"role": "user", "parts": [turn.content_text or ""]})
            elif turn.turn_type == "ai":
                history.append({"role": "model", "parts": [turn.content_text or ""]})
        
        # Create model (system prompts handled via first message)
        model = genai.GenerativeModel(model_name="gemini-2.0-flash")
        
        # Start chat with history
        chat = model.start_chat(history=history)
        
        # Build message with system context for first turn
        if not history:
            # First turn - include system prompt
            message = f"""[System Instructions]
{system_prompt}

[User Message]
{user_input}"""
        else:
            message = user_input
        
        # Generate response
        response = chat.send_message(message)
        
        return response.text.strip()
    
    async def get_test_phrases(self) -> list[str]:
        """Get default test phrases for RUN0 testing.
        
        Returns:
            List of test phrases.
        """
        return [
            "Hi, can you hear me?",
            "I'm testing a multi-person English conversation demo.",
            "I watched a video about Taylor Swift and New York.",
            "I need a table for ten people and three sessions.",
            "Wait—really? That's amazing!",
        ]
