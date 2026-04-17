"""Project visual pipeline end outputs into the session runtime payload."""

from __future__ import annotations

from typing import Any


def _get_end_node_data(graph_json: dict[str, Any]) -> dict[str, Any]:
    for node in graph_json.get("nodes", []):
        if node.get("type") == "end":
            data = node.get("data")
            return data if isinstance(data, dict) else {}
    return {}


def _get_path_value(payload: dict[str, Any], path: str) -> Any:
    current: Any = payload
    for segment in path.split("."):
        if isinstance(current, dict):
            current = current.get(segment)
            continue
        if isinstance(current, list) and segment.isdigit():
            index = int(segment)
            if 0 <= index < len(current):
                current = current[index]
                continue
        return None
    return current


def _normalize_speaker_scripts(raw: Any) -> dict[str, dict[str, str]]:
    if not isinstance(raw, dict):
        return {}

    normalized: dict[str, dict[str, str]] = {}
    for speaker_name, script_value in raw.items():
        if isinstance(script_value, str):
            text = script_value.strip()
            if text:
                normalized[str(speaker_name)] = {"text": text, "instruction": ""}
            continue

        if not isinstance(script_value, dict):
            continue

        text = script_value.get("text")
        if not isinstance(text, str) or not text.strip():
            continue

        instruction = script_value.get("instruction")
        normalized[str(speaker_name)] = {
            "text": text.strip(),
            "instruction": instruction.strip() if isinstance(instruction, str) else "",
        }
    return normalized


def build_session_runtime_payload(
    graph_json: dict[str, Any],
    end_result: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build the session-facing payload using admin-defined runtime bindings."""
    if not isinstance(end_result, dict):
        return {}

    end_node_data = _get_end_node_data(graph_json)
    runtime_bindings = end_node_data.get("runtime_bindings")
    if not isinstance(runtime_bindings, dict):
        return {}

    runtime_payload: dict[str, Any] = {}
    for slot_name, output_path in runtime_bindings.items():
        if not isinstance(slot_name, str) or not slot_name.strip():
            continue
        if not isinstance(output_path, str) or not output_path.strip():
            continue

        value = _get_path_value(end_result, output_path.strip())
        slot_name = slot_name.strip()

        if slot_name == "speaker_scripts":
            runtime_payload[slot_name] = _normalize_speaker_scripts(value)
            continue

        if slot_name in {"intervention_emitted", "feedback_instruction", "level_instruction", "user_emotion"}:
            runtime_payload[slot_name] = value.strip() if isinstance(value, str) else ("" if value is None else str(value))
            continue

        if slot_name == "level":
            try:
                runtime_payload[slot_name] = int(value)
            except (TypeError, ValueError):
                runtime_payload[slot_name] = value
            continue

        if slot_name in {"corrections", "better_expressions"}:
            runtime_payload[slot_name] = value if isinstance(value, list) else []
            continue

        if slot_name in {"question_progress", "energy_flow", "engine_trace"}:
            runtime_payload[slot_name] = value if isinstance(value, dict) else {}
            continue

        runtime_payload[slot_name] = value

    return runtime_payload
