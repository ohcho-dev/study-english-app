"""Pipeline service - CRUD operations for AI Lab pipelines."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_lab_pipeline import Pipeline, PipelineAgent
from app.schemas.ai_lab import (
    AgentResponse,
    PipelineCreate,
    PipelineListItem,
    PipelineResponse,
    PipelineUpdate,
)


class PipelineService:
    """Service for managing AI Lab pipelines.
    
    Handles CRUD operations for pipelines and their agents.
    
    Args:
        db: AsyncSession for database operations.
    """
    
    def __init__(self, db: AsyncSession) -> None:
        """Initialize the pipeline service.
        
        Args:
            db: Database session.
        """
        self.db = db
    
    async def get_all(self) -> list[PipelineListItem]:
        """Get all pipelines with agent count.
        
        Returns:
            List of pipeline summaries.
        """
        query = (
            select(
                Pipeline,
                func.count(PipelineAgent.id).label("agent_count"),
            )
            .outerjoin(PipelineAgent)
            .group_by(Pipeline.id)
            .order_by(Pipeline.updated_at.desc())
        )
        
        result = await self.db.execute(query)
        rows = result.all()
        
        return [
            PipelineListItem(
                id=pipeline.id,
                name=pipeline.name,
                description=pipeline.description,
                agent_count=agent_count,
                created_at=pipeline.created_at,
                updated_at=pipeline.updated_at,
            )
            for pipeline, agent_count in rows
        ]
    
    async def get_by_id(self, pipeline_id: UUID) -> PipelineResponse | None:
        """Get a pipeline with all agents.
        
        Args:
            pipeline_id: Pipeline UUID.
            
        Returns:
            Pipeline with agents if found, None otherwise.
        """
        query = (
            select(Pipeline)
            .options(selectinload(Pipeline.agents))
            .where(Pipeline.id == pipeline_id)
        )
        
        result = await self.db.execute(query)
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            return None
        
        return PipelineResponse(
            id=pipeline.id,
            name=pipeline.name,
            description=pipeline.description,
            system_prompt=pipeline.system_prompt,
            agents=[
                AgentResponse(
                    id=agent.id,
                    role_name=agent.role_name,
                    prompt=agent.prompt,
                    order_index=agent.order_index,
                    created_at=agent.created_at,
                    updated_at=agent.updated_at,
                )
                for agent in sorted(pipeline.agents, key=lambda a: a.order_index)
            ],
            created_at=pipeline.created_at,
            updated_at=pipeline.updated_at,
        )
    
    async def create(self, data: PipelineCreate) -> PipelineResponse:
        """Create a new pipeline with agents.
        
        Args:
            data: Pipeline creation data.
            
        Returns:
            Created pipeline with agents.
        """
        # Create pipeline
        pipeline = Pipeline(
            name=data.name,
            description=data.description,
            system_prompt=data.system_prompt,
        )
        self.db.add(pipeline)
        await self.db.flush()
        
        # Create agents
        for agent_data in data.agents:
            agent = PipelineAgent(
                pipeline_id=pipeline.id,
                role_name=agent_data.role_name,
                prompt=agent_data.prompt,
                order_index=agent_data.order_index,
            )
            self.db.add(agent)
        
        await self.db.commit()
        
        # Return full pipeline
        return await self.get_by_id(pipeline.id)
    
    async def update(
        self,
        pipeline_id: UUID,
        data: PipelineUpdate,
    ) -> PipelineResponse | None:
        """Update a pipeline.
        
        Args:
            pipeline_id: Pipeline UUID.
            data: Update data.
            
        Returns:
            Updated pipeline if found, None otherwise.
        """
        query = (
            select(Pipeline)
            .options(selectinload(Pipeline.agents))
            .where(Pipeline.id == pipeline_id)
        )
        
        result = await self.db.execute(query)
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            return None
        
        # Update basic fields
        if data.name is not None:
            pipeline.name = data.name
        if data.description is not None:
            pipeline.description = data.description
        if data.system_prompt is not None:
            pipeline.system_prompt = data.system_prompt
        
        # Update agents if provided (replace all)
        if data.agents is not None:
            # Delete existing agents
            for agent in pipeline.agents:
                await self.db.delete(agent)
            
            # Create new agents
            for agent_data in data.agents:
                agent = PipelineAgent(
                    pipeline_id=pipeline.id,
                    role_name=agent_data.role_name,
                    prompt=agent_data.prompt,
                    order_index=agent_data.order_index,
                )
                self.db.add(agent)
        
        await self.db.commit()
        
        return await self.get_by_id(pipeline_id)
    
    async def delete(self, pipeline_id: UUID) -> bool:
        """Delete a pipeline and its agents.
        
        Args:
            pipeline_id: Pipeline UUID.
            
        Returns:
            True if deleted, False if not found.
        """
        query = select(Pipeline).where(Pipeline.id == pipeline_id)
        result = await self.db.execute(query)
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            return False
        
        await self.db.delete(pipeline)
        await self.db.commit()
        return True
