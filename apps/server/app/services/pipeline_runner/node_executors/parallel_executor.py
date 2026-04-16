"""Parallel node executor."""

from __future__ import annotations

from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult


class ParallelNodeExecutor(BaseNodeExecutor):
    """Fork execution into multiple outgoing branches."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        predecessors = runner.collect_predecessor_outputs(node_id, context)
        return NodeExecutionResult(
            output={
                "branches": node_data.get("branches") or [],
                "inputs": predecessors,
            },
            activated_edge_ids=runner.get_default_outgoing_edge_ids(node_id),
            input_snapshot=predecessors,
        )
