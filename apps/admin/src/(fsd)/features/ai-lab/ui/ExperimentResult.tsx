'use client';

import { Clock, Coins, Cpu, MessageSquare, Volume2 } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { TooltipProvider } from '@/shared/ui/tooltip';

import type { ExperimentRunResponse } from '../model/types';

import { BenchmarkMetrics } from './BenchmarkMetrics';

interface ExperimentResultProps {
    result: ExperimentRunResponse | null;
}

/**
 * Experiment result display component
 * Shows model info for each agent and benchmark metrics
 */
export const ExperimentResult = ({ result }: ExperimentResultProps) => {
    if (!result) {
        return null;
    }

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatCost = (usd: number) => {
        return `$${usd.toFixed(6)}`;
    };

    // Get unique models used
    const uniqueModels = [...new Set(result.steps.map((s) => s.model_name))];

    return (
        <TooltipProvider>
            <Card className="max-h-[800px] overflow-y-auto">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>실험 결과</span>
                        <div className="flex items-center gap-4 text-sm font-normal text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatTime(result.execution_time_ms)}
                            </span>
                            <span className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                {result.total_input_tokens + result.total_output_tokens}{' '}
                                <span className="text-xs text-muted-foreground ml-1">
                                    (In: {result.total_input_tokens} / Out: {result.total_output_tokens})
                                </span>
                            </span>
                            <span className="flex items-center gap-1">
                                <Coins className="h-4 w-4" />
                                {formatCost(result.estimated_cost_usd)}
                            </span>
                        </div>
                    </CardTitle>

                    {/* Used Models Summary */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Cpu className="h-4 w-4" />
                            사용된 모델:
                        </span>
                        {uniqueModels.map((model) => (
                            <Badge key={model} variant="outline">
                                {model}
                            </Badge>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {result.steps.map((step, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm">
                                        Agent {step.step_index + 1}: {step.agent_role}
                                    </h4>
                                    <Badge variant="secondary" className="text-xs">
                                        {step.model_name}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-3">
                                    <span>{formatTime(step.execution_time_ms)}</span>
                                    <span>
                                        {step.input_tokens}→{step.output_tokens} tokens
                                    </span>
                                </div>
                            </div>

                            {/* Benchmark Metrics */}
                            {step.benchmark && (
                                <div className="mb-3">
                                    <BenchmarkMetrics benchmark={step.benchmark} compact />
                                </div>
                            )}

                            <div className="bg-muted/50 rounded-md p-3">
                                <pre className="text-sm whitespace-pre-wrap font-mono">{step.output}</pre>
                            </div>
                        </div>
                    ))}

                    {/* Final Result Summary */}
                    <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-2">📋 최종 결과</h4>
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                            <pre className="text-sm whitespace-pre-wrap">{result.final_result}</pre>
                        </div>
                    </div>

                    {/* Audio Player */}
                    {(result.audio_url || result.audio_base64) && (
                        <div className="border-t pt-4 mt-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                                <Volume2 className="h-4 w-4" />
                                🔊 음성 결과
                            </h4>
                            <div className="bg-muted/50 rounded-lg p-4">
                                <audio
                                    controls
                                    className="w-full"
                                    src={
                                        result.audio_url
                                            ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${result.audio_url}`
                                            : result.audio_base64
                                                ? `data:audio/wav;base64,${result.audio_base64}`
                                                : undefined
                                    }
                                >
                                    브라우저가 오디오를 지원하지 않습니다.
                                </audio>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
};
