"""Code node executor."""

from __future__ import annotations

import asyncio
import datetime
import json
import math
import re
import statistics
from typing import Any

from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.variable_resolver import resolve_mapping

_ALLOWED_MODULES = {
    "math": math,
    "json": json,
    "re": re,
    "datetime": datetime,
    "statistics": statistics,
}

_ALLOWED_BUILTINS: dict[str, Any] = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "range": range,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
}


def _safe_import(name: str, *_args: Any, **_kwargs: Any) -> Any:
    if name in _ALLOWED_MODULES:
        return _ALLOWED_MODULES[name]
    raise ImportError(f"module '{name}' is not allowed in code nodes")


class CodeNodeExecutor(BaseNodeExecutor):
    """Execute a sandboxed Python snippet."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        inputs = resolve_mapping(node_data.get("input_variables") or {}, context)
        code = node_data.get("code", "")
        scope: dict[str, Any] = {
            "__builtins__": {**_ALLOWED_BUILTINS, "__import__": _safe_import},
            **_ALLOWED_MODULES,
        }
        local_scope: dict[str, Any] = {}
        exec(code, scope, local_scope)  # noqa: S102
        execute_fn = local_scope.get("execute") or scope.get("execute")
        if execute_fn is None:
            raise ValueError("code node must define execute(inputs)")

        result = execute_fn(inputs)
        if asyncio.iscoroutine(result):
            result = await result
        if not isinstance(result, dict):
            result = {"result": result}

        return NodeExecutionResult(
            output={
                **result,
                "resolved_inputs": inputs,
            },
            activated_edge_ids=runner.get_default_outgoing_edge_ids(node_id),
            input_snapshot=inputs,
        )
