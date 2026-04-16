"""LLM node executor."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.services.pipeline_runner.context import PipelineContext
from app.services.pipeline_runner.node_executors.base import BaseNodeExecutor, NodeExecutionResult
from app.services.pipeline_runner.variable_resolver import resolve_mapping, resolve_template_text


def _extract_token_usage(response: Any) -> tuple[int, int]:
    input_tokens = 0
    output_tokens = 0
    usage = getattr(response, "usage_metadata", None)
    if isinstance(usage, dict):
        input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or 0
        output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or 0
    elif usage is not None:
        input_tokens = getattr(usage, "input_tokens", 0) or getattr(usage, "prompt_tokens", 0)
        output_tokens = getattr(usage, "output_tokens", 0) or getattr(usage, "completion_tokens", 0)

    metadata = getattr(response, "response_metadata", {}) or {}
    if input_tokens == 0 and isinstance(metadata, dict):
        usage_meta = metadata.get("usage_metadata") or metadata.get("usage") or {}
        if isinstance(usage_meta, dict):
            input_tokens = (
                usage_meta.get("prompt_token_count")
                or usage_meta.get("prompt_tokens")
                or usage_meta.get("input_tokens")
                or 0
            )
            output_tokens = (
                usage_meta.get("candidates_token_count")
                or usage_meta.get("completion_tokens")
                or usage_meta.get("output_tokens")
                or 0
            )
    return int(input_tokens), int(output_tokens)


def _validate_json_output(parsed: Any, schema: dict[str, Any] | None) -> None:
    if schema is None:
        return
    if not isinstance(parsed, dict):
        raise ValueError("response_format=json requires an object response")
    required = schema.get("required") or []
    for key in required:
        if key not in parsed:
            raise ValueError(f"json response missing required key '{key}'")


class LLMNodeExecutor(BaseNodeExecutor):
    """Execute an LLM node."""

    async def execute(
        self,
        node_id: str,
        node_data: dict[str, Any],
        context: PipelineContext,
        runner: Any,
    ) -> NodeExecutionResult:
        model_name = node_data.get("model") or "gemini-2.5-flash"
        prompt = resolve_template_text(node_data.get("prompt", ""), context)
        inputs = resolve_mapping(node_data.get("input_variables") or {}, context)
        response_format = node_data.get("response_format", "text")

        if response_format == "json":
            prompt = (
                f"{prompt}\n\n"
                "Return only valid JSON. Do not wrap the JSON in markdown fences."
            )

        # thinking_budget: 0 = 비활성화, -1 = 동적, None = 모델 기본값
        # gemini-2.5-* 모델은 기본적으로 thinking이 켜져 있어 응답이 느릴 수 있음
        raw_budget = node_data.get("thinking_budget")
        thinking_budget: int | None = int(raw_budget) if raw_budget is not None else None

        model_kwargs: dict = {
            "model": model_name,
            "google_api_key": settings.GOOGLE_AI_API_KEY,
            "temperature": float(node_data.get("temperature", 0)),
            "max_output_tokens": node_data.get("max_output_tokens"),
            "convert_system_message_to_human": True,
        }
        if thinking_budget is not None:
            model_kwargs["thinking_budget"] = thinking_budget

        model = ChatGoogleGenerativeAI(**model_kwargs)
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=json.dumps(inputs, ensure_ascii=False)),
        ]

        retry_count = int(node_data.get("retry_count", 2))
        retry_delay = float(node_data.get("retry_delay_sec", 1.0))
        last_error: Exception | None = None
        response = None
        for attempt in range(retry_count + 1):
            try:
                response = await model.ainvoke(messages)
                break
            except Exception as exc:
                last_error = exc
                if attempt < retry_count:
                    await asyncio.sleep(retry_delay * (attempt + 1))
        if response is None:
            raise RuntimeError(f"LLM call failed after {retry_count + 1} attempts: {last_error}") from last_error

        text = response.content if isinstance(response.content, str) else str(response.content)
        parsed: Any = text
        if response_format == "json":
            parsed = json.loads(text)
            _validate_json_output(parsed, node_data.get("output_schema"))

        input_tokens, output_tokens = _extract_token_usage(response)
        output = {
            "result": parsed,
            "text": text,
            "resolved_inputs": inputs,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model": model_name,
        }
        return NodeExecutionResult(
            output=output,
            activated_edge_ids=runner.get_default_outgoing_edge_ids(node_id),
            input_snapshot=inputs,
            prompt_used=prompt,
            model_name=model_name,
        )
