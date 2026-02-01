"""Variables API router - Feature Flags management."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession
from app.models.experiment import LearningTheme
from app.schemas.experiment import (
    UserVariablesResponse,
    VariableListResponse,
    VariableResponse,
    VariableUpdate,
)
from app.services import variable_service

router = APIRouter(prefix="/variables", tags=["variables"])


@router.get("", response_model=VariableListResponse)
async def list_variables(db: DbSession) -> VariableListResponse:
    """Get all experiment variables.
    
    Returns:
        List of all variables with experiment info.
    """
    return await variable_service.get_all_variables(db)


@router.get("/theme/{theme}", response_model=VariableListResponse)
async def list_variables_by_theme(
    theme: LearningTheme,
    db: DbSession,
) -> VariableListResponse:
    """Get variables for a specific learning theme.
    
    Args:
        theme: Learning theme (listening, simulation, myturn).
        
    Returns:
        List of variables for the specified theme.
    """
    return await variable_service.get_variables_by_theme(db, theme)


@router.get("/user/{user_id}", response_model=UserVariablesResponse)
async def get_user_variables(
    user_id: UUID,
    db: DbSession,
    theme: LearningTheme | None = None,
) -> UserVariablesResponse:
    """Get variable values for a specific user (with A/B variant applied).
    
    This endpoint assigns users to cohorts if not already assigned,
    and returns the appropriate variable values based on their variant.
    
    Args:
        user_id: User UUID.
        theme: Optional learning theme filter.
        
    Returns:
        User's assigned variable values.
    """
    return await variable_service.get_user_variables(db, user_id, theme)


@router.put("/{variable_id}", response_model=VariableResponse)
async def update_variable(
    variable_id: UUID,
    update_data: VariableUpdate,
    db: DbSession,
) -> VariableResponse:
    """Update a variable's values.
    
    Args:
        variable_id: Variable UUID.
        update_data: Updated values.
        
    Returns:
        Updated variable.
        
    Raises:
        HTTPException: If variable not found.
    """
    variable = await variable_service.update_variable(db, variable_id, update_data)
    if not variable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variable not found",
        )
    
    return VariableResponse(
        id=variable.id,
        experiment_id=variable.experiment_id,
        variable_key=variable.variable_key,
        control_value=variable.control_value,
        treatment_value=variable.treatment_value,
        traffic_split=variable.traffic_split,
        created_at=variable.created_at,
        experiment_name=variable.experiment.name if variable.experiment else None,
        learning_theme=variable.experiment.learning_theme if variable.experiment else None,
    )
