"""Benchmark calculator for AI Lab experiments.

Calculates various performance and efficiency metrics for each experiment step.
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class StepBenchmark:
    """Benchmark metrics for a single experiment step.
    
    Attributes:
        latency_ms: Response time in milliseconds.
        tokens_per_second: Throughput - tokens processed per second.
        input_output_ratio: Output to input token ratio (efficiency).
        cost_per_1k_tokens: Cost per 1000 tokens in USD.
        output_length: Output text length in characters.
        response_density: Characters per token (quality indicator).
    """
    
    latency_ms: int
    tokens_per_second: float
    input_output_ratio: float
    cost_per_1k_tokens: float
    output_length: int
    response_density: float
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "latency_ms": self.latency_ms,
            "tokens_per_second": round(self.tokens_per_second, 2),
            "input_output_ratio": round(self.input_output_ratio, 3),
            "cost_per_1k_tokens": round(self.cost_per_1k_tokens, 6),
            "output_length": self.output_length,
            "response_density": round(self.response_density, 2),
        }


# Benchmark metric descriptions for tooltips
BENCHMARK_DESCRIPTIONS = {
    "latency_ms": "응답 시간 (ms) - 모델이 응답을 생성하는 데 걸린 시간",
    "tokens_per_second": "처리량 (tok/s) - 초당 처리한 토큰 수. 높을수록 빠름",
    "input_output_ratio": "토큰 비율 - 입력 대비 출력 토큰 비율. 높을수록 더 상세한 응답",
    "cost_per_1k_tokens": "비용/1K ($) - 1000 토큰당 예상 비용",
    "output_length": "출력 길이 - 응답 텍스트의 문자 수",
    "response_density": "응답 밀도 - 토큰당 문자 수. 높을수록 효율적인 토큰 사용",
}


def calculate_step_benchmark(
    execution_time_ms: int,
    input_tokens: int,
    output_tokens: int,
    output_text: str,
    estimated_cost: float,
) -> StepBenchmark:
    """Calculate benchmark metrics for a single step.
    
    Args:
        execution_time_ms: Execution time in milliseconds.
        input_tokens: Number of input tokens.
        output_tokens: Number of output tokens.
        output_text: The output text from the model.
        estimated_cost: Estimated cost in USD.
        
    Returns:
        StepBenchmark with calculated metrics.
    """
    total_tokens = input_tokens + output_tokens
    
    # Tokens per second (throughput)
    if execution_time_ms > 0:
        tokens_per_second = (total_tokens * 1000) / execution_time_ms
    else:
        tokens_per_second = 0.0
    
    # Input to output ratio
    if input_tokens > 0:
        input_output_ratio = output_tokens / input_tokens
    else:
        input_output_ratio = 0.0
    
    # Cost per 1K tokens
    if total_tokens > 0:
        cost_per_1k_tokens = (estimated_cost / total_tokens) * 1000
    else:
        cost_per_1k_tokens = 0.0
    
    # Output length
    output_length = len(output_text)
    
    # Response density (chars per token)
    if output_tokens > 0:
        response_density = output_length / output_tokens
    else:
        response_density = 0.0
    
    return StepBenchmark(
        latency_ms=execution_time_ms,
        tokens_per_second=tokens_per_second,
        input_output_ratio=input_output_ratio,
        cost_per_1k_tokens=cost_per_1k_tokens,
        output_length=output_length,
        response_density=response_density,
    )


def calculate_aggregate_benchmark(
    step_benchmarks: list[StepBenchmark],
) -> dict[str, Any]:
    """Calculate aggregate benchmark metrics across all steps.
    
    Args:
        step_benchmarks: List of StepBenchmark instances.
        
    Returns:
        Dictionary with aggregated metrics (avg, min, max).
    """
    if not step_benchmarks:
        return {}
    
    # Collect values for each metric
    latencies = [b.latency_ms for b in step_benchmarks]
    throughputs = [b.tokens_per_second for b in step_benchmarks]
    ratios = [b.input_output_ratio for b in step_benchmarks]
    costs = [b.cost_per_1k_tokens for b in step_benchmarks]
    
    return {
        "latency": {
            "avg": round(sum(latencies) / len(latencies), 0),
            "min": min(latencies),
            "max": max(latencies),
        },
        "throughput": {
            "avg": round(sum(throughputs) / len(throughputs), 2),
            "min": round(min(throughputs), 2),
            "max": round(max(throughputs), 2),
        },
        "token_ratio": {
            "avg": round(sum(ratios) / len(ratios), 3),
            "min": round(min(ratios), 3),
            "max": round(max(ratios), 3),
        },
        "cost_per_1k": {
            "avg": round(sum(costs) / len(costs), 6),
            "min": round(min(costs), 6),
            "max": round(max(costs), 6),
        },
    }
