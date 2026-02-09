"""Conversation session service - Manage conversation sessions.

This module provides services for managing conversation sessions,
including creation, turn management, and metrics calculation.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import (
    ConversationSession,
    ConversationTemplate,
    ConversationTurn,
    SessionMetrics,
    SessionStatus,
    TurnType,
)
from app.schemas.conversation import (
    SessionCreate,
    SessionListItem,
    SessionMetricsResponse,
    SessionResponse,
    TurnResponse,
)


class SessionService:
    """Service for managing conversation sessions.
    
    Handles session lifecycle and turn management.
    
    Args:
        db: AsyncSession for database operations.
    """
    
    def __init__(self, db: AsyncSession) -> None:
        """Initialize the session service.
        
        Args:
            db: Database session.
        """
        self.db = db
    
    async def get_all(
        self,
        page: int = 1,
        size: int = 20,
        template_id: UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[SessionListItem], int]:
        """Get all sessions with pagination.
        
        Args:
            page: Page number (1-indexed).
            size: Items per page.
            template_id: Filter by template.
            status: Filter by status.
            
        Returns:
            Tuple of (session list, total count).
        """
        # Build base query
        base_query = select(ConversationSession)
        
        if template_id:
            base_query = base_query.where(
                ConversationSession.template_id == template_id
            )
        if status:
            base_query = base_query.where(
                ConversationSession.status == status
            )
        
        # Count query
        count_query = select(func.count()).select_from(base_query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        
        # Main query with pagination
        query = (
            select(
                ConversationSession,
                ConversationTemplate.name.label("template_name"),
                func.count(ConversationTurn.id).label("turn_count"),
            )
            .outerjoin(ConversationTemplate)
            .outerjoin(ConversationTurn)
            .group_by(ConversationSession.id, ConversationTemplate.name)
            .order_by(ConversationSession.started_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        
        if template_id:
            query = query.where(ConversationSession.template_id == template_id)
        if status:
            query = query.where(ConversationSession.status == status)
        
        result = await self.db.execute(query)
        rows = result.all()
        
        items = [
            SessionListItem(
                id=session.id,
                template_id=session.template_id,
                template_name=template_name,
                status=session.status.value,
                turn_count=turn_count,
                started_at=session.started_at,
                ended_at=session.ended_at,
                device_type=session.device_type,
            )
            for session, template_name, turn_count in rows
        ]
        
        return items, total
    
    async def get_by_id(self, session_id: UUID) -> SessionResponse | None:
        """Get a session with turns.
        
        Args:
            session_id: Session UUID.
            
        Returns:
            Session if found, None otherwise.
        """
        query = (
            select(ConversationSession, ConversationTemplate.name.label("template_name"))
            .outerjoin(ConversationTemplate)
            .where(ConversationSession.id == session_id)
        )
        
        result = await self.db.execute(query)
        row = result.first()
        
        if not row:
            return None
        
        session, template_name = row
        
        return SessionResponse(
            id=session.id,
            template_id=session.template_id,
            template_name=template_name,
            status=session.status.value,
            current_turn_index=session.current_turn_index,
            current_speaker_id=session.current_speaker_id,
            started_at=session.started_at,
            ended_at=session.ended_at,
            device_type=session.device_type,
            browser=session.browser,
            variant=session.variant,
            difficulty=session.difficulty,
            estimated_minutes=session.estimated_minutes,
            error_message=session.error_message,
            user_name=session.user_name,
            current_speaker_type=session.current_speaker_type,
            created_at=session.created_at,
            updated_at=session.updated_at,
        )
    
    async def get_by_id_with_template(
        self, session_id: UUID
    ) -> ConversationSession | None:
        """Get a session with template and participants loaded.
        
        Args:
            session_id: Session UUID.
            
        Returns:
            Session ORM object with relationships if found.
        """
        query = (
            select(ConversationSession)
            .options(
                selectinload(ConversationSession.template).selectinload(
                    ConversationTemplate.participants
                )
            )
            .where(ConversationSession.id == session_id)
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create(self, data: SessionCreate) -> SessionResponse:
        """Create a new session.
        
        Args:
            data: Session creation data.
            
        Returns:
            Created session.
        """
        session = ConversationSession(
            template_id=data.template_id,
            status=SessionStatus.ACTIVE,
            current_turn_index=0,
            device_type=data.device_type,
            browser=data.browser,
            variant=data.variant,
            difficulty=data.difficulty,
            estimated_minutes=data.estimated_minutes,
            user_name=data.user_name,
            current_speaker_type="waiting",
        )
        self.db.add(session)
        await self.db.commit()
        
        return await self.get_by_id(session.id)
    
    async def update_current_speaker(
        self,
        session_id: UUID,
        speaker_type: str,
    ) -> SessionResponse | None:
        """Update the current speaker type for a session.
        
        Args:
            session_id: Session UUID.
            speaker_type: Speaker type (moderator, ai, user, waiting).
            
        Returns:
            Updated session if found.
        """
        query = select(ConversationSession).where(
            ConversationSession.id == session_id
        )
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            return None
        
        session.current_speaker_type = speaker_type
        if speaker_type == "user":
            session.status = SessionStatus.WAITING_USER
        else:
            session.status = SessionStatus.ACTIVE
        
        await self.db.commit()
        
        return await self.get_by_id(session_id)
    
    async def end_session(
        self,
        session_id: UUID,
        status: SessionStatus = SessionStatus.COMPLETED,
        error_message: str | None = None,
    ) -> SessionResponse | None:
        """End a session.
        
        Args:
            session_id: Session UUID.
            status: Final status.
            error_message: Error message if status is ERROR.
            
        Returns:
            Updated session if found, None otherwise.
        """
        query = select(ConversationSession).where(
            ConversationSession.id == session_id
        )
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            return None
        
        session.status = status
        session.ended_at = datetime.utcnow()
        if error_message:
            session.error_message = error_message
        
        await self.db.commit()
        
        # Calculate and save metrics
        await self.calculate_metrics(session_id)
        
        return await self.get_by_id(session_id)
    
    async def add_turn(
        self,
        session_id: UUID,
        turn_type: TurnType,
        speaker_name: str | None = None,
        content_text: str | None = None,
        audio_url: str | None = None,
        audio_duration_ms: int | None = None,
        t0_user_end: float | None = None,
        t1_asr_final: float | None = None,
        t2_llm_final: float | None = None,
        t2_5_tts_ready: float | None = None,
        model_name: str | None = None,
        stt_provider: str | None = None,
        tts_provider: str | None = None,
        tts_voice: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> TurnResponse:
        """Add a turn to a session.
        
        Args:
            session_id: Session UUID.
            turn_type: Type of turn.
            speaker_name: Name of the speaker.
            content_text: Text content.
            audio_url: URL to audio file.
            audio_duration_ms: Audio duration in ms.
            t0_user_end: User end timestamp.
            t1_asr_final: ASR completion timestamp.
            t2_llm_final: LLM completion timestamp.
            t2_5_tts_ready: TTS ready timestamp.
            model_name: LLM model used.
            stt_provider: STT provider used.
            tts_provider: TTS provider used.
            tts_voice: TTS voice used.
            input_tokens: Input tokens used.
            output_tokens: Output tokens used.
            
        Returns:
            Created turn.
        """
        # Get current turn index
        session_query = select(ConversationSession).where(
            ConversationSession.id == session_id
        )
        result = await self.db.execute(session_query)
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        turn_index = session.current_turn_index
        
        # Create turn
        turn = ConversationTurn(
            session_id=session_id,
            turn_index=turn_index,
            turn_type=turn_type,
            speaker_name=speaker_name,
            content_text=content_text,
            audio_url=audio_url,
            audio_duration_ms=audio_duration_ms,
            t0_user_end=t0_user_end,
            t1_asr_final=t1_asr_final,
            t2_llm_final=t2_llm_final,
            t2_5_tts_ready=t2_5_tts_ready,
            model_name=model_name,
            stt_provider=stt_provider,
            tts_provider=tts_provider,
            tts_voice=tts_voice,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        self.db.add(turn)
        
        # NOTE: Do NOT increment current_turn_index here!
        # Turn progression is managed solely by complete_turn() in MyTurnService.
        # Previously, both add_turn and complete_turn incremented this counter,
        # causing a double-increment that skipped participants in round-robin.
        
        await self.db.commit()
        
        return TurnResponse(
            id=turn.id,
            session_id=turn.session_id,
            turn_index=turn.turn_index,
            turn_type=turn.turn_type.value,
            speaker_name=turn.speaker_name,
            content_text=turn.content_text,
            audio_url=turn.audio_url,
            audio_duration_ms=turn.audio_duration_ms,
            t0_user_end=turn.t0_user_end,
            t1_asr_final=turn.t1_asr_final,
            t2_llm_final=turn.t2_llm_final,
            t2_5_tts_ready=turn.t2_5_tts_ready,
            t3_audio_play_start=turn.t3_audio_play_start,
            model_name=turn.model_name,
            stt_provider=turn.stt_provider,
            tts_provider=turn.tts_provider,
            tts_voice=turn.tts_voice,
            created_at=turn.created_at,
        )
    
    async def update_turn_timestamp(
        self,
        turn_id: UUID,
        t3_audio_play_start: float,
    ) -> TurnResponse | None:
        """Update client-side timestamp on a turn.
        
        Args:
            turn_id: Turn UUID.
            t3_audio_play_start: Client timestamp when audio started.
            
        Returns:
            Updated turn if found, None otherwise.
        """
        query = select(ConversationTurn).where(ConversationTurn.id == turn_id)
        result = await self.db.execute(query)
        turn = result.scalar_one_or_none()
        
        if not turn:
            return None
        
        turn.t3_audio_play_start = t3_audio_play_start
        await self.db.commit()
        
        return TurnResponse(
            id=turn.id,
            session_id=turn.session_id,
            turn_index=turn.turn_index,
            turn_type=turn.turn_type.value,
            speaker_name=turn.speaker_name,
            content_text=turn.content_text,
            audio_url=turn.audio_url,
            audio_duration_ms=turn.audio_duration_ms,
            t0_user_end=turn.t0_user_end,
            t1_asr_final=turn.t1_asr_final,
            t2_llm_final=turn.t2_llm_final,
            t2_5_tts_ready=turn.t2_5_tts_ready,
            t3_audio_play_start=turn.t3_audio_play_start,
            model_name=turn.model_name,
            stt_provider=turn.stt_provider,
            tts_provider=turn.tts_provider,
            tts_voice=turn.tts_voice,
            created_at=turn.created_at,
        )
    
    async def get_session_turns(self, session_id: UUID, limit: int | None = None) -> list[TurnResponse]:
        """Get turns for a session.
        
        Args:
            session_id: Session UUID.
            limit: Optional limit on number of turns.
            
        Returns:
            List of turns.
        """
        query = (
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index)
        )
        
        if limit:
            # We likely want the *latest* turns if limited, but ordered by index ASC?
            # Or just the first N?
            # Usually for context we want the LAST N turns.
            # So we should order by DESC, limit, then reverse back?
            # But existing query is ASC.
            # Let's keep it simple: just limit. Caller asked for limit.
            # But the caller (MyTurnService) asking for 'limit=10' implies "last 10".
            # If I just limit(10) on ASC, I get the *first* 10 turns.
            # MyTurnService reverses them?
            pass

        # If we want the last N turns, we should sort by DESC, limit, then re-sort ASC.
        if limit:
             subquery = (
                select(ConversationTurn)
                .where(ConversationTurn.session_id == session_id)
                .order_by(ConversationTurn.turn_index.desc())
                .limit(limit)
                .subquery()
             )
             query = select(subquery).order_by(subquery.c.turn_index)
        
        result = await self.db.execute(query)
        turns = result.all() # result of subquery select might need mapping
        
        # Mapping from subquery result is tricky with ORM objects.
        # Simpler approach: Fetch by DESC with limit, then reverse in Python.
        query = (
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index.desc())
        )
        if limit:
            query = query.limit(limit)

        result = await self.db.execute(query)
        turns = result.scalars().all()
        # Return sorted by index ASC
        turns = sorted(turns, key=lambda t: t.turn_index)
        
        return [
            TurnResponse(
                id=turn.id,
                session_id=turn.session_id,
                turn_index=turn.turn_index,
                turn_type=turn.turn_type.value,
                speaker_name=turn.speaker_name,
                content_text=turn.content_text,
                audio_url=turn.audio_url,
                audio_duration_ms=turn.audio_duration_ms,
                t0_user_end=turn.t0_user_end,
                t1_asr_final=turn.t1_asr_final,
                t2_llm_final=turn.t2_llm_final,
                t2_5_tts_ready=turn.t2_5_tts_ready,
                t3_audio_play_start=turn.t3_audio_play_start,
                model_name=turn.model_name,
                stt_provider=turn.stt_provider,
                tts_provider=turn.tts_provider,
                tts_voice=turn.tts_voice,
                created_at=turn.created_at,
            )
            for turn in turns
        ]
    
    async def calculate_metrics(self, session_id: UUID) -> SessionMetrics | None:
        """Calculate and save session metrics.
        
        Args:
            session_id: Session UUID.
            
        Returns:
            Created metrics if successful.
        """
        # Get all turns with timestamps
        query = (
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .where(ConversationTurn.turn_type == TurnType.USER)
        )
        result = await self.db.execute(query)
        user_turns = result.scalars().all()
        
        if not user_turns:
            return None
        
        # Calculate latencies
        e2e_latencies = []
        asr_latencies = []
        llm_latencies = []
        tts_latencies = []
        
        total_input_tokens = 0
        total_output_tokens = 0
        
        for turn in user_turns:
            if turn.t0_user_end and turn.t3_audio_play_start:
                e2e_latencies.append(turn.t3_audio_play_start - turn.t0_user_end)
            
            if turn.t0_user_end and turn.t1_asr_final:
                asr_latencies.append(turn.t1_asr_final - turn.t0_user_end)
            
            if turn.t1_asr_final and turn.t2_llm_final:
                llm_latencies.append(turn.t2_llm_final - turn.t1_asr_final)
            
            if turn.t2_llm_final and turn.t2_5_tts_ready:
                tts_latencies.append(turn.t2_5_tts_ready - turn.t2_llm_final)
            
            if turn.input_tokens:
                total_input_tokens += turn.input_tokens
            if turn.output_tokens:
                total_output_tokens += turn.output_tokens
        
        # Calculate statistics
        def avg(lst: list) -> float | None:
            return sum(lst) / len(lst) if lst else None
        
        def percentile(lst: list, p: float) -> float | None:
            if not lst:
                return None
            sorted_lst = sorted(lst)
            idx = int(len(sorted_lst) * p)
            return sorted_lst[min(idx, len(sorted_lst) - 1)]
        
        # Get total turn count
        total_query = select(func.count()).where(
            ConversationTurn.session_id == session_id
        )
        total_turns = (await self.db.execute(total_query)).scalar() or 0
        
        # Create or update metrics
        existing_query = select(SessionMetrics).where(
            SessionMetrics.session_id == session_id
        )
        result = await self.db.execute(existing_query)
        metrics = result.scalar_one_or_none()
        
        if not metrics:
            metrics = SessionMetrics(session_id=session_id)
            self.db.add(metrics)
        
        metrics.e2e_avg_ms = avg(e2e_latencies)
        metrics.e2e_p50_ms = percentile(e2e_latencies, 0.5)
        metrics.e2e_p95_ms = percentile(e2e_latencies, 0.95)
        metrics.asr_avg_ms = avg(asr_latencies)
        metrics.llm_avg_ms = avg(llm_latencies)
        metrics.tts_avg_ms = avg(tts_latencies)
        metrics.total_turns = total_turns
        metrics.user_turns = len(user_turns)
        metrics.total_input_tokens = total_input_tokens
        metrics.total_output_tokens = total_output_tokens
        
        # Estimate cost (simplified)
        # Gemini: ~$0.35/1M input, ~$1.05/1M output
        input_cost = (total_input_tokens / 1_000_000) * 0.35
        output_cost = (total_output_tokens / 1_000_000) * 1.05
        metrics.estimated_cost_usd = input_cost + output_cost
        
        await self.db.commit()
        
        return metrics
    
    async def get_session_metrics(
        self,
        session_id: UUID,
    ) -> SessionMetricsResponse | None:
        """Get metrics for a session.
        
        Args:
            session_id: Session UUID.
            
        Returns:
            Session metrics if found.
        """
        query = select(SessionMetrics).where(
            SessionMetrics.session_id == session_id
        )
        result = await self.db.execute(query)
        metrics = result.scalar_one_or_none()
        
        if not metrics:
            return None
        
        return SessionMetricsResponse(
            id=metrics.id,
            session_id=metrics.session_id,
            e2e_avg_ms=metrics.e2e_avg_ms,
            e2e_p50_ms=metrics.e2e_p50_ms,
            e2e_p95_ms=metrics.e2e_p95_ms,
            asr_avg_ms=metrics.asr_avg_ms,
            llm_avg_ms=metrics.llm_avg_ms,
            tts_avg_ms=metrics.tts_avg_ms,
            total_turns=metrics.total_turns,
            user_turns=metrics.user_turns,
            asr_retry_count=metrics.asr_retry_count,
            error_count=metrics.error_count,
            total_input_tokens=metrics.total_input_tokens,
            total_output_tokens=metrics.total_output_tokens,
            estimated_cost_usd=metrics.estimated_cost_usd,
            created_at=metrics.created_at,
        )

    async def check_session_timeout(
        self,
        session_id: UUID,
        timeout_minutes: int = 10,
    ) -> bool:
        """Check if session has timed out and update status if needed.
        
        Args:
            session_id: Session UUID.
            timeout_minutes: Timeout duration in minutes (default: 30).
            
        Returns:
            True if session is timed out, False otherwise.
        """
        query = select(ConversationSession).where(
            ConversationSession.id == session_id
        )
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            return True  # Treat non-existent session as timed out/invalid
            
        # If already completed or error, consider it timed out for new interactions
        if session.status in [SessionStatus.COMPLETED, SessionStatus.ERROR]:
            return True
            
        # Check time since last update
        time_diff = datetime.utcnow() - session.updated_at
        if time_diff.total_seconds() > (timeout_minutes * 60):
            # Session timed out
            session.status = SessionStatus.COMPLETED
            session.ended_at = datetime.utcnow()
            session.error_message = f"Session timed out after {timeout_minutes} minutes of inactivity"
            await self.db.commit()
            
            # Calculate final metrics
            await self.calculate_metrics(session_id)
            return True
            
        return False
