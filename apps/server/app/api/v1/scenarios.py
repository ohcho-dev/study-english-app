"""Scenarios API router - Learning content management."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession
from app.models.experiment import LearningTheme
from app.models.scenario import ScenarioStatus
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioStepCreate,
    ScenarioStepResponse,
    ScenarioUpdate,
    ScenarioWithSteps,
)
from app.services import scenario_service

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=ScenarioListResponse)
async def list_scenarios(
    db: DbSession,
    category: LearningTheme | None = None,
    status: ScenarioStatus | None = None,
) -> ScenarioListResponse:
    """Get all scenarios with optional filters.
    
    Args:
        category: Filter by learning category.
        status: Filter by status.
        
    Returns:
        List of scenarios.
    """
    return await scenario_service.get_all_scenarios(db, category, status)


@router.get("/{scenario_id}", response_model=ScenarioWithSteps)
async def get_scenario(
    scenario_id: UUID,
    db: DbSession,
) -> ScenarioWithSteps:
    """Get a scenario with all steps.
    
    Args:
        scenario_id: Scenario UUID.
        
    Returns:
        Scenario with steps.
    """
    scenario = await scenario_service.get_scenario_by_id(db, scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )
    return scenario


@router.post("", response_model=ScenarioWithSteps, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    create_data: ScenarioCreate,
    db: DbSession,
) -> ScenarioWithSteps:
    """Create a new scenario with steps.
    
    Args:
        create_data: Scenario creation data.
        
    Returns:
        Created scenario.
    """
    return await scenario_service.create_scenario(db, create_data)


@router.patch("/{scenario_id}", response_model=ScenarioWithSteps)
async def update_scenario(
    scenario_id: UUID,
    update_data: ScenarioUpdate,
    db: DbSession,
) -> ScenarioWithSteps:
    """Update a scenario.
    
    Args:
        scenario_id: Scenario UUID.
        update_data: Update data.
        
    Returns:
        Updated scenario.
    """
    scenario = await scenario_service.update_scenario(db, scenario_id, update_data)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )
    return await scenario_service.get_scenario_by_id(db, scenario_id)


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(
    scenario_id: UUID,
    db: DbSession,
) -> None:
    """Delete a scenario.
    
    Args:
        scenario_id: Scenario UUID.
    """
    deleted = await scenario_service.delete_scenario(db, scenario_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )


@router.post("/{scenario_id}/steps", response_model=ScenarioStepResponse, status_code=status.HTTP_201_CREATED)
async def add_step(
    scenario_id: UUID,
    step_data: ScenarioStepCreate,
    db: DbSession,
) -> ScenarioStepResponse:
    """Add a step to a scenario.
    
    Args:
        scenario_id: Scenario UUID.
        step_data: Step creation data.
        
    Returns:
        Created step.
    """
    step = await scenario_service.add_step_to_scenario(db, scenario_id, step_data)
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )
    return step
