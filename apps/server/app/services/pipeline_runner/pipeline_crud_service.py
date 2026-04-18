"""CRUD and orchestration service for visual pipelines."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import ConversationTemplate
from app.models.visual_pipeline import (
    PipelineExecutionLog,
    TemplateVisualPipelineLink,
    VisualPipeline,
    VisualPipelineVersion,
)
from app.schemas.visual_pipeline import (
    NodeExecutionLogResponse,
    PipelineExecutionTraceDetail,
    PipelineExecutionTraceSummary,
    TemplatePipelineLinkRequest,
    TemplatePipelineLinkResponse,
    TestRunBatchSummary,
    TestRunCaseResponse,
    TestRunRequest,
    TestRunResponse,
    VisualPipelineCreate,
    VisualPipelineListItem,
    VisualPipelineResponse,
    VisualPipelineUpdate,
    VisualPipelineVersionResponse,
)
from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.dag import validate_graph
from app.services.pipeline_runner.runner import PipelineRunner


class VisualPipelineCrudService:
    """Service layer for visual pipeline CRUD and execution."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_pipelines(self, status: str | None = None) -> list[VisualPipelineListItem]:
        query = select(VisualPipeline).order_by(VisualPipeline.updated_at.desc())
        if status:
            query = query.where(VisualPipeline.status == status)
        pipelines = (await self.db.execute(query)).scalars().all()
        return [self._to_list_item(pipeline) for pipeline in pipelines]

    async def get_pipeline(self, pipeline_id: UUID) -> VisualPipelineResponse | None:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            return None
        return VisualPipelineResponse.model_validate(pipeline)

    async def create_pipeline(self, data: VisualPipelineCreate) -> VisualPipelineResponse:
        errors = validate_graph(data.graph_json)
        if errors:
            raise ValueError("; ".join(errors))
        pipeline = VisualPipeline(
            name=data.name,
            description=data.description,
            graph_json=data.graph_json,
            timeout_ms=data.timeout_ms,
            status="draft",
            version=1,
        )
        self.db.add(pipeline)
        await self.db.commit()
        await self.db.refresh(pipeline)
        return VisualPipelineResponse.model_validate(pipeline)

    async def update_pipeline(
        self,
        pipeline_id: UUID,
        data: VisualPipelineUpdate,
    ) -> VisualPipelineResponse | None:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            return None
        if pipeline.status != "draft":
            raise ValueError("published pipeline cannot be updated directly. duplicate it first.")

        if data.graph_json is not None:
            errors = validate_graph(data.graph_json)
            if errors:
                raise ValueError("; ".join(errors))
            pipeline.graph_json = data.graph_json
        if data.name is not None:
            pipeline.name = data.name
        if data.description is not None:
            pipeline.description = data.description
        if data.timeout_ms is not None:
            pipeline.timeout_ms = data.timeout_ms

        await self.db.commit()
        await self.db.refresh(pipeline)
        return VisualPipelineResponse.model_validate(pipeline)

    async def delete_pipeline(self, pipeline_id: UUID) -> bool:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            return False
        link_exists = (
            await self.db.execute(
                select(TemplateVisualPipelineLink.id).where(
                    TemplateVisualPipelineLink.pipeline_id == pipeline_id
                )
            )
        ).scalar_one_or_none()
        if link_exists is not None:
            raise ValueError("linked templates exist. unlink them before deleting the pipeline.")
        await self.db.delete(pipeline)
        await self.db.commit()
        return True

    async def publish_pipeline(
        self,
        pipeline_id: UUID,
        change_reason: str | None = None,
    ) -> VisualPipelineVersionResponse:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            raise ValueError("pipeline not found")
        errors = validate_graph(pipeline.graph_json)
        if errors:
            raise ValueError("; ".join(errors))

        existing_snapshot = (
            await self.db.execute(
                select(VisualPipelineVersion).where(
                    VisualPipelineVersion.pipeline_id == pipeline_id,
                    VisualPipelineVersion.version == pipeline.version,
                )
            )
        ).scalar_one_or_none()
        if existing_snapshot is None:
            snapshot = VisualPipelineVersion(
                pipeline_id=pipeline.id,
                version=pipeline.version,
                graph_json=pipeline.graph_json,
                change_reason=change_reason,
                timeout_ms=pipeline.timeout_ms,
            )
            self.db.add(snapshot)
        else:
            snapshot = existing_snapshot
            snapshot.graph_json = pipeline.graph_json
            snapshot.change_reason = change_reason
            snapshot.timeout_ms = pipeline.timeout_ms
        pipeline.status = "published"
        await self.db.commit()
        await self.db.refresh(snapshot)
        return VisualPipelineVersionResponse.model_validate(snapshot)

    async def list_versions(self, pipeline_id: UUID) -> list[VisualPipelineVersionResponse]:
        versions = (
            await self.db.execute(
                select(VisualPipelineVersion)
                .where(VisualPipelineVersion.pipeline_id == pipeline_id)
                .order_by(VisualPipelineVersion.version.desc())
            )
        ).scalars().all()
        return [VisualPipelineVersionResponse.model_validate(version) for version in versions]

    async def get_version(
        self,
        pipeline_id: UUID,
        version: int,
    ) -> VisualPipelineVersionResponse | None:
        snapshot = (
            await self.db.execute(
                select(VisualPipelineVersion).where(
                    VisualPipelineVersion.pipeline_id == pipeline_id,
                    VisualPipelineVersion.version == version,
                )
            )
        ).scalar_one_or_none()
        if snapshot is not None:
            return VisualPipelineVersionResponse.model_validate(snapshot)

        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline and pipeline.version == version:
            return VisualPipelineVersionResponse(
                id=pipeline.id,
                pipeline_id=pipeline.id,
                version=pipeline.version,
                graph_json=pipeline.graph_json,
                change_reason=None,
                timeout_ms=pipeline.timeout_ms,
                created_at=pipeline.updated_at,
            )
        return None

    async def duplicate_pipeline(self, pipeline_id: UUID) -> VisualPipelineResponse:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            raise ValueError("pipeline not found")
        duplicate = VisualPipeline(
            name=f"{pipeline.name} 복사본",
            description=pipeline.description,
            graph_json=pipeline.graph_json,
            timeout_ms=pipeline.timeout_ms,
            version=1,
            status="draft",
        )
        self.db.add(duplicate)
        await self.db.commit()
        await self.db.refresh(duplicate)
        return VisualPipelineResponse.model_validate(duplicate)

    async def test_run_pipeline(self, pipeline_id: UUID, request: TestRunRequest) -> TestRunResponse:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            raise ValueError("pipeline not found")
        batch_inputs = self._expand_batch_test_inputs(request.input_json)
        if batch_inputs is not None:
            batch_results: list[TestRunCaseResponse] = []
            total_duration_ms = 0.0
            total_input_tokens = 0
            total_output_tokens = 0
            estimated_cost_usd = 0.0

            for item in batch_inputs:
                case = await self._execute_test_case(pipeline, request, item)
                batch_results.append(case)
                total_duration_ms += case.total_duration_ms
                total_input_tokens += case.total_input_tokens
                total_output_tokens += case.total_output_tokens
                estimated_cost_usd += case.estimated_cost_usd

            return TestRunResponse(
                total_duration_ms=total_duration_ms,
                total_input_tokens=total_input_tokens,
                total_output_tokens=total_output_tokens,
                estimated_cost_usd=estimated_cost_usd,
                batch_results=batch_results,
                batch_summary=TestRunBatchSummary(
                    item_count=len(batch_results),
                    total_duration_ms=total_duration_ms,
                    total_input_tokens=total_input_tokens,
                    total_output_tokens=total_output_tokens,
                    estimated_cost_usd=estimated_cost_usd,
                ),
            )

        single_input = self._expand_single_test_input(request.input_json)
        case = await self._execute_test_case(pipeline, request, single_input)
        return TestRunResponse(
            trace_id=case.trace_id,
            result=case.result,
            node_logs=case.node_logs,
            total_duration_ms=case.total_duration_ms,
            total_input_tokens=case.total_input_tokens,
            total_output_tokens=case.total_output_tokens,
            estimated_cost_usd=case.estimated_cost_usd,
        )

    async def _execute_test_case(
        self,
        pipeline: VisualPipeline,
        request: TestRunRequest,
        input_json: dict[str, Any] | None,
    ) -> TestRunCaseResponse:
        context = self._build_test_context(request, input_json)
        runner = PipelineRunner(
            db=None,
            pipeline_graph=pipeline.graph_json,
            pipeline_id=pipeline.id,
            pipeline_version=pipeline.version,
            timeout_ms=pipeline.timeout_ms,
        )
        result = await runner.execute(context)
        return TestRunCaseResponse(
            trace_id=context.trace_id,
            input_json=input_json,
            result=result,
            node_logs=[NodeExecutionLogResponse(**log.to_dict()) for log in context.logs],
            total_duration_ms=float(context.metadata.get("total_duration_ms") or 0),
            total_input_tokens=int(context.metadata.get("total_input_tokens") or 0),
            total_output_tokens=int(context.metadata.get("total_output_tokens") or 0),
            estimated_cost_usd=float(context.metadata.get("estimated_cost_usd") or 0),
        )

    def _build_test_context(
        self,
        request: TestRunRequest,
        input_json: dict[str, Any] | None,
    ) -> PipelineContext:
        session_context = request.session_context or {}
        session_id_value = session_context.get("session_id")
        session_id = UUID(session_id_value) if session_id_value else None
        response_delay_sec = session_context.get("response_delay_sec")
        if response_delay_sec is None:
            response_delay_sec = self._derive_response_delay(input_json)

        return PipelineContext(
            trace_id=str(uuid4()),
            session_id=session_id,
            turn_index=int(session_context.get("turn_index") or 0),
            transcript=self._derive_test_transcript(request.transcript, input_json),
            history=str(session_context.get("history") or ""),
            topic=session_context.get("topic"),
            scene_context=session_context.get("scene_context"),
            participants=list(session_context.get("participants") or []),
            variant=dict(session_context.get("variant") or {}),
            measured_wpm=session_context.get("measured_wpm"),
            response_delay_sec=response_delay_sec,
            input_json=input_json,
            persist_logs=False,
        )

    def _expand_batch_test_inputs(
        self,
        input_json: dict[str, Any] | list[dict[str, Any]] | None,
    ) -> list[dict[str, Any]] | None:
        if input_json is None:
            return None
        if isinstance(input_json, list):
            if not all(isinstance(item, dict) for item in input_json):
                raise ValueError("input_json 배열에는 객체만 넣을 수 있습니다.")
            return [dict(item) for item in input_json]
        if not isinstance(input_json, dict):
            raise ValueError("input_json은 객체 또는 객체 배열이어야 합니다.")

        items = input_json.get("items")
        if isinstance(items, list):
            dataset_meta = {key: value for key, value in input_json.items() if key != "items"}
            expanded: list[dict[str, Any]] = []
            for item in items:
                if not isinstance(item, dict):
                    raise ValueError("items 배열에는 객체만 넣을 수 있습니다.")
                expanded.append(self._expand_dataset_item(dataset_meta, item))
            return expanded
        return None

    def _expand_single_test_input(
        self,
        input_json: dict[str, Any] | list[dict[str, Any]] | None,
    ) -> dict[str, Any] | None:
        if input_json is None:
            return None
        if isinstance(input_json, list):
            raise ValueError("단건 실행에는 JSON 객체를 사용하세요.")
        if not isinstance(input_json, dict):
            raise ValueError("input_json은 객체 또는 객체 배열이어야 합니다.")
        items = input_json.get("items")
        if isinstance(items, list):
            raise ValueError("items 배열은 배치 실행에서만 사용할 수 있습니다.")
        return dict(input_json)

    def _expand_dataset_item(
        self,
        dataset_meta: dict[str, Any],
        item: dict[str, Any],
    ) -> dict[str, Any]:
        merged = {**dataset_meta, **item}
        user_input = item.get("user_input")
        if isinstance(user_input, dict):
            for key in ("user_utterance_text", "first_response_delay_sec", "asked_for_repeat"):
                if key not in merged and key in user_input:
                    merged[key] = user_input.get(key)

        expected_labels = item.get("expected_labels")
        if isinstance(expected_labels, dict):
            if "expected_failure_pattern" not in merged:
                merged["expected_failure_pattern"] = expected_labels.get("failure_pattern")
            if "expected_module" not in merged:
                merged["expected_module"] = expected_labels.get("module")
            if "expected_response_change" not in merged:
                merged["expected_response_change"] = expected_labels.get("response_change")
        return merged

    def _derive_test_transcript(
        self,
        transcript: str | None,
        input_json: dict[str, Any] | None,
    ) -> str:
        if isinstance(transcript, str) and transcript.strip():
            return transcript.strip()
        if not isinstance(input_json, dict):
            return ""

        user_input = input_json.get("user_input")
        if isinstance(user_input, dict):
            user_utterance_text = user_input.get("user_utterance_text")
            if isinstance(user_utterance_text, str):
                return user_utterance_text

        user_utterance_text = input_json.get("user_utterance_text")
        if isinstance(user_utterance_text, str):
            return user_utterance_text
        return ""

    def _derive_response_delay(self, input_json: dict[str, Any] | None) -> float | None:
        if not isinstance(input_json, dict):
            return None

        value = input_json.get("first_response_delay_sec")
        if isinstance(value, int | float):
            return float(value)

        user_input = input_json.get("user_input")
        if isinstance(user_input, dict):
            nested_value = user_input.get("first_response_delay_sec")
            if isinstance(nested_value, int | float):
                return float(nested_value)
        return None

    async def get_pipeline_for_execution(
        self,
        pipeline_id: UUID,
        pipeline_version: int | None = None,
    ) -> tuple[UUID, int, dict, int]:
        pipeline = await self._get_pipeline_orm(pipeline_id)
        if pipeline is None:
            raise ValueError("pipeline not found")
        if pipeline_version is None or pipeline.version == pipeline_version:
            return pipeline.id, pipeline.version, pipeline.graph_json, pipeline.timeout_ms

        snapshot = (
            await self.db.execute(
                select(VisualPipelineVersion).where(
                    VisualPipelineVersion.pipeline_id == pipeline_id,
                    VisualPipelineVersion.version == pipeline_version,
                )
            )
        ).scalar_one_or_none()
        if snapshot is None:
            raise ValueError("pipeline version not found")
        return pipeline.id, snapshot.version, snapshot.graph_json, snapshot.timeout_ms

    async def list_execution_traces(
        self,
        session_id: UUID | None = None,
        trace_id: str | None = None,
        pipeline_id: UUID | None = None,
        page: int = 1,
        size: int = 30,
    ) -> tuple[list[PipelineExecutionTraceSummary], int]:
        filters = []
        if session_id is not None:
            filters.append(PipelineExecutionLog.session_id == session_id)
        if trace_id is not None:
            filters.append(PipelineExecutionLog.trace_id == trace_id)
        if pipeline_id is not None:
            filters.append(PipelineExecutionLog.pipeline_id == pipeline_id)

        grouped = (
            select(
                PipelineExecutionLog.trace_id,
                PipelineExecutionLog.session_id,
                PipelineExecutionLog.pipeline_id,
                PipelineExecutionLog.pipeline_version,
                PipelineExecutionLog.turn_index,
                func.count(PipelineExecutionLog.id).label("node_count"),
                func.sum(
                    case((PipelineExecutionLog.status == "failed", 1), else_=0)
                ).label("failure_count"),
                func.min(PipelineExecutionLog.created_at).label("created_at"),
            )
            .group_by(
                PipelineExecutionLog.trace_id,
                PipelineExecutionLog.session_id,
                PipelineExecutionLog.pipeline_id,
                PipelineExecutionLog.pipeline_version,
                PipelineExecutionLog.turn_index,
            )
            .order_by(func.min(PipelineExecutionLog.created_at).desc())
        )
        if filters:
            grouped = grouped.where(*filters)

        total = len((await self.db.execute(grouped)).all())
        paged = grouped.offset((page - 1) * size).limit(size)
        rows = (await self.db.execute(paged)).all()
        items = [
            PipelineExecutionTraceSummary(
                trace_id=row.trace_id,
                session_id=row.session_id,
                pipeline_id=row.pipeline_id,
                pipeline_version=row.pipeline_version,
                turn_index=row.turn_index,
                node_count=int(row.node_count or 0),
                failure_count=int(row.failure_count or 0),
                created_at=row.created_at,
            )
            for row in rows
        ]
        return items, total

    async def get_execution_trace_detail(self, trace_id: str) -> PipelineExecutionTraceDetail:
        logs = (
            await self.db.execute(
                select(PipelineExecutionLog)
                .where(PipelineExecutionLog.trace_id == trace_id)
                .order_by(PipelineExecutionLog.created_at.asc())
            )
        ).scalars().all()
        return PipelineExecutionTraceDetail(
            trace_id=trace_id,
            logs=[
                NodeExecutionLogResponse(
                    trace_id=log.trace_id,
                    node_id=log.node_id,
                    node_type=log.node_type,
                    node_label=log.node_label,
                    status=log.status,
                    input_json=log.input_json,
                    output_json=log.output_json,
                    duration_ms=log.duration_ms,
                    model_name=log.model_name,
                    prompt_used=log.prompt_used,
                    error_message=log.error_message,
                    created_at=log.created_at,
                )
                for log in logs
            ],
        )

    async def set_template_link(
        self,
        template_id: UUID,
        data: TemplatePipelineLinkRequest,
    ) -> TemplatePipelineLinkResponse:
        template = (
            await self.db.execute(
                select(ConversationTemplate).where(ConversationTemplate.id == template_id)
            )
        ).scalar_one_or_none()
        if template is None:
            raise ValueError("template not found")

        pipeline = await self._get_pipeline_orm(data.pipeline_id)
        if pipeline is None:
            raise ValueError("pipeline not found")
        if data.pipeline_version is not None:
            version_exists = await self.get_version(data.pipeline_id, data.pipeline_version)
            if version_exists is None:
                raise ValueError("pipeline version not found")

        link = (
            await self.db.execute(
                select(TemplateVisualPipelineLink).where(
                    TemplateVisualPipelineLink.template_id == template_id
                )
            )
        ).scalar_one_or_none()
        if link is None:
            link = TemplateVisualPipelineLink(
                template_id=template_id,
                pipeline_id=data.pipeline_id,
                pipeline_version=data.pipeline_version,
                overrides=data.overrides,
            )
            self.db.add(link)
        else:
            link.pipeline_id = data.pipeline_id
            link.pipeline_version = data.pipeline_version
            link.overrides = data.overrides

        template.pipeline_mode = "visual"
        await self.db.commit()
        await self.db.refresh(link)
        return self._to_template_link_response(link, pipeline)

    async def get_template_link(self, template_id: UUID) -> TemplatePipelineLinkResponse | None:
        row = (
            await self.db.execute(
                select(TemplateVisualPipelineLink, VisualPipeline)
                .join(VisualPipeline, VisualPipeline.id == TemplateVisualPipelineLink.pipeline_id)
                .where(TemplateVisualPipelineLink.template_id == template_id)
            )
        ).one_or_none()
        if row is None:
            return None
        link, pipeline = row
        return self._to_template_link_response(link, pipeline)

    async def delete_template_link(self, template_id: UUID) -> bool:
        link = (
            await self.db.execute(
                select(TemplateVisualPipelineLink).where(
                    TemplateVisualPipelineLink.template_id == template_id
                )
            )
        ).scalar_one_or_none()
        if link is None:
            return False

        template = (
            await self.db.execute(
                select(ConversationTemplate).where(ConversationTemplate.id == template_id)
            )
        ).scalar_one_or_none()
        if template is not None and template.pipeline_mode == "visual":
            template.pipeline_mode = "basic"

        await self.db.delete(link)
        await self.db.commit()
        return True

    async def get_link_for_template(self, template_id: UUID) -> TemplateVisualPipelineLink | None:
        return (
            await self.db.execute(
                select(TemplateVisualPipelineLink).where(
                    TemplateVisualPipelineLink.template_id == template_id
                )
            )
        ).scalar_one_or_none()

    async def convert_v02_template_to_visual(self, template_id: UUID) -> TemplatePipelineLinkResponse:
        template = (
            await self.db.execute(
                select(ConversationTemplate).where(ConversationTemplate.id == template_id)
            )
        ).scalar_one_or_none()
        if template is None:
            raise ValueError("template not found")

        graph = {
            "nodes": [
                {
                    "id": "start_1",
                    "type": "start",
                    "position": {"x": 80, "y": 200},
                    "data": {"label": "사용자 입력"},
                },
                {
                    "id": "evaluator_1",
                    "type": "llm",
                    "position": {"x": 320, "y": 200},
                    "data": {
                        "label": "평가기",
                        "model": template.evaluator_llm_model or "gemini-2.0-flash",
                        "prompt": template.evaluator_prompt
                        or "사용자 발화를 평가하고 JSON으로 정리한다.",
                        "temperature": 0,
                        "retry_count": 2,
                        "timeout_ms": 10000,
                        "response_format": "json",
                        "input_variables": {
                            "transcript": "{{start.transcript}}",
                            "history": "{{start.history}}",
                            "topic": "{{start.topic}}",
                            "scene_context": "{{start.scene_context}}",
                            "measured_wpm": "{{start.measured_wpm}}",
                            "response_delay_sec": "{{start.response_delay_sec}}",
                        },
                    },
                },
                {
                    "id": "planner_1",
                    "type": "llm",
                    "position": {"x": 580, "y": 200},
                    "data": {
                        "label": "플래너",
                        "model": template.planner_llm_model or "gemini-2.0-flash",
                        "prompt": template.planner_prompt
                        or "평가 결과를 바탕으로 다음 대화 전략을 JSON으로 설계한다.",
                        "temperature": 0,
                        "retry_count": 2,
                        "timeout_ms": 10000,
                        "response_format": "json",
                        "input_variables": {
                            "evaluation": "{{evaluator_1.result}}",
                            "participants": "{{start.participants}}",
                            "history": "{{start.history}}",
                        },
                    },
                },
                {
                    "id": "conductor_1",
                    "type": "llm",
                    "position": {"x": 860, "y": 200},
                    "data": {
                        "label": "컨덕터",
                        "model": template.conductor_llm_model or "gemini-2.0-flash",
                        "prompt": template.conductor_prompt
                        or "플랜 결과를 기반으로 최종 응답 구성요소를 JSON으로 생성한다.",
                        "temperature": 0,
                        "retry_count": 2,
                        "timeout_ms": 10000,
                        "response_format": "json",
                        "input_variables": {
                            "plan": "{{planner_1.result}}",
                            "transcript": "{{start.transcript}}",
                            "history": "{{start.history}}",
                            "participants": "{{start.participants}}",
                        },
                    },
                },
                {
                    "id": "end_1",
                    "type": "end",
                    "position": {"x": 1140, "y": 200},
                    "data": {
                        "label": "파이프라인 출력",
                        "output_mapping": {
                            "evaluation": "{{evaluator_1.result}}",
                            "plan": "{{planner_1.result}}",
                            "response": "{{conductor_1.result}}",
                        },
                        "runtime_bindings": {},
                    },
                },
            ],
            "edges": [
                {"id": "edge_start_eval", "source": "start_1", "target": "evaluator_1"},
                {"id": "edge_eval_plan", "source": "evaluator_1", "target": "planner_1"},
                {"id": "edge_plan_cond", "source": "planner_1", "target": "conductor_1"},
                {"id": "edge_cond_end", "source": "conductor_1", "target": "end_1"},
            ],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }
        pipeline = VisualPipeline(
            name=f"{template.name} 비주얼 파이프라인",
            description=f"{template.name} 템플릿에서 자동 변환된 v0.2 파이프라인",
            graph_json=graph,
            timeout_ms=15000,
            version=1,
            status="draft",
        )
        self.db.add(pipeline)
        await self.db.flush()
        await self.publish_pipeline(pipeline.id, "v0.2 템플릿 자동 변환")
        return await self.set_template_link(
            template.id,
            TemplatePipelineLinkRequest(pipeline_id=pipeline.id),
        )

    async def _get_pipeline_orm(self, pipeline_id: UUID) -> VisualPipeline | None:
        return (
            await self.db.execute(select(VisualPipeline).where(VisualPipeline.id == pipeline_id))
        ).scalar_one_or_none()

    def _to_list_item(self, pipeline: VisualPipeline) -> VisualPipelineListItem:
        graph = pipeline.graph_json or {}
        return VisualPipelineListItem(
            id=pipeline.id,
            name=pipeline.name,
            description=pipeline.description,
            version=pipeline.version,
            status=pipeline.status,
            node_count=len(graph.get("nodes") or []),
            edge_count=len(graph.get("edges") or []),
            created_at=pipeline.created_at,
            updated_at=pipeline.updated_at,
        )

    def _to_template_link_response(
        self,
        link: TemplateVisualPipelineLink,
        pipeline: VisualPipeline,
    ) -> TemplatePipelineLinkResponse:
        return TemplatePipelineLinkResponse(
            id=link.id,
            template_id=link.template_id,
            pipeline_id=link.pipeline_id,
            pipeline_version=link.pipeline_version,
            pipeline_name=pipeline.name,
            pipeline_status=pipeline.status,
            created_at=link.created_at,
            updated_at=link.updated_at,
        )
