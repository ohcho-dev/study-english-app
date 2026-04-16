"""Delay node executor."""

from __future__ import annotations

import asyncio
from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.variable_resolver import resolve_value


class DelayNodeExecutor(BaseNodeExecutor):
    """Pause execution for a configured duration."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        resolved = resolve_value(node_data.get("delay_ms", 0), context)
        delay_ms = int(float(resolved or 0))
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000)
        return NodeExecutionResult(
            output={"delay_ms": delay_ms},
            activated_edge_ids=runner.get_default_outgoing_edge_ids(node_id),
            input_snapshot={"delay_ms": delay_ms},
        )
