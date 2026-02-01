"""Variable management service - Business logic."""

import random
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.experiment import (
    CohortVariant,
    Experiment,
    ExperimentStatus,
    ExperimentVariable,
    LearningTheme,
    UserCohort,
)
from app.schemas.experiment import (
    UserVariablesResponse,
    UserVariableValue,
    VariableListResponse,
    VariableResponse,
    VariableUpdate,
)


async def get_all_variables(db: AsyncSession) -> VariableListResponse:
    """Get all experiment variables.
    
    Args:
        db: Database session.
        
    Returns:
        List of all variables with experiment info.
    """
    query = (
        select(ExperimentVariable)
        .options(selectinload(ExperimentVariable.experiment))
        .order_by(ExperimentVariable.created_at.desc())
    )
    result = await db.execute(query)
    variables = result.scalars().all()
    
    items = [
        VariableResponse(
            id=var.id,
            experiment_id=var.experiment_id,
            variable_key=var.variable_key,
            control_value=var.control_value,
            treatment_value=var.treatment_value,
            traffic_split=var.traffic_split,
            created_at=var.created_at,
            experiment_name=var.experiment.name if var.experiment else None,
            learning_theme=var.experiment.learning_theme if var.experiment else None,
        )
        for var in variables
    ]
    
    return VariableListResponse(items=items, total=len(items))


async def get_variables_by_theme(
    db: AsyncSession,
    theme: LearningTheme,
) -> VariableListResponse:
    """Get variables filtered by learning theme.
    
    Args:
        db: Database session.
        theme: Learning theme to filter by.
        
    Returns:
        List of variables for the specified theme.
    """
    query = (
        select(ExperimentVariable)
        .join(Experiment)
        .options(selectinload(ExperimentVariable.experiment))
        .where(
            (Experiment.learning_theme == theme) | (Experiment.learning_theme == LearningTheme.ALL)
        )
        .where(Experiment.status == ExperimentStatus.RUNNING)
        .order_by(ExperimentVariable.created_at.desc())
    )
    result = await db.execute(query)
    variables = result.scalars().all()
    
    items = [
        VariableResponse(
            id=var.id,
            experiment_id=var.experiment_id,
            variable_key=var.variable_key,
            control_value=var.control_value,
            treatment_value=var.treatment_value,
            traffic_split=var.traffic_split,
            created_at=var.created_at,
            experiment_name=var.experiment.name if var.experiment else None,
            learning_theme=var.experiment.learning_theme if var.experiment else None,
        )
        for var in variables
    ]
    
    return VariableListResponse(items=items, total=len(items))


async def get_variable_by_id(
    db: AsyncSession,
    variable_id: UUID,
) -> ExperimentVariable | None:
    """Get a variable by ID.
    
    Args:
        db: Database session.
        variable_id: Variable UUID.
        
    Returns:
        Variable if found, None otherwise.
    """
    query = (
        select(ExperimentVariable)
        .options(selectinload(ExperimentVariable.experiment))
        .where(ExperimentVariable.id == variable_id)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def update_variable(
    db: AsyncSession,
    variable_id: UUID,
    update_data: VariableUpdate,
) -> ExperimentVariable | None:
    """Update a variable.
    
    Args:
        db: Database session.
        variable_id: Variable UUID.
        update_data: Update payload.
        
    Returns:
        Updated variable if found, None otherwise.
    """
    variable = await get_variable_by_id(db, variable_id)
    if not variable:
        return None
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(variable, key, value)
    
    await db.commit()
    await db.refresh(variable)
    return variable


async def get_user_variables(
    db: AsyncSession,
    user_id: UUID,
    theme: LearningTheme | None = None,
) -> UserVariablesResponse:
    """Get variable values for a specific user (with A/B variant applied).
    
    Args:
        db: Database session.
        user_id: User UUID.
        theme: Optional learning theme filter.
        
    Returns:
        User's assigned variable values based on their cohort.
    """
    # Get running experiments
    exp_query = select(Experiment).where(Experiment.status == ExperimentStatus.RUNNING)
    if theme:
        exp_query = exp_query.where(
            (Experiment.learning_theme == theme) | (Experiment.learning_theme == LearningTheme.ALL)
        )
    
    result = await db.execute(exp_query)
    experiments = result.scalars().all()
    
    variables: list[UserVariableValue] = []
    
    for exp in experiments:
        # Get user's cohort assignment
        cohort_query = select(UserCohort).where(
            UserCohort.user_id == user_id,
            UserCohort.experiment_id == exp.id,
        )
        cohort_result = await db.execute(cohort_query)
        cohort = cohort_result.scalar_one_or_none()
        
        # Get variables for this experiment
        var_query = select(ExperimentVariable).where(
            ExperimentVariable.experiment_id == exp.id
        )
        var_result = await db.execute(var_query)
        exp_variables = var_result.scalars().all()
        
        for var in exp_variables:
            # Determine variant (use existing or assign new)
            if cohort:
                variant = cohort.variant
            else:
                # Assign new cohort based on traffic split
                variant = (
                    CohortVariant.TREATMENT
                    if random.random() < var.traffic_split
                    else CohortVariant.CONTROL
                )
                # Save cohort assignment
                new_cohort = UserCohort(
                    user_id=user_id,
                    experiment_id=exp.id,
                    variant=variant,
                )
                db.add(new_cohort)
                await db.commit()
            
            # Get value based on variant
            value = (
                var.treatment_value
                if variant == CohortVariant.TREATMENT
                else var.control_value
            )
            
            variables.append(
                UserVariableValue(
                    key=var.variable_key,
                    value=value,
                    variant=variant,
                )
            )
    
    return UserVariablesResponse(user_id=user_id, variables=variables)
