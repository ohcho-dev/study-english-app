"""AI Lab API router - Pipeline management and experiment execution."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import DbSession
from app.schemas.ai_lab import (
    ExperimentLogDetail,
    ExperimentLogSummary,
    ExperimentRunRequest,
    ExperimentRunResponse,
    ModelInfo,
    PipelineCreate,
    PipelineListItem,
    PipelineResponse,
    PipelineUpdate,
    UploadResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.ai_lab.experiment_service import ExperimentService
from app.services.ai_lab.model_registry import get_available_models
from app.services.ai_lab.pipeline_service import PipelineService


router = APIRouter(prefix="/ai-lab", tags=["AI Lab"])


# ============================================================================
# Pipeline CRUD
# ============================================================================


@router.get(
    "/pipelines",
    response_model=list[PipelineListItem],
    summary="Get all pipelines",
)
async def get_pipelines(db: DbSession) -> list[PipelineListItem]:
    """Get all pipelines with agent count.
    
    Returns:
        List of pipeline summaries.
    """
    service = PipelineService(db)
    return await service.get_all()


@router.post(
    "/pipelines",
    response_model=PipelineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new pipeline",
)
async def create_pipeline(
    db: DbSession,
    data: PipelineCreate,
) -> PipelineResponse:
    """Create a new pipeline with agents.
    
    Args:
        data: Pipeline creation data.
        
    Returns:
        Created pipeline with agents.
    """
    service = PipelineService(db)
    return await service.create(data)


@router.get(
    "/pipelines/{pipeline_id}",
    response_model=PipelineResponse,
    summary="Get pipeline detail",
)
async def get_pipeline(
    db: DbSession,
    pipeline_id: UUID,
) -> PipelineResponse:
    """Get a pipeline with all agents.
    
    Args:
        pipeline_id: Pipeline UUID.
        
    Returns:
        Pipeline with agents.
        
    Raises:
        HTTPException: If pipeline not found.
    """
    service = PipelineService(db)
    pipeline = await service.get_by_id(pipeline_id)
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline not found: {pipeline_id}",
        )
    
    return pipeline


@router.put(
    "/pipelines/{pipeline_id}",
    response_model=PipelineResponse,
    summary="Update a pipeline",
)
async def update_pipeline(
    db: DbSession,
    pipeline_id: UUID,
    data: PipelineUpdate,
) -> PipelineResponse:
    """Update a pipeline.
    
    Args:
        pipeline_id: Pipeline UUID.
        data: Update data.
        
    Returns:
        Updated pipeline.
        
    Raises:
        HTTPException: If pipeline not found.
    """
    service = PipelineService(db)
    pipeline = await service.update(pipeline_id, data)
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline not found: {pipeline_id}",
        )
    
    return pipeline


@router.delete(
    "/pipelines/{pipeline_id}",
    response_model=MessageResponse,
    summary="Delete a pipeline",
)
async def delete_pipeline(
    db: DbSession,
    pipeline_id: UUID,
) -> MessageResponse:
    """Delete a pipeline and its agents.
    
    Args:
        pipeline_id: Pipeline UUID.
        
    Returns:
        Success message.
        
    Raises:
        HTTPException: If pipeline not found.
    """
    service = PipelineService(db)
    deleted = await service.delete(pipeline_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline not found: {pipeline_id}",
        )
    
    return MessageResponse(message="Pipeline deleted successfully")


# ============================================================================
# Experiment Execution
# ============================================================================


@router.post(
    "/experiments/run",
    response_model=ExperimentRunResponse,
    summary="Run an experiment",
)
async def run_experiment(
    db: DbSession,
    request: ExperimentRunRequest,
) -> ExperimentRunResponse:
    """Run an experiment with the specified pipeline and configuration.
    
    Args:
        request: Experiment run request.
        
    Returns:
        Experiment run response with results.
        
    Raises:
        HTTPException: If pipeline not found or execution fails.
    """
    service = ExperimentService(db)
    
    try:
        return await service.run_experiment(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Experiment execution failed: {str(e)}",
        )


# ============================================================================
# Experiment Logs
# ============================================================================


@router.get(
    "/experiments/logs",
    response_model=PaginatedResponse[ExperimentLogSummary],
    summary="Get experiment logs",
)
async def get_experiment_logs(
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    pipeline_id: UUID | None = Query(None, description="Filter by pipeline"),
) -> PaginatedResponse[ExperimentLogSummary]:
    """Get experiment logs with pagination.
    
    Args:
        page: Page number (1-indexed).
        size: Items per page.
        pipeline_id: Optional filter by pipeline.
        
    Returns:
        Paginated list of experiment logs.
    """
    service = ExperimentService(db)
    logs, total = await service.get_logs(page, size, pipeline_id)
    
    pages = (total + size - 1) // size if total > 0 else 1
    
    return PaginatedResponse(
        items=logs,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/experiments/logs/{log_id}",
    response_model=ExperimentLogDetail,
    summary="Get experiment log detail",
)
async def get_experiment_log_detail(
    db: DbSession,
    log_id: UUID,
) -> ExperimentLogDetail:
    """Get detailed experiment log.
    
    Args:
        log_id: Log UUID.
        
    Returns:
        Detailed experiment log.
        
    Raises:
        HTTPException: If log not found.
    """
    service = ExperimentService(db)
    log = await service.get_log_detail(log_id)
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment log not found: {log_id}",
        )
    
    return log


# ============================================================================
# Model Info
# ============================================================================


@router.get(
    "/models",
    response_model=list[ModelInfo],
    summary="Get available AI models",
)
async def get_models() -> list[ModelInfo]:
    """Get list of available AI models with pricing info.
    
    Returns:
        List of available models.
    """
    return get_available_models()


# ============================================================================
# File Upload
# ============================================================================


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Upload a file",
)
async def upload_file(
    file: UploadFile,
) -> UploadResponse:
    """Upload a multimedia file for experiment input.
    
    Args:
        file: File to upload.
        
    Returns:
        Upload response with file URL.
        
    Raises:
        HTTPException: If file type is not supported.
    """
    from pathlib import Path
    import uuid
    
    # Determine file type from content type
    content_type = file.content_type or ""
    
    if content_type.startswith("image/"):
        file_type = "image"
    elif content_type.startswith("video/"):
        file_type = "video"
    elif content_type.startswith("audio/"):
        file_type = "audio"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}",
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Create uploads directory if it doesn't exist
    uploads_dir = Path(__file__).parent.parent.parent.parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    
    # Generate unique filename to avoid collisions
    original_filename = file.filename or "unknown"
    file_ext = Path(original_filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    
    # Save file to disk
    file_path = uploads_dir / unique_filename
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return URL pointing to the saved file
    file_url = f"/uploads/{unique_filename}"
    
    return UploadResponse(
        url=file_url,
        type=file_type,
        name=original_filename,
        size_bytes=file_size,
    )
