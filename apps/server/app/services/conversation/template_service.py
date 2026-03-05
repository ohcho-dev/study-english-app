"""Conversation template service - CRUD operations for templates.

This module provides services for managing conversation templates
and their participants.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import (
    ConversationParticipant,
    ConversationTemplate,
)
from app.schemas.conversation import (
    ParticipantResponse,
    TemplateCreate,
    TemplateListItem,
    TemplateResponse,
    TemplateUpdate,
)


class TemplateService:
    """Service for managing conversation templates.
    
    Handles CRUD operations for templates and their participants.
    
    Args:
        db: AsyncSession for database operations.
    """
    
    def __init__(self, db: AsyncSession) -> None:
        """Initialize the template service.
        
        Args:
            db: Database session.
        """
        self.db = db
    
    async def get_all(
        self,
        page: int = 1,
        size: int = 20,
        active_only: bool = True,
        tester_only: bool = False,
    ) -> tuple[list[TemplateListItem], int]:
        """Get all templates with pagination.
        
        Args:
            page: Page number (1-indexed).
            size: Items per page.
            active_only: Only return active templates.
            tester_only: Only return templates visible to testers.
            
        Returns:
            Tuple of (template list, total count).
        """
        # Build base query
        base_query = select(ConversationTemplate)
        if active_only:
            base_query = base_query.where(ConversationTemplate.is_active.is_(True))
        if tester_only:
            base_query = base_query.where(ConversationTemplate.is_public_to_tester.is_(True))
        
        # Count query
        count_query = select(func.count()).select_from(base_query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        
        # Main query with pagination
        query = (
            select(
                ConversationTemplate,
                func.count(ConversationParticipant.id).label("participant_count"),
            )
            .outerjoin(ConversationParticipant)
            .group_by(ConversationTemplate.id)
            .order_by(ConversationTemplate.updated_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        
        if active_only:
            query = query.where(ConversationTemplate.is_active.is_(True))
        if tester_only:
            query = query.where(ConversationTemplate.is_public_to_tester.is_(True))
        
        result = await self.db.execute(query)
        rows = result.all()
        
        items = [
            TemplateListItem(
                id=template.id,
                name=template.name,
                description=template.description,
                mode=template.mode.value if hasattr(template.mode, 'value') else template.mode,
                topic=template.topic,
                difficulty=template.difficulty,
                participant_count=participant_count,
                is_active=template.is_active,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
            for template, participant_count in rows
        ]
        
        return items, total
    
    async def get_by_id(self, template_id: UUID) -> TemplateResponse | None:
        """Get a template with all participants.
        
        Args:
            template_id: Template UUID.
            
        Returns:
            Template with participants if found, None otherwise.
        """
        query = (
            select(ConversationTemplate)
            .options(selectinload(ConversationTemplate.participants))
            .where(ConversationTemplate.id == template_id)
        )
        
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            return None
        
        return TemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            mode=template.mode.value if hasattr(template.mode, 'value') else template.mode,
            system_prompt=template.system_prompt,
            greeting_message=template.greeting_message,
            topic=template.topic,
            difficulty=template.difficulty,
            estimated_minutes=template.estimated_minutes,
            is_active=template.is_active,
            first_speaker=template.first_speaker.value if hasattr(template.first_speaker, 'value') else template.first_speaker,
            scene_context=template.scene_context,
            director_system_prompt=template.director_system_prompt,
            director_llm_model=template.director_llm_model,
            # Narrative Sync v0.2
            pipeline_mode=template.pipeline_mode,
            evaluator_prompt=template.evaluator_prompt,
            planner_prompt=template.planner_prompt,
            conductor_prompt=template.conductor_prompt,
            evaluator_llm_model=template.evaluator_llm_model,
            planner_llm_model=template.planner_llm_model,
            conductor_llm_model=template.conductor_llm_model,
            level_definitions=template.level_definitions,
            participants=[
                ParticipantResponse(
                    id=p.id,
                    template_id=p.template_id,
                    participant_type=p.participant_type.value if hasattr(p.participant_type, 'value') else p.participant_type,
                    name=p.name,
                    persona=p.persona,
                    voice_id=p.voice_id,
                    voice_settings=p.voice_settings,
                    order_index=p.order_index,
                    difficulty=p.difficulty,
                    greeting_message=p.greeting_message,
                    avatar_url=p.avatar_url,
                    llm_model=p.llm_model,
                    stt_model=p.stt_model,
                    stt_mode=p.stt_mode,
                    stt_streaming_display=p.stt_streaming_display,
                    tts_model=p.tts_model,
                    tts_provider=p.tts_provider,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                )
                for p in sorted(template.participants, key=lambda x: x.order_index)
            ],
            created_at=template.created_at,
            updated_at=template.updated_at,
        )
    
    async def create(self, data: TemplateCreate) -> TemplateResponse:
        """Create a new template with participants.
        
        Args:
            data: Template creation data.
            
        Returns:
            Created template with participants.
        """
        # Create template
        template = ConversationTemplate(
            name=data.name,
            description=data.description,
            mode=data.mode,
            system_prompt=data.system_prompt,
            greeting_message=data.greeting_message,
            topic=data.topic,
            difficulty=data.difficulty,
            estimated_minutes=data.estimated_minutes,
            is_active=data.is_active,
            first_speaker=data.first_speaker,
            scene_context=data.scene_context,
            director_system_prompt=data.director_system_prompt,
            director_llm_model=data.director_llm_model,
            # Narrative Sync v0.2
            pipeline_mode=data.pipeline_mode,
            evaluator_prompt=data.evaluator_prompt,
            planner_prompt=data.planner_prompt,
            conductor_prompt=data.conductor_prompt,
            evaluator_llm_model=data.evaluator_llm_model,
            planner_llm_model=data.planner_llm_model,
            conductor_llm_model=data.conductor_llm_model,
            level_definitions=data.level_definitions,
        )
        self.db.add(template)
        await self.db.flush()
        
        # Create participants
        for p_data in data.participants:
            participant = ConversationParticipant(
                template_id=template.id,
                participant_type=p_data.participant_type,
                name=p_data.name,
                persona=p_data.persona,
                voice_id=p_data.voice_id,
                voice_settings=p_data.voice_settings.model_dump() if p_data.voice_settings else None,
                order_index=p_data.order_index,
                difficulty=p_data.difficulty,
                llm_model=p_data.llm_model,
                stt_model=p_data.stt_model,
                stt_mode=p_data.stt_mode,
                stt_streaming_display=p_data.stt_streaming_display,
                tts_model=p_data.tts_model,
                tts_provider=p_data.tts_provider,
                greeting_message=p_data.greeting_message,
                avatar_url=p_data.avatar_url,
            )
            self.db.add(participant)
        
        await self.db.commit()
        
        return await self.get_by_id(template.id)
    
    async def update(
        self,
        template_id: UUID,
        data: TemplateUpdate,
    ) -> TemplateResponse | None:
        """Update a template.
        
        Args:
            template_id: Template UUID.
            data: Update data.
            
        Returns:
            Updated template if found, None otherwise.
        """
        query = (
            select(ConversationTemplate)
            .options(selectinload(ConversationTemplate.participants))
            .where(ConversationTemplate.id == template_id)
        )
        
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            return None
        
        # Update basic fields
        if data.name is not None:
            template.name = data.name
        if data.description is not None:
            template.description = data.description
        if data.mode is not None:
            template.mode = data.mode
        if data.system_prompt is not None:
            template.system_prompt = data.system_prompt
        if data.greeting_message is not None:
            template.greeting_message = data.greeting_message
        if data.topic is not None:
            template.topic = data.topic
        if data.difficulty is not None:
            template.difficulty = data.difficulty
        if data.estimated_minutes is not None:
            template.estimated_minutes = data.estimated_minutes
        if data.is_active is not None:
            template.is_active = data.is_active
        if data.first_speaker is not None:
            template.first_speaker = data.first_speaker
        if data.scene_context is not None:
            template.scene_context = data.scene_context
        if data.director_system_prompt is not None:
            template.director_system_prompt = data.director_system_prompt
        if data.director_llm_model is not None:
            template.director_llm_model = data.director_llm_model
        # Narrative Sync v0.2 — use model_fields_set to distinguish "not sent" from "sent as null"
        if data.pipeline_mode is not None:
            template.pipeline_mode = data.pipeline_mode
        if "evaluator_prompt" in data.model_fields_set:
            template.evaluator_prompt = data.evaluator_prompt or None
        if "planner_prompt" in data.model_fields_set:
            template.planner_prompt = data.planner_prompt or None
        if "conductor_prompt" in data.model_fields_set:
            template.conductor_prompt = data.conductor_prompt or None
        if data.evaluator_llm_model is not None:
            template.evaluator_llm_model = data.evaluator_llm_model
        if data.planner_llm_model is not None:
            template.planner_llm_model = data.planner_llm_model
        if data.conductor_llm_model is not None:
            template.conductor_llm_model = data.conductor_llm_model
        if "level_definitions" in data.model_fields_set:
            template.level_definitions = data.level_definitions
            
        # Update participants if provided
        if data.participants is not None:
            # Group existing participants by ID and Name to gracefully handle any potential duplicates
            existing_by_id = {str(p.id): p for p in template.participants}
            existing_by_name = {}
            for p in template.participants:
                if p.name not in existing_by_name:
                    existing_by_name[p.name] = []
                existing_by_name[p.name].append(p)
                
            new_participants = []
            
            for p_data in data.participants:
                p_match = None
                p_id_str = str(p_data.id) if p_data.id else None
                
                # 1. Match by explicit ID (Best case, handles renames and reorders perfectly)
                if p_id_str and p_id_str in existing_by_id:
                    p_match = existing_by_id[p_id_str]
                    # Remove from name map so it doesn't get double-matched later
                    if p_match.name in existing_by_name and p_match in existing_by_name[p_match.name]:
                        existing_by_name[p_match.name].remove(p_match)
                # 2. Match by Name (Fallback for older payloads lacking ID)
                elif p_data.name in existing_by_name and existing_by_name[p_data.name]:
                    p_match = existing_by_name[p_data.name].pop(0) # pop the first match

                if p_match:
                    # Update existing participant
                    p = p_match
                    p.participant_type = p_data.participant_type
                    p.name = p_data.name # Safely update name
                    p.persona = p_data.persona
                    p.order_index = p_data.order_index
                    
                    # Preserve voice_id if not explicitly overwritten (TemplateEditor usually sends it, but just in case)
                    if p_data.voice_id is not None:
                        p.voice_id = p_data.voice_id
                        
                    # Merge voice_settings (preserve speaking_rate from SettingsDrawer)
                    existing_vs = p.voice_settings or {}
                    incoming_vs = p_data.voice_settings.model_dump() if p_data.voice_settings else {}
                    if incoming_vs:
                        p.voice_settings = {**existing_vs, **incoming_vs}
                        
                    # Preserve advanced settings from SettingsDrawer if not explicitly provided in payload
                    p.difficulty = p_data.difficulty if p_data.difficulty is not None else p.difficulty
                    p.llm_model = p_data.llm_model if p_data.llm_model is not None else p.llm_model
                    p.stt_model = p_data.stt_model if p_data.stt_model is not None else p.stt_model
                    p.stt_mode = p_data.stt_mode if p_data.stt_mode is not None else p.stt_mode
                    p.stt_streaming_display = p_data.stt_streaming_display if p_data.stt_streaming_display is not None else p.stt_streaming_display
                    p.tts_model = p_data.tts_model if p_data.tts_model is not None else p.tts_model
                    p.tts_provider = p_data.tts_provider if p_data.tts_provider is not None else p.tts_provider
                    p.greeting_message = p_data.greeting_message if p_data.greeting_message is not None else p.greeting_message
                    p.avatar_url = p_data.avatar_url if p_data.avatar_url is not None else p.avatar_url
                    
                    new_participants.append(p)
                    # Mark as kept so we don't delete it
                    if str(p.id) in existing_by_id:
                        del existing_by_id[str(p.id)]
                else:
                    # Create new participant
                    participant = ConversationParticipant(
                        template_id=template.id,
                        participant_type=p_data.participant_type,
                        name=p_data.name,
                        persona=p_data.persona,
                        voice_id=p_data.voice_id,
                        voice_settings=p_data.voice_settings.model_dump() if p_data.voice_settings else None,
                        order_index=p_data.order_index,
                        difficulty=p_data.difficulty,
                        llm_model=p_data.llm_model,
                        stt_model=p_data.stt_model,
                        stt_mode=p_data.stt_mode,
                        stt_streaming_display=p_data.stt_streaming_display,
                        tts_model=p_data.tts_model,
                        tts_provider=p_data.tts_provider,
                        greeting_message=p_data.greeting_message,
                        avatar_url=p_data.avatar_url,
                    )
                    self.db.add(participant)
                    new_participants.append(participant)
            
            # Delete any remaining old participants that weren't matched (including duplicates)
            for p_to_delete in existing_by_id.values():
                await self.db.delete(p_to_delete)
        
        await self.db.commit()
        
        return await self.get_by_id(template_id)
    
    async def delete(self, template_id: UUID) -> bool:
        """Delete a template and its participants.
        
        Args:
            template_id: Template UUID.
            
        Returns:
            True if deleted, False if not found.
        """
        query = select(ConversationTemplate).where(
            ConversationTemplate.id == template_id
        )
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            return False
        
        await self.db.delete(template)
        await self.db.commit()
        return True
    
    async def duplicate(self, template_id: UUID, new_name: str) -> TemplateResponse | None:
        """Duplicate a template.
        
        Args:
            template_id: Template UUID to duplicate.
            new_name: Name for the new template.
            
        Returns:
            New template if original found, None otherwise.
        """
        existing = await self.get_by_id(template_id)
        if not existing:
            return None
        
        # Create new template
        create_data = TemplateCreate(
            name=new_name,
            description=existing.description,
            mode=existing.mode,
            system_prompt=existing.system_prompt,
            greeting_message=existing.greeting_message,
            topic=existing.topic,
            difficulty=existing.difficulty,
            estimated_minutes=existing.estimated_minutes,
            is_active=True,
            first_speaker=existing.first_speaker,
            scene_context=existing.scene_context,
            director_system_prompt=existing.director_system_prompt,
            director_llm_model=existing.director_llm_model,
            # v0.2 Pipeline
            pipeline_mode=getattr(existing, 'pipeline_mode', 'basic') or 'basic',
            evaluator_prompt=getattr(existing, 'evaluator_prompt', None),
            planner_prompt=getattr(existing, 'planner_prompt', None),
            conductor_prompt=getattr(existing, 'conductor_prompt', None),
            evaluator_llm_model=getattr(existing, 'evaluator_llm_model', None),
            planner_llm_model=getattr(existing, 'planner_llm_model', None),
            conductor_llm_model=getattr(existing, 'conductor_llm_model', None),
            level_definitions=getattr(existing, 'level_definitions', None),
            participants=[
                {
                    "participant_type": p.participant_type,
                    "name": p.name,
                    "persona": p.persona,
                    "voice_id": p.voice_id,
                    "voice_settings": p.voice_settings,
                    "order_index": p.order_index,
                    "greeting_message": p.greeting_message,
                    "avatar_url": p.avatar_url,
                }
                for p in existing.participants
            ],
        )
        
        return await self.create(create_data)
