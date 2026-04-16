"""Output contract helpers for visual pipelines."""

from __future__ import annotations

from typing import Any

REQUIRED_OUTPUT_FIELDS: dict[str, tuple[type, ...]] = {
    "feedback_text": (str,),
    "feedback_instruction": (str,),
    "level": (int,),
    "level_instruction": (str,),
    "corrections": (list,),
    "better_expressions": (list,),
    "speaker_scripts": (dict,),
    "user_emotion": (str,),
}

OPTIONAL_OUTPUT_FIELDS: dict[str, tuple[type, ...]] = {
    "question_progress": (dict, type(None)),
    "energy_flow": (dict, type(None)),
    "engine_trace": (dict, type(None)),
}


def coerce_output_contract(result: dict[str, Any]) -> dict[str, Any]:
    """Coerce loosely-typed fields before validation.

    LLM outputs often return numeric fields as strings (e.g. level="3").
    This function normalises them so downstream code receives the correct types.
    """
    coerced = dict(result)
    raw_level = coerced.get("level")
    if raw_level is not None and not isinstance(raw_level, bool):
        try:
            coerced["level"] = int(raw_level)
        except (ValueError, TypeError):
            pass  # leave as-is; validate_output_contract will report the error
    return coerced


def validate_output_contract(result: dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate pipeline output used by process_ai_turn."""
    errors: list[str] = []
    for field, expected_types in REQUIRED_OUTPUT_FIELDS.items():
        if field not in result:
            errors.append(f"missing required field: {field}")
            continue
        if not isinstance(result[field], expected_types):
            expected = ", ".join(t.__name__ for t in expected_types)
            errors.append(
                f"field '{field}' expected {expected}, got {type(result[field]).__name__}"
            )

    for field, expected_types in OPTIONAL_OUTPUT_FIELDS.items():
        if field in result and not isinstance(result[field], expected_types):
            expected = ", ".join(t.__name__ for t in expected_types)
            errors.append(
                f"field '{field}' expected {expected}, got {type(result[field]).__name__}"
            )

    return len(errors) == 0, errors
