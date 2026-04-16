"""Base types for pipeline node executors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.services.pipeline_runner.context import PipelineContext


@dataclass
class NodeExecutionResult:
    """Result returned by every node executor."""

    output: dict[str, Any] | None = None
    activated_edge_ids: list[str] = field(default_factory=list)
    input_snapshot: dict[str, Any] | None = None
    prompt_used: str | None = None
    model_name: str | None = None


class BaseNodeExecutor:
    """Base executor interface."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        raise NotImplementedError
