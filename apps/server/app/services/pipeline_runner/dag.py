"""Graph validation utilities for visual pipelines."""

from __future__ import annotations

from collections import deque
from typing import Any

NODE_TYPES = {
    "start",
    "end",
    "llm",
    "code",
    "router",
    "parallel",
    "merge",
    "ui_event",
    "delay",
}


class GraphValidationError(ValueError):
    """Raised when a pipeline graph is invalid."""


REQUIRED_END_FIELDS = {
    "feedback_text",
    "feedback_instruction",
    "level",
    "level_instruction",
    "corrections",
    "better_expressions",
    "speaker_scripts",
    "user_emotion",
}


def validate_graph(graph: dict[str, Any]) -> list[str]:
    """Validate graph structure and return all errors."""
    errors: list[str] = []
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return ["graph_json must include nodes[] and edges[] arrays"]

    node_map: dict[str, dict[str, Any]] = {}
    for node in nodes:
        node_id = node.get("id")
        node_type = node.get("type")
        if not node_id or not isinstance(node_id, str):
            errors.append("every node requires a string id")
            continue
        if node_id in node_map:
            errors.append(f"duplicate node id: {node_id}")
            continue
        if node_type not in NODE_TYPES:
            errors.append(f"unsupported node type '{node_type}' for node '{node_id}'")
        node_map[node_id] = node

    start_nodes = [node for node in nodes if node.get("type") == "start"]
    end_nodes = [node for node in nodes if node.get("type") == "end"]
    if len(start_nodes) != 1:
        errors.append("pipeline must contain exactly one start node")
    if len(end_nodes) != 1:
        errors.append("pipeline must contain exactly one end node")

    indegree = {node_id: 0 for node_id in node_map}
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_map}
    for edge in edges:
        edge_id = edge.get("id")
        source = edge.get("source")
        target = edge.get("target")
        if not edge_id:
            errors.append("every edge requires an id")
        if source not in node_map:
            errors.append(f"edge source not found: {source}")
            continue
        if target not in node_map:
            errors.append(f"edge target not found: {target}")
            continue
        adjacency[source].append(target)
        indegree[target] += 1

    if start_nodes:
        start_id = start_nodes[0]["id"]
        if indegree.get(start_id, 0) != 0:
            errors.append("start node cannot have incoming edges")
    if end_nodes and indegree.get(end_nodes[0]["id"], 0) == 0:
        errors.append("end node must have at least one incoming edge")

    if not errors and _has_cycle(indegree.copy(), adjacency):
        errors.append("pipeline graph must be a DAG (cycle detected)")

    for node in nodes:
        node_type = node.get("type")
        node_id = node.get("id")
        data = node.get("data") or {}
        if node_type == "llm":
            if not data.get("model"):
                errors.append(f"llm node '{node_id}' requires model")
            if not data.get("prompt"):
                errors.append(f"llm node '{node_id}' requires prompt")
        elif node_type == "code":
            if not data.get("code"):
                errors.append(f"code node '{node_id}' requires code")
        elif node_type == "router":
            routes = data.get("routes") or []
            if not routes:
                errors.append(f"router node '{node_id}' requires at least one route")
            if not data.get("default_route"):
                errors.append(f"router node '{node_id}' requires default_route")
        elif node_type == "end":
            mapping = data.get("output_mapping") or {}
            missing = sorted(REQUIRED_END_FIELDS - set(mapping))
            if missing:
                errors.append(
                    f"end node '{node_id}' missing output mappings: {', '.join(missing)}"
                )

    return errors


def ensure_valid_graph(graph: dict[str, Any]) -> None:
    """Raise when graph validation fails."""
    errors = validate_graph(graph)
    if errors:
        raise GraphValidationError("; ".join(errors))


def _has_cycle(indegree: dict[str, int], adjacency: dict[str, list[str]]) -> bool:
    queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
    visited = 0
    while queue:
        node_id = queue.popleft()
        visited += 1
        for target in adjacency[node_id]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    return visited != len(indegree)
