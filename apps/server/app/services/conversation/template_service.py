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
    ) -> tuple[list[TemplateListItem], int]:
        """Get all templates with pagination.
        
        Args:
            page: Page number (1-indexed).
            size: Items per page.
            active_only: Only return active templates.
            
        Returns:
            Tuple of (template list, total count).
        """
        # Build base query
        base_query = select(ConversationTemplate)
        if active_only:
            base_query = base_query.where(ConversationTemplate.is_active.is_(True))
        
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
        
        result = await self.db.execute(query)
        rows = result.all()
        
        items = [
            TemplateListItem(
                id=template.id,
                name=template.name,
                description=template.description,
                mode=template.mode.value,
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
            mode=template.mode.value,
            system_prompt=template.system_prompt,
            greeting_message=template.greeting_message,
            topic=template.topic,
            difficulty=template.difficulty,
            estimated_minutes=template.estimated_minutes,
            is_active=template.is_active,
            participants=[
                ParticipantResponse(
                    id=p.id,
                    template_id=p.template_id,
                    participant_type=p.participant_type.value,
                    name=p.name,
                    persona=p.persona,
                    voice_id=p.voice_id,
                    voice_settings=p.voice_settings,
                    order_index=p.order_index,
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
        
        # Update participants if provided (replace all)
        if data.participants is not None:
            # Delete existing participants
            for participant in template.participants:
                await self.db.delete(participant)
            
            # Create new participants
            for p_data in data.participants:
                participant = ConversationParticipant(
                    template_id=template.id,
                    participant_type=p_data.participant_type,
                    name=p_data.name,
                    persona=p_data.persona,
                    voice_id=p_data.voice_id,
                    voice_settings=p_data.voice_settings.model_dump() if p_data.voice_settings else None,
                    order_index=p_data.order_index,
                )
                self.db.add(participant)
        
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
            participants=[
                {
                    "participant_type": p.participant_type,
                    "name": p.name,
                    "persona": p.persona,
                    "voice_id": p.voice_id,
                    "voice_settings": p.voice_settings,
                    "order_index": p.order_index,
                }
                for p in existing.participants
            ],
        )
        
        return await self.create(create_data)
