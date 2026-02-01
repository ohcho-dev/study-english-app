"""Experiment and variable schemas - Pydantic."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.experiment import CohortVariant, ExperimentStatus, LearningTheme


# -------------------
# Variable Schemas
# -------------------


class VariableBase(BaseModel):
    """Base variable schema."""
    
    variable_key: str = Field(..., description="변수 키 (예: sim_feedback_timing)")
    control_value: Any = Field(..., description="Control 그룹 값")
    treatment_value: Any = Field(..., description="Treatment 그룹 값")
    traffic_split: float = Field(default=0.5, ge=0, le=1, description="트래픽 분배율")


class VariableCreate(VariableBase):
    """Variable creation schema."""
    
    experiment_id: UUID


class VariableUpdate(BaseModel):
    """Variable update schema."""
    
    control_value: Any | None = None
    treatment_value: Any | None = None
    traffic_split: float | None = Field(default=None, ge=0, le=1)


class VariableResponse(VariableBase):
    """Variable response schema."""
    
    id: UUID
    experiment_id: UUID
    created_at: datetime
    
    # Experiment info
    experiment_name: str | None = None
    learning_theme: LearningTheme | None = None
    
    class Config:
        from_attributes = True


class VariableListResponse(BaseModel):
    """Variable list response schema."""
    
    items: list[VariableResponse]
    total: int


# -------------------
# User Variable Schemas (for A/B testing)
# -------------------


class UserVariableValue(BaseModel):
    """Single variable value for a user."""
    
    key: str
    value: Any
    variant: CohortVariant


class UserVariablesResponse(BaseModel):
    """User's assigned variable values."""
    
    user_id: UUID
    variables: list[UserVariableValue]


# -------------------
# Experiment Schemas
# -------------------


class ExperimentBase(BaseModel):
    """Base experiment schema."""
    
    name: str = Field(..., max_length=200)
    hypothesis: str | None = None
    learning_theme: LearningTheme
    target_sample_size: int | None = None


class ExperimentCreate(ExperimentBase):
    """Experiment creation schema."""
    
    pass


class ExperimentUpdate(BaseModel):
    """Experiment update schema."""
    
    name: str | None = None
    hypothesis: str | None = None
    status: ExperimentStatus | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class ExperimentResponse(ExperimentBase):
    """Experiment response schema."""
    
    id: UUID
    status: ExperimentStatus
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExperimentWithVariables(ExperimentResponse):
    """Experiment with variables response."""
    
    variables: list[VariableResponse] = []
