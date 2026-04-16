"""Router node executor."""

from __future__ import annotations

import re
from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.variable_resolver import resolve_value


def _match_condition(value: Any, operator: str, expected: Any) -> bool:
    if operator == "eq":
        return value == expected
    if operator == "neq":
        return value != expected
    if operator == "gt":
        return value > expected
    if operator == "gte":
        return value >= expected
    if operator == "lt":
        return value < expected
    if operator == "lte":
        return value <= expected
    if operator == "contains":
        return str(expected) in str(value)
    if operator == "in":
        return value in expected if isinstance(expected, list) else False
    if operator == "regex":
        return re.search(str(expected), str(value)) is not None
    raise ValueError(f"unsupported router operator: {operator}")


class RouterNodeExecutor(BaseNodeExecutor):
    """Execute a conditional router node."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        value = resolve_value(node_data.get("input_variable"), context)
        selected_route = node_data.get("default_route")
        selected_label = "default"

        for route in node_data.get("routes") or []:
            condition = route.get("condition") or {}
            if _match_condition(value, condition.get("operator", "eq"), condition.get("value")):
                selected_route = route.get("id")
                selected_label = route.get("label") or selected_route
                break

        if not selected_route:
            raise ValueError("router node could not resolve a target route")

        return NodeExecutionResult(
            output={
                "value": value,
                "selected_route": selected_route,
                "selected_label": selected_label,
            },
            activated_edge_ids=runner.get_router_outgoing_edge_ids(node_id, selected_route),
            input_snapshot={"value": value},
        )
