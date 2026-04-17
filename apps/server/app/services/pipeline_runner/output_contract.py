"""Lightweight coercion helpers for visual pipeline end-node outputs."""

from __future__ import annotations

from typing import Any


def coerce_output_contract(result: dict[str, Any]) -> dict[str, Any]:
    """Coerce a resolved end-node mapping without imposing a fixed contract."""
    if not isinstance(result, dict):
        raise ValueError("end node output must resolve to an object")
    return dict(result)


def validate_output_contract(result: dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate only the container shape for the dynamic end-node output."""
    if not isinstance(result, dict):
        return False, ["end node output must be an object"]
    return True, []
