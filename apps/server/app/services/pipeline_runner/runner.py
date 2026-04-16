"""Visual pipeline runner."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.visual_pipeline import PipelineExecutionLog
from app.services.ai_lab.model_registry import calculate_cost
from app.services.conversation.signaling import manager
from app.services.pipeline_runner.context import ExecutionLogEntry, PipelineContext
from app.services.pipeline_runner.dag import ensure_valid_graph
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.node_executors.code_executor import CodeNodeExecutor
from app.services.pipeline_runner.node_executors.delay_executor import DelayNodeExecutor
from app.services.pipeline_runner.node_executors.llm_executor import LLMNodeExecutor
from app.services.pipeline_runner.node_executors.merge_executor import MergeNodeExecutor
from app.services.pipeline_runner.node_executors.parallel_executor import ParallelNodeExecutor
from app.services.pipeline_runner.node_executors.router_executor import RouterNodeExecutor
from app.services.pipeline_runner.node_executors.ui_event_executor import UIEventNodeExecutor
from app.services.pipeline_runner.output_contract import coerce_output_contract, validate_output_contract
from app.services.pipeline_runner.variable_resolver import resolve_mapping

TERMINAL_STATUSES = {"completed", "failed", "skipped"}


@dataclass
class NodeOutcome:
    node_id: str
    status: str
    output: dict[str, Any] | None
    duration_ms: float
    activated_edge_ids: list[str]
    input_snapshot: dict[str, Any] | None
    prompt_used: str | None
    model_name: str | None
    error_message: str | None = None


class PipelineRunner:
    """Execute a visual pipeline as a DAG."""

    def __init__(
        self,
        db: AsyncSession | None,
        pipeline_graph: dict[str, Any],
        pipeline_id: UUID,
        pipeline_version: int,
        timeout_ms: int = 15000,
    ) -> None:
        self.db = db
        self.graph = pipeline_graph
        self.pipeline_id = pipeline_id
        self.pipeline_version = pipeline_version
        self.timeout_ms = timeout_ms
        self.nodes = {node["id"]: node for node in pipeline_graph.get("nodes", [])}
        self.edges = pipeline_graph.get("edges", [])
        self._build_adjacency()
        self.executors: dict[str, BaseNodeExecutor] = {
            "llm": LLMNodeExecutor(),
            "code": CodeNodeExecutor(),
            "router": RouterNodeExecutor(),
            "parallel": ParallelNodeExecutor(),
            "merge": MergeNodeExecutor(),
            "ui_event": UIEventNodeExecutor(),
            "delay": DelayNodeExecutor(),
        }

    def _build_adjacency(self) -> None:
        self.outgoing_edges: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in self.nodes}
        self.incoming_edges: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in self.nodes}
        for edge in self.edges:
            source = edge["source"]
            target = edge["target"]
            self.outgoing_edges.setdefault(source, []).append(edge)
            self.incoming_edges.setdefault(target, []).append(edge)

    def get_default_outgoing_edge_ids(self, node_id: str) -> list[str]:
        return [edge["id"] for edge in self.outgoing_edges.get(node_id, [])]

    def get_router_outgoing_edge_ids(self, node_id: str, route_id: str) -> list[str]:
        matched = [
            edge["id"]
            for edge in self.outgoing_edges.get(node_id, [])
            if edge.get("sourceHandle") == route_id
            or edge.get("label") == route_id
        ]
        if matched:
            return matched
        # Fallback: if there is only one edge, use it.
        edges = self.outgoing_edges.get(node_id, [])
        return [edges[0]["id"]] if len(edges) == 1 else []

    def collect_predecessor_outputs(
        self,
        node_id: str,
        context: PipelineContext,
    ) -> dict[str, Any]:
        outputs: dict[str, Any] = {}
        for edge in self.incoming_edges.get(node_id, []):
            source = edge["source"]
            if source in context.node_outputs:
                outputs[source] = context.node_outputs[source]
        return outputs

    async def emit_runtime_event(
        self,
        context: PipelineContext,
        event_type: str,
        payload: dict[str, Any],
        target: str = "both",
    ) -> None:
        if context.session_id is None:
            return
        message = {"type": event_type, **payload}
        session_key = str(context.session_id)
        if target in {"both", "session"}:
            await manager.send_message(session_key, message)
        if target in {"both", "admin"}:
            await manager.send_message(f"admin:{session_key}", message)

    async def execute(self, context: PipelineContext) -> dict[str, Any]:
        ensure_valid_graph(self.graph)
        start_time = time.perf_counter()
        activated_edge_ids: set[str] = set()

        start_node = self._get_node_by_type("start")
        end_node = self._get_node_by_type("end")
        context.node_outputs[start_node["id"]] = context.start_payload()
        context.node_statuses[start_node["id"]] = "completed"
        activated_edge_ids.update(self.get_default_outgoing_edge_ids(start_node["id"]))

        await self.emit_runtime_event(
            context,
            "pipeline:started",
            {
                "trace_id": context.trace_id,
                "pipeline_id": str(self.pipeline_id),
                "node_count": len(self.nodes),
            },
        )

        while True:
            ready = self._get_ready_nodes(context, activated_edge_ids)
            if ready:
                outcomes = await asyncio.gather(
                    *[self._execute_node(node_id, context) for node_id in ready],
                )
                for outcome in outcomes:
                    self._apply_outcome(context, outcome, activated_edge_ids)
                    await self._persist_log(context, outcome)
                continue

            skipped = await self._skip_unreachable_nodes(context, activated_edge_ids)
            if skipped:
                continue
            break

        total_duration_ms = round((time.perf_counter() - start_time) * 1000, 1)
        context.metadata["total_duration_ms"] = total_duration_ms
        result = self._build_final_result(context, end_node)
        await self.emit_runtime_event(
            context,
            "pipeline:completed",
            {
                "trace_id": context.trace_id,
                "duration_ms": total_duration_ms,
                "success": context.node_statuses.get(end_node["id"]) == "completed",
            },
        )
        return result

    async def _execute_node(self, node_id: str, context: PipelineContext) -> NodeOutcome:
        node = self.nodes[node_id]
        node_type = node["type"]
        node_data = node.get("data") or {}
        node_label = node_data.get("label") or node_id
        timeout_ms = int(node_data.get("timeout_ms") or self.timeout_ms)
        context.node_statuses[node_id] = "running"
        await self.emit_runtime_event(
            context,
            "pipeline:node_started",
            {
                "trace_id": context.trace_id,
                "node_id": node_id,
                "node_type": node_type,
                "node_label": node_label,
            },
        )
        started = time.perf_counter()
        try:
            if node_type == "end":
                result = await asyncio.wait_for(
                    self._execute_end_node(node_id, node_data, context),
                    timeout=timeout_ms / 1000,
                )
            else:
                executor = self.executors[node_type]
                result = await asyncio.wait_for(
                    executor.execute(node_id, node_data, context, self),
                    timeout=timeout_ms / 1000,
                )
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            return NodeOutcome(
                node_id=node_id,
                status="completed",
                output=result.output,
                duration_ms=duration_ms,
                activated_edge_ids=result.activated_edge_ids,
                input_snapshot=result.input_snapshot,
                prompt_used=result.prompt_used,
                model_name=result.model_name,
            )
        except asyncio.TimeoutError:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            return NodeOutcome(
                node_id=node_id,
                status="failed",
                output=None,
                duration_ms=duration_ms,
                activated_edge_ids=[],
                input_snapshot=None,
                prompt_used=None,
                model_name=None,
                error_message="Timeout",
            )
        except Exception as exc:  # pragma: no cover - runtime integration path
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            return NodeOutcome(
                node_id=node_id,
                status="failed",
                output=None,
                duration_ms=duration_ms,
                activated_edge_ids=[],
                input_snapshot=None,
                prompt_used=None,
                model_name=None,
                error_message=str(exc),
            )

    async def _execute_end_node(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
    ) -> NodeExecutionResult:
        output_mapping = node_data.get("output_mapping") or {}
        resolved = coerce_output_contract(resolve_mapping(output_mapping, context))
        is_valid, errors = validate_output_contract(resolved)
        if not is_valid:
            raise ValueError("; ".join(errors))
        return NodeExecutionResult(
            output=resolved,
            activated_edge_ids=[],
            input_snapshot=resolved,
        )

    def _apply_outcome(
        self,
        context: PipelineContext,
        outcome: NodeOutcome,
        activated_edge_ids: set[str],
    ) -> None:
        node = self.nodes[outcome.node_id]
        node_type = node["type"]
        node_label = (node.get("data") or {}).get("label") or outcome.node_id
        context.node_statuses[outcome.node_id] = outcome.status
        context.node_durations[outcome.node_id] = outcome.duration_ms
        if outcome.status == "completed" and outcome.output is not None:
            context.node_outputs[outcome.node_id] = outcome.output
            activated_edge_ids.update(outcome.activated_edge_ids)
        elif outcome.error_message:
            context.errors[outcome.node_id] = outcome.error_message

        log_entry = ExecutionLogEntry(
            trace_id=context.trace_id,
            node_id=outcome.node_id,
            node_type=node_type,
            node_label=node_label,
            status=outcome.status,
            input_json=outcome.input_snapshot,
            output_json=outcome.output,
            duration_ms=outcome.duration_ms,
            model_name=outcome.model_name,
            prompt_used=outcome.prompt_used,
            error_message=outcome.error_message,
        )
        context.add_log(log_entry)

        event_type = "pipeline:node_completed" if outcome.status == "completed" else "pipeline:node_failed"
        payload = {
            "trace_id": context.trace_id,
            "node_id": outcome.node_id,
            "node_type": node_type,
            "node_label": node_label,
            "duration_ms": outcome.duration_ms,
        }
        if outcome.output is not None:
            payload["output_preview"] = str(outcome.output)[:200]
        if outcome.error_message:
            payload["error"] = outcome.error_message
        asyncio.create_task(self.emit_runtime_event(context, event_type, payload))

    async def _persist_log(self, context: PipelineContext, outcome: NodeOutcome) -> None:
        if not self.db or not context.persist_logs or context.session_id is None:
            return
        node = self.nodes[outcome.node_id]
        node_label = (node.get("data") or {}).get("label") or outcome.node_id
        self.db.add(
            PipelineExecutionLog(
                trace_id=context.trace_id,
                session_id=context.session_id,
                pipeline_id=self.pipeline_id,
                pipeline_version=self.pipeline_version,
                turn_index=context.turn_index,
                node_id=outcome.node_id,
                node_type=node["type"],
                node_label=node_label,
                status=outcome.status,
                input_json=outcome.input_snapshot,
                output_json=outcome.output,
                duration_ms=outcome.duration_ms,
                model_name=outcome.model_name,
                prompt_used=outcome.prompt_used,
                error_message=outcome.error_message,
            )
        )
        await self.db.flush()

    async def _skip_unreachable_nodes(
        self,
        context: PipelineContext,
        activated_edge_ids: set[str],
    ) -> bool:
        progress = False
        for node_id, node in self.nodes.items():
            if node["type"] == "start":
                continue
            if context.node_statuses.get(node_id) in TERMINAL_STATUSES | {"running"}:
                continue
            if not self._all_predecessors_terminal(node_id, context):
                continue
            incoming = self.incoming_edges.get(node_id, [])
            if incoming and not any(edge["id"] in activated_edge_ids for edge in incoming):
                context.node_statuses[node_id] = "skipped"
                context.node_durations[node_id] = 0.0
                log_entry = ExecutionLogEntry(
                    trace_id=context.trace_id,
                    node_id=node_id,
                    node_type=node["type"],
                    node_label=(node.get("data") or {}).get("label") or node_id,
                    status="skipped",
                    error_message="inactive branch",
                )
                context.add_log(log_entry)
                await self.emit_runtime_event(
                    context,
                    "pipeline:node_skipped",
                    {
                        "trace_id": context.trace_id,
                        "node_id": node_id,
                        "reason": "inactive branch",
                    },
                )
                progress = True
        return progress

    def _get_ready_nodes(
        self,
        context: PipelineContext,
        activated_edge_ids: set[str],
    ) -> list[str]:
        ready: list[str] = []
        for node_id, node in self.nodes.items():
            if node["type"] == "start":
                continue
            if context.node_statuses.get(node_id) in TERMINAL_STATUSES | {"running"}:
                continue
            if not self._all_predecessors_terminal(node_id, context):
                continue
            incoming = self.incoming_edges.get(node_id, [])
            if incoming and any(edge["id"] in activated_edge_ids for edge in incoming):
                ready.append(node_id)
        return ready

    def _all_predecessors_terminal(self, node_id: str, context: PipelineContext) -> bool:
        return all(
            context.node_statuses.get(edge["source"]) in TERMINAL_STATUSES
            for edge in self.incoming_edges.get(node_id, [])
        )

    def _build_final_result(
        self,
        context: PipelineContext,
        end_node: dict[str, Any],
    ) -> dict[str, Any]:
        end_result = context.node_outputs.get(end_node["id"])
        if isinstance(end_result, dict):
            end_result = coerce_output_contract(end_result)
            valid, errors = validate_output_contract(end_result)
            if valid:
                total_input_tokens = 0
                total_output_tokens = 0
                estimated_cost = 0.0
                for output in context.node_outputs.values():
                    if not isinstance(output, dict):
                        continue
                    input_tokens = int(output.get("input_tokens") or 0)
                    output_tokens = int(output.get("output_tokens") or 0)
                    total_input_tokens += input_tokens
                    total_output_tokens += output_tokens
                    model_name = output.get("model")
                    if model_name:
                        estimated_cost += calculate_cost(model_name, input_tokens, output_tokens)
                context.metadata["total_input_tokens"] = total_input_tokens
                context.metadata["total_output_tokens"] = total_output_tokens
                context.metadata["estimated_cost_usd"] = round(estimated_cost, 6)
                return end_result
            context.metadata["contract_errors"] = errors
        return self._fallback_result(context)

    def _fallback_result(self, context: PipelineContext) -> dict[str, Any]:
        error_text = "; ".join(context.errors.values()) or "visual pipeline execution failed"
        context.metadata.setdefault("total_input_tokens", 0)
        context.metadata.setdefault("total_output_tokens", 0)
        context.metadata.setdefault("estimated_cost_usd", 0.0)
        return {
            "feedback_text": "지금 응답을 생성하는 중에 문제가 발생했습니다. 다시 한 번 이어서 진행해 주세요.",
            "feedback_instruction": "차분하고 짧게 안내한다.",
            "level": 1,
            "level_instruction": "Use simple English and keep the conversation moving.",
            "corrections": [],
            "better_expressions": [],
            "speaker_scripts": {},
            "user_emotion": "neutral",
            "question_progress": {},
            "energy_flow": None,
            "engine_trace": {"error": error_text, "trace_id": context.trace_id},
        }

    def _get_node_by_type(self, node_type: str) -> dict[str, Any]:
        for node in self.nodes.values():
            if node["type"] == node_type:
                return node
        raise ValueError(f"node type not found: {node_type}")
