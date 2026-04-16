"""UI event node executor."""

from __future__ import annotations

from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.variable_resolver import resolve_mapping


class UIEventNodeExecutor(BaseNodeExecutor):
    """Emit a UI event to session or admin listeners."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        payload = resolve_mapping(node_data.get("payload_template") or {}, context)
        event_type = node_data.get("event_type") or "pipeline:ui_update"
        target = node_data.get("target") or "session"
        await runner.emit_runtime_event(
            context,
            event_type,
            {
                "trace_id": context.trace_id,
                "node_id": node_id,
                "target": target,
                "payload": payload,
            },
            target=target,
        )
        return NodeExecutionResult(
            output={
                "event_type": event_type,
                "target": target,
                "payload": payload,
            },
            activated_edge_ids=runner.get_default_outgoing_edge_ids(node_id),
            input_snapshot=payload,
        )
