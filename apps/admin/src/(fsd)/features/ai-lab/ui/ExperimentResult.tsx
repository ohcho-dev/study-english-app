'use client';

import { Clock, Coins, MessageSquare, Volume2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

import type { ExperimentRunResponse } from '../model/types';

interface ExperimentResultProps {
    result: ExperimentRunResponse | null;
}

/**
 * Experiment result display component
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

    return (
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
            </CardHeader>
            <CardContent className="space-y-4">
                {result.steps.map((step, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">
                                Agent {step.step_index + 1}: {step.agent_role}
                            </h4>
                            <div className="text-xs text-muted-foreground flex items-center gap-3">
                                <span>{formatTime(step.execution_time_ms)}</span>
                                <span>
                                    {step.input_tokens}→{step.output_tokens} tokens
                                </span>
                            </div>
                        </div>
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
    );
};
