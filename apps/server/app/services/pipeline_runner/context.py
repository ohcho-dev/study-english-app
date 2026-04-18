"""Runtime context for visual pipeline execution."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID


@dataclass
class ExecutionLogEntry:
    """In-memory node execution log entry."""

    trace_id: str
    node_id: str
    node_type: str
    node_label: str | None
    status: str
    input_json: dict[str, Any] | None = None
    output_json: dict[str, Any] | None = None
    duration_ms: float | None = None
    model_name: str | None = None
    prompt_used: str | None = None
    error_message: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PipelineContext:
    """Runtime context passed through the pipeline."""

    trace_id: str
    session_id: UUID | None
    turn_index: int
    transcript: str
    history: str
    topic: str | None
    scene_context: str | None
    participants: list[dict[str, Any]]
    variant: dict[str, Any]
    measured_wpm: float | None
    response_delay_sec: float | None
    input_json: dict[str, Any] | None = None
    persist_logs: bool = False

    node_outputs: dict[str, Any] = field(default_factory=dict)
    node_statuses: dict[str, str] = field(default_factory=dict)
    node_durations: dict[str, float] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    logs: list[ExecutionLogEntry] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def get_node_output(self, node_id: str, field_path: str = "") -> Any:
        """Resolve a node output by node id and dot path."""
        output = self.node_outputs.get(node_id)
        if output is None:
            return None
        if not field_path:
            return output

        current: Any = output
        for key in field_path.split("."):
            if isinstance(current, dict):
                current = current.get(key)
            elif isinstance(current, list) and key.isdigit():
                index = int(key)
                if 0 <= index < len(current):
                    current = current[index]
                else:
                    return None
            else:
                return None
        return current

    def add_log(self, entry: ExecutionLogEntry) -> None:
        self.logs.append(entry)

    def start_payload(self) -> dict[str, Any]:
        """Return the payload exposed by the start node."""
        return {
            "transcript": self.transcript,
            "history": self.history,
            "topic": self.topic,
            "scene_context": self.scene_context,
            "participants": self.participants,
            "variant": self.variant,
            "measured_wpm": self.measured_wpm,
            "response_delay_sec": self.response_delay_sec,
            "input_json": self.input_json,
            "session_id": str(self.session_id) if self.session_id else None,
            "turn_index": self.turn_index,
        }
