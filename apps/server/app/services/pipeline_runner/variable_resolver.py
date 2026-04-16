"""Variable and expression resolver for visual pipelines."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import mean, median
from typing import Any

from app.services.pipeline_runner.context import PipelineContext

EXPRESSION_PATTERN = re.compile(r"\{\{\s*(.+?)\s*\}\}")


class AttrDict(dict[str, Any]):
    """Dictionary wrapper with attribute access for expressions."""

    def __getattr__(self, item: str) -> Any:
        try:
            return self[item]
        except KeyError as exc:  # pragma: no cover - defensive
            raise AttributeError(item) from exc

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value


@dataclass
class ExpressionResult:
    value: Any
    is_template: bool


def _wrap(value: Any) -> Any:
    if isinstance(value, dict):
        return AttrDict({key: _wrap(inner) for key, inner in value.items()})
    if isinstance(value, list):
        return [_wrap(item) for item in value]
    return value


def build_scope(context: PipelineContext) -> dict[str, Any]:
    """Build a safe expression scope from runtime context."""
    scope: dict[str, Any] = {
        "start": _wrap(context.start_payload()),
        "len": len,
        "min": min,
        "max": max,
        "sum": sum,
        "round": round,
        "sorted": sorted,
        "any": any,
        "all": all,
        "mean": mean,
        "median": median,
        "datetime": datetime,
        "timedelta": timedelta,
        "json": json,
        "node": lambda node_id: _wrap(context.node_outputs.get(node_id, {})),
    }
    for node_id, output in context.node_outputs.items():
        if node_id.isidentifier():
            scope[node_id] = _wrap(output)
    return scope


def evaluate_expression(expression: str, context: PipelineContext) -> Any:
    """Evaluate a single safe expression against pipeline context."""
    scope = build_scope(context)
    return eval(expression, {"__builtins__": {}}, scope)  # noqa: S307


def resolve_value(value: Any, context: PipelineContext) -> Any:
    """Resolve a template or expression preserving raw types when possible."""
    if isinstance(value, dict):
        return {key: resolve_value(inner, context) for key, inner in value.items()}
    if isinstance(value, list):
        return [resolve_value(item, context) for item in value]
    if not isinstance(value, str):
        return value

    matches = list(EXPRESSION_PATTERN.finditer(value))
    if not matches:
        return value

    stripped = value.strip()
    if len(matches) == 1 and matches[0].span() == (0, len(stripped)):
        expression = matches[0].group(1)
        return evaluate_expression(expression, context)

    def replacer(match: re.Match[str]) -> str:
        resolved = evaluate_expression(match.group(1), context)
        if resolved is None:
            return ""
        if isinstance(resolved, dict | list):
            return json.dumps(resolved, ensure_ascii=False)
        return str(resolved)

    return EXPRESSION_PATTERN.sub(replacer, value)


def resolve_mapping(mapping: dict[str, Any], context: PipelineContext) -> dict[str, Any]:
    """Resolve every value inside a mapping."""
    return {key: resolve_value(value, context) for key, value in mapping.items()}


def resolve_template_text(template: str, context: PipelineContext) -> str:
    """Resolve a template and coerce the result to text."""
    resolved = resolve_value(template, context)
    if resolved is None:
        return ""
    if isinstance(resolved, str):
        return resolved
    if isinstance(resolved, dict | list):
        return json.dumps(resolved, ensure_ascii=False)
    return str(resolved)
