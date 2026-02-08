'use client';

/**
 * BenchmarkMetrics component - Displays benchmark metrics for an experiment step
 */

import { HelpCircle } from 'lucide-react';

import { StepBenchmark } from '../model/types';

import { Badge } from '@/shared/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/shared/ui/tooltip';

interface BenchmarkMetricsProps {
    benchmark: StepBenchmark;
    compact?: boolean;
}

// Benchmark metric descriptions for tooltips
const BENCHMARK_DESCRIPTIONS: Record<keyof StepBenchmark, string> = {
    latency_ms: '응답 시간 (ms) - 모델이 응답을 생성하는 데 걸린 시간',
    tokens_per_second: '처리량 (tok/s) - 초당 처리한 토큰 수. 높을수록 빠름',
    input_output_ratio: '토큰 비율 - 입력 대비 출력 토큰 비율. 높을수록 더 상세한 응답',
    cost_per_1k_tokens: '비용/1K ($) - 1000 토큰당 예상 비용',
    output_length: '출력 길이 - 응답 텍스트의 문자 수',
    response_density: '응답 밀도 - 토큰당 문자 수. 높을수록 효율적인 토큰 사용',
};

// Metric display labels
const BENCHMARK_LABELS: Record<keyof StepBenchmark, string> = {
    latency_ms: 'Latency',
    tokens_per_second: 'Throughput',
    input_output_ratio: 'Token Ratio',
    cost_per_1k_tokens: 'Cost/1K',
    output_length: 'Output Length',
    response_density: 'Density',
};

// Format metric values for display
const formatMetricValue = (key: keyof StepBenchmark, value: number): string => {
    switch (key) {
        case 'latency_ms':
            return `${value.toLocaleString()}ms`;
        case 'tokens_per_second':
            return `${value.toFixed(1)} tok/s`;
        case 'input_output_ratio':
            return `×${value.toFixed(2)}`;
        case 'cost_per_1k_tokens':
            return `$${value.toFixed(4)}`;
        case 'output_length':
            return `${value.toLocaleString()} chars`;
        case 'response_density':
            return `${value.toFixed(1)} c/tok`;
        default:
            return String(value);
    }
};

export const BenchmarkMetrics = ({ benchmark, compact = false }: BenchmarkMetricsProps) => {
    const metrics: (keyof StepBenchmark)[] = compact
        ? ['latency_ms', 'tokens_per_second', 'cost_per_1k_tokens']
        : ['latency_ms', 'tokens_per_second', 'input_output_ratio', 'cost_per_1k_tokens', 'output_length', 'response_density'];

    return (
        <div className={`flex flex-wrap gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            {metrics.map((key) => (
                <Tooltip key={key}>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="secondary"
                            className="cursor-help gap-1 font-normal"
                        >
                            <span className="text-muted-foreground">
                                {BENCHMARK_LABELS[key]}:
                            </span>
                            <span className="font-medium">
                                {formatMetricValue(key, benchmark[key])}
                            </span>
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="max-w-xs">{BENCHMARK_DESCRIPTIONS[key]}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
};
