"""Visual pipeline API routes."""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.api.deps import DbSession
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.visual_pipeline import (
    PipelineExecutionTraceDetail,
    PipelineExecutionTraceSummary,
    PublishRequest,
    TemplatePipelineLinkRequest,
    TemplatePipelineLinkResponse,
    TestRunRequest,
    TestRunResponse,
    ValidateRequest,
    ValidateResponse,
    VisualPipelineCreate,
    VisualPipelineListItem,
    VisualPipelineResponse,
    VisualPipelineUpdate,
    VisualPipelineVersionResponse,
)
from app.services.conversation.signaling import manager
from app.services.pipeline_runner import VisualPipelineCrudService
from app.services.pipeline_runner.dag import validate_graph

router = APIRouter(prefix="/visual-pipelines", tags=["Visual Pipelines"])


@router.get("", response_model=list[VisualPipelineListItem])
async def list_visual_pipelines(
    db: DbSession,
    status_value: str | None = Query(None, alias="status"),
) -> list[VisualPipelineListItem]:
    service = VisualPipelineCrudService(db)
    return await service.list_pipelines(status=status_value)


@router.post("", response_model=VisualPipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_visual_pipeline(
    db: DbSession,
    data: VisualPipelineCreate,
) -> VisualPipelineResponse:
    service = VisualPipelineCrudService(db)
    try:
        return await service.create_pipeline(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/execution-logs",
    response_model=PaginatedResponse[PipelineExecutionTraceSummary],
)
async def list_visual_pipeline_execution_logs(
    db: DbSession,
    session_id: UUID | None = Query(None),
    trace_id: str | None = Query(None),
    pipeline_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(30, ge=1, le=100),
) -> PaginatedResponse[PipelineExecutionTraceSummary]:
    service = VisualPipelineCrudService(db)
    items, total = await service.list_execution_traces(
        session_id=session_id,
        trace_id=trace_id,
        pipeline_id=pipeline_id,
        page=page,
        size=size,
    )
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get(
    "/execution-logs/{trace_id}",
    response_model=PipelineExecutionTraceDetail,
)
async def get_visual_pipeline_execution_trace(
    db: DbSession,
    trace_id: str,
) -> PipelineExecutionTraceDetail:
    service = VisualPipelineCrudService(db)
    return await service.get_execution_trace_detail(trace_id)


@router.get("/{pipeline_id}", response_model=VisualPipelineResponse)
async def get_visual_pipeline(db: DbSession, pipeline_id: UUID) -> VisualPipelineResponse:
    service = VisualPipelineCrudService(db)
    pipeline = await service.get_pipeline(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return pipeline


@router.put("/{pipeline_id}", response_model=VisualPipelineResponse)
async def update_visual_pipeline(
    db: DbSession,
    pipeline_id: UUID,
    data: VisualPipelineUpdate,
) -> VisualPipelineResponse:
    service = VisualPipelineCrudService(db)
    try:
        pipeline = await service.update_pipeline(pipeline_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if pipeline is None:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return pipeline


@router.delete("/{pipeline_id}", response_model=MessageResponse)
async def delete_visual_pipeline(db: DbSession, pipeline_id: UUID) -> MessageResponse:
    service = VisualPipelineCrudService(db)
    try:
        deleted = await service.delete_pipeline(pipeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="pipeline not found")
    return MessageResponse(message="비주얼 파이프라인이 삭제되었습니다.")


@router.post("/{pipeline_id}/publish", response_model=VisualPipelineVersionResponse)
async def publish_visual_pipeline(
    db: DbSession,
    pipeline_id: UUID,
    data: PublishRequest,
) -> VisualPipelineVersionResponse:
    service = VisualPipelineCrudService(db)
    try:
        return await service.publish_pipeline(pipeline_id, data.change_reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{pipeline_id}/versions", response_model=list[VisualPipelineVersionResponse])
async def list_visual_pipeline_versions(
    db: DbSession,
    pipeline_id: UUID,
) -> list[VisualPipelineVersionResponse]:
    service = VisualPipelineCrudService(db)
    return await service.list_versions(pipeline_id)


@router.get(
    "/{pipeline_id}/versions/{version}",
    response_model=VisualPipelineVersionResponse,
)
async def get_visual_pipeline_version(
    db: DbSession,
    pipeline_id: UUID,
    version: int,
) -> VisualPipelineVersionResponse:
    service = VisualPipelineCrudService(db)
    response = await service.get_version(pipeline_id, version)
    if response is None:
        raise HTTPException(status_code=404, detail="pipeline version not found")
    return response


@router.post("/{pipeline_id}/validate", response_model=ValidateResponse)
async def validate_visual_pipeline(
    db: DbSession,
    pipeline_id: UUID,
    request: ValidateRequest,
) -> ValidateResponse:
    _ = db, pipeline_id
    errors = validate_graph(request.graph_json)
    return ValidateResponse(valid=len(errors) == 0, errors=errors)


@router.post("/{pipeline_id}/duplicate", response_model=VisualPipelineResponse)
async def duplicate_visual_pipeline(
    db: DbSession,
    pipeline_id: UUID,
) -> VisualPipelineResponse:
    service = VisualPipelineCrudService(db)
    try:
        return await service.duplicate_pipeline(pipeline_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{pipeline_id}/test-run", response_model=TestRunResponse)
async def test_run_visual_pipeline(
    db: DbSession,
    pipeline_id: UUID,
    request: TestRunRequest,
) -> TestRunResponse:
    service = VisualPipelineCrudService(db)
    try:
        return await service.test_run_pipeline(pipeline_id, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/templates/{template_id}/link",
    response_model=TemplatePipelineLinkResponse,
)
async def link_template_visual_pipeline(
    db: DbSession,
    template_id: UUID,
    request: TemplatePipelineLinkRequest,
) -> TemplatePipelineLinkResponse:
    service = VisualPipelineCrudService(db)
    try:
        return await service.set_template_link(template_id, request)
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail.endswith("not found") else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.get(
    "/templates/{template_id}/link",
    response_model=TemplatePipelineLinkResponse | None,
)
async def get_template_visual_pipeline_link(
    db: DbSession,
    template_id: UUID,
) -> TemplatePipelineLinkResponse | None:
    service = VisualPipelineCrudService(db)
    return await service.get_template_link(template_id)


@router.delete("/templates/{template_id}/link", response_model=MessageResponse)
async def delete_template_visual_pipeline_link(
    db: DbSession,
    template_id: UUID,
) -> MessageResponse:
    service = VisualPipelineCrudService(db)
    deleted = await service.delete_template_link(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="template link not found")
    return MessageResponse(message="템플릿 연결이 해제되었습니다.")


@router.post(
    "/templates/{template_id}/convert-v02",
    response_model=TemplatePipelineLinkResponse,
)
async def convert_v02_template(
    db: DbSession,
    template_id: UUID,
) -> TemplatePipelineLinkResponse:
    service = VisualPipelineCrudService(db)
    try:
        return await service.convert_v02_template_to_visual(template_id)
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail.endswith("not found") else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.websocket("/monitor/{session_id}/ws")
async def visual_pipeline_monitor_ws(websocket: WebSocket, session_id: UUID) -> None:
    admin_key = f"admin:{session_id}"
    await manager.connect(admin_key, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(admin_key)
