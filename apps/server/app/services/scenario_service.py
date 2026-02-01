"""Scenario management service - Business logic."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.experiment import LearningTheme
from app.models.scenario import Scenario, ScenarioStatus, ScenarioStep
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioResponse,
    ScenarioStepCreate,
    ScenarioStepResponse,
    ScenarioUpdate,
    ScenarioWithSteps,
)


async def get_all_scenarios(
    db: AsyncSession,
    category: LearningTheme | None = None,
    status: ScenarioStatus | None = None,
) -> ScenarioListResponse:
    """Get all scenarios with filters.
    
    Args:
        db: Database session.
        category: Optional category filter.
        status: Optional status filter.
        
    Returns:
        List of scenarios.
    """
    query = select(Scenario).order_by(Scenario.order, Scenario.created_at.desc())
    
    if category:
        query = query.where(Scenario.category == category)
    if status:
        query = query.where(Scenario.status == status)
    
    result = await db.execute(query)
    scenarios = result.scalars().all()
    
    items = []
    for scenario in scenarios:
        # Get step count
        count_query = select(func.count(ScenarioStep.id)).where(
            ScenarioStep.scenario_id == scenario.id
        )
        count_result = await db.execute(count_query)
        step_count = count_result.scalar() or 0
        
        items.append(
            ScenarioResponse(
                id=scenario.id,
                title=scenario.title,
                description=scenario.description,
                category=scenario.category,
                status=scenario.status,
                level_required=scenario.level_required,
                xp_reward=scenario.xp_reward,
                order=scenario.order,
                created_by=scenario.created_by,
                created_at=scenario.created_at,
                updated_at=scenario.updated_at,
                step_count=step_count,
            )
        )
    
    return ScenarioListResponse(items=items, total=len(items))


async def get_scenario_by_id(
    db: AsyncSession,
    scenario_id: UUID,
) -> ScenarioWithSteps | None:
    """Get a scenario with all steps.
    
    Args:
        db: Database session.
        scenario_id: Scenario UUID.
        
    Returns:
        Scenario with steps if found.
    """
    query = (
        select(Scenario)
        .options(selectinload(Scenario.steps))
        .where(Scenario.id == scenario_id)
    )
    result = await db.execute(query)
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        return None
    
    steps = [
        ScenarioStepResponse(
            id=step.id,
            scenario_id=step.scenario_id,
            step_order=step.step_order,
            type=step.type,
            content=step.content,
            ai_config=step.ai_config,
            created_at=step.created_at,
        )
        for step in scenario.steps
    ]
    
    return ScenarioWithSteps(
        id=scenario.id,
        title=scenario.title,
        description=scenario.description,
        category=scenario.category,
        status=scenario.status,
        level_required=scenario.level_required,
        xp_reward=scenario.xp_reward,
        order=scenario.order,
        created_by=scenario.created_by,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
        step_count=len(steps),
        steps=steps,
    )


async def create_scenario(
    db: AsyncSession,
    create_data: ScenarioCreate,
    created_by: UUID | None = None,
) -> ScenarioWithSteps:
    """Create a new scenario with steps.
    
    Args:
        db: Database session.
        create_data: Scenario creation data.
        created_by: Creator user ID.
        
    Returns:
        Created scenario with steps.
    """
    # Create scenario
    scenario = Scenario(
        title=create_data.title,
        description=create_data.description,
        category=create_data.category,
        level_required=create_data.level_required,
        xp_reward=create_data.xp_reward,
        order=create_data.order,
        created_by=created_by,
    )
    db.add(scenario)
    await db.flush()
    
    # Create steps
    for step_data in create_data.steps:
        step = ScenarioStep(
            scenario_id=scenario.id,
            step_order=step_data.step_order,
            type=step_data.type,
            content=step_data.content,
            ai_config=step_data.ai_config,
        )
        db.add(step)
    
    await db.commit()
    return await get_scenario_by_id(db, scenario.id)


async def update_scenario(
    db: AsyncSession,
    scenario_id: UUID,
    update_data: ScenarioUpdate,
) -> Scenario | None:
    """Update a scenario.
    
    Args:
        db: Database session.
        scenario_id: Scenario UUID.
        update_data: Update payload.
        
    Returns:
        Updated scenario if found.
    """
    query = select(Scenario).where(Scenario.id == scenario_id)
    result = await db.execute(query)
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        return None
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(scenario, key, value)
    
    await db.commit()
    await db.refresh(scenario)
    return scenario


async def delete_scenario(db: AsyncSession, scenario_id: UUID) -> bool:
    """Delete a scenario and its steps.
    
    Args:
        db: Database session.
        scenario_id: Scenario UUID.
        
    Returns:
        True if deleted, False if not found.
    """
    query = select(Scenario).where(Scenario.id == scenario_id)
    result = await db.execute(query)
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        return False
    
    await db.delete(scenario)
    await db.commit()
    return True


async def add_step_to_scenario(
    db: AsyncSession,
    scenario_id: UUID,
    step_data: ScenarioStepCreate,
) -> ScenarioStepResponse | None:
    """Add a step to a scenario.
    
    Args:
        db: Database session.
        scenario_id: Scenario UUID.
        step_data: Step creation data.
        
    Returns:
        Created step if scenario exists.
    """
    # Check scenario exists
    scenario_query = select(Scenario).where(Scenario.id == scenario_id)
    scenario_result = await db.execute(scenario_query)
    scenario = scenario_result.scalar_one_or_none()
    
    if not scenario:
        return None
    
    step = ScenarioStep(
        scenario_id=scenario_id,
        step_order=step_data.step_order,
        type=step_data.type,
        content=step_data.content,
        ai_config=step_data.ai_config,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    
    return ScenarioStepResponse(
        id=step.id,
        scenario_id=step.scenario_id,
        step_order=step.step_order,
        type=step.type,
        content=step.content,
        ai_config=step.ai_config,
        created_at=step.created_at,
    )
