'use client';

import { Clock, Coins, Cpu, MessageSquare, Volume2 } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/dialog';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { resolveMediaUrl } from '@/shared/lib/api';

import type { ExperimentLogDetail } from '../model/types';

import { BenchmarkMetrics } from './BenchmarkMetrics';

interface LogDetailModalProps {
    log: ExperimentLogDetail | null;
    open: boolean;
    onClose: () => void;
}

/**
 * Log detail modal component
 */
export const LogDetailModal = ({ log, open, onClose }: LogDetailModalProps) => {
    if (!log) return null;

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatCost = (usd: number) => {
        return `$${usd.toFixed(6)}`;
    };

    return (
        <TooltipProvider>
            <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between pr-8">
                            <span>실험 로그 상세</span>
                            <div className="flex items-center gap-4 text-sm font-normal text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatTime(log.execution_time_ms)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare className="h-4 w-4" />
                                    {log.total_input_tokens + log.total_output_tokens}{' '}
                                    <span className="text-xs text-muted-foreground ml-1">
                                        (In: {log.total_input_tokens} / Out: {log.total_output_tokens})
                                    </span>
                                </span>
                                <span className="flex items-center gap-1">
                                    <Coins className="h-4 w-4" />
                                    {formatCost(log.estimated_cost_usd)}
                                </span>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        {/* Meta Info */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                            <div>
                                <span className="text-muted-foreground">파이프라인:</span>{' '}
                                <span className="font-medium">{log.pipeline_name || '-'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">기본 모델:</span>{' '}
                                <span className="font-medium">{log.model_name}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">전달 방식:</span>{' '}
                                <span className="font-medium">
                                    {log.data_transfer_mode === 'C' ? 'C (원본 입력만)' : log.data_transfer_mode}
                                </span>
                            </div>
                        </div>

                        {/* Used Models Summary */}
                        {log.used_models && log.used_models.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/30 rounded-lg">
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Cpu className="h-4 w-4" />
                                    사용된 모델:
                                </span>
                                {log.used_models.map((model) => (
                                    <Badge key={model} variant="outline">
                                        {model}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* User Input */}
                        <div>
                            <h4 className="font-medium mb-2">📝 사용자 입력</h4>
                            <div className="bg-muted/50 rounded-lg p-3">
                                <pre className="text-sm whitespace-pre-wrap">{log.user_input}</pre>
                            </div>
                            {log.attached_files && log.attached_files.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {log.attached_files.map((file, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 bg-muted rounded text-xs"
                                        >
                                            📎 {file.name} ({file.type})
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Steps */}
                        <div>
                            <h4 className="font-medium mb-2">🤖 에이전트 단계별 결과</h4>
                            <div className="space-y-3">
                                {log.steps.map((step) => (
                                    <div key={step.id} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <h5 className="font-medium text-sm">
                                                    Step {step.step_index + 1}: {step.agent_role}
                                                </h5>
                                                {step.model_name && step.agent_role !== 'TTS Generator' && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {step.model_name}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-3">
                                                <span>{formatTime(step.execution_time_ms)}</span>
                                                <span>
                                                    {step.input_tokens}→{step.output_tokens} tokens
                                                </span>
                                            </div>
                                        </div>

                                        {/* Benchmark Metrics */}
                                        {step.benchmark && step.agent_role !== 'TTS Generator' && (
                                            <div className="mb-3">
                                                <BenchmarkMetrics benchmark={step.benchmark} compact />
                                            </div>
                                        )}

                                        {/* Agent Prompt */}
                                        <details className="mb-2">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                                프롬프트 보기
                                            </summary>
                                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                                <pre className="whitespace-pre-wrap">{step.agent_prompt}</pre>
                                            </div>
                                        </details>

                                        {/* Input */}
                                        <details className="mb-2">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                                입력 데이터 보기
                                            </summary>
                                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                                <pre className="whitespace-pre-wrap">{step.input_data}</pre>
                                            </div>
                                        </details>

                                        {/* Output */}
                                        <div className="bg-muted/50 rounded-md p-3">
                                            <pre className="text-sm whitespace-pre-wrap font-mono">
                                                {step.output_data}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Final Result */}
                        <div>
                            <h4 className="font-medium mb-2">📋 최종 결과</h4>
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                <pre className="text-sm whitespace-pre-wrap">{log.final_result}</pre>
                            </div>
                        </div>

                        {/* Audio Player */}
                        {(log.audio_url || log.audio_base64) && (() => {
                            // Find TTS step info
                            const ttsStep = log.steps.find(s => s.agent_role === "TTS Generator");
                            let ttsCost: string | null = null;
                            let ttsModel: string | null = null;

                            if (ttsStep && ttsStep.output_data) {
                                // Extract cost from output_data usually formatted as "... Cost: $0.000123"
                                const costMatch = ttsStep.output_data.match(/Cost: \$([0-9.]+)/);
                                if (costMatch) {
                                    ttsCost = `$${costMatch[1]}`;
                                }
                                ttsModel = ttsStep.model_name || null;
                            }

                            return (
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2 justify-between">
                                        <span className="flex items-center gap-2">
                                            <Volume2 className="h-4 w-4" />
                                            🔊 음성 결과
                                        </span>
                                        {(ttsModel || ttsCost) && (
                                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                                                {ttsModel && ttsCost
                                                    ? `${ttsModel} | ${ttsCost}`
                                                    : ttsModel || ttsCost
                                                }
                                            </span>
                                        )}
                                    </h4>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <audio
                                            controls
                                            className="w-full"
                                            src={
                                                log.audio_url
                                                    ? resolveMediaUrl(log.audio_url)
                                                    : log.audio_base64
                                                        ? `data:audio/wav;base64,${log.audio_base64}`
                                                        : undefined
                                            }
                                        >
                                            브라우저가 오디오를 지원하지 않습니다.
                                        </audio>

                                        {/* Debug info in case of playback failure */}
                                        <details className="mt-2">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                                오디오 경로 정보 (디버깅)
                                            </summary>
                                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs break-all text-muted-foreground">
                                                URL: {log.audio_url || "N/A"}<br />
                                                Length: {log.audio_base64 ? `${log.audio_base64.length} chars (Base64)` : "0"}
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
};
