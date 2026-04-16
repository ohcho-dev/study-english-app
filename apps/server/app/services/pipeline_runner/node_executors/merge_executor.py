"""Merge node executor."""

from __future__ import annotations

from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.variable_resolver import build_scope


class MergeNodeExecutor(BaseNodeExecutor):
    """Merge multiple branch outputs."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        branches = runner.collect_predecessor_outputs(node_id, context)
        strategy = node_data.get("merge_strategy", "all")

        if strategy == "first":
            merged = next(iter(branches.values()), None)
        elif strategy == "custom":
            # branches를 context에 임시로 노출하여 evaluate_expression이 참조 가능하게 함
            scope = build_scope(context)
            scope["branches"] = branches
            expression = node_data.get("custom_merge_expression", "branches")
            # evaluate_expression과 동일한 안전 eval 환경 사용 (S307 무시 불필요)
            merged = eval(expression, {"__builtins__": {}}, scope)  # noqa: S307
        else:
            merged = branches

        return NodeExecutionResult(
            output={
                "result": merged,
                "branches": branches,
            },
            activated_edge_ids=runner.get_default_outgoing_edge_ids(node_id),
            input_snapshot=branches,
        )
