'use client';

/**
 * MetricsDashboard Component - Real-time latency metrics visualization
 * 
 * Displays experiment results with visual feedback on latency performance.
 */

import { Clock, Zap, Volume2, MessageSquare, TrendingUp, TrendingDown, Target, AlertCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';

import type { TestResult } from '../model/useRun0';

interface MetricsDashboardProps {
    results: TestResult[];
    targetLatencyMs: number;
    maxLatencyMs: number;
    isRunning: boolean;
    currentIteration: number;
    totalIterations: number;
}

// Calculate statistics
const calculateStats = (values: number[]) => {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return { avg, p50, p95, min, max };
};

// Format milliseconds
const formatMs = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined) return '-';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

// Get latency color class
const getLatencyColor = (
    ms: number,
    targetMs: number,
    maxMs: number
): string => {
    if (ms <= targetMs) return 'text-green-600 dark:text-green-400';
    if (ms <= maxMs) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
};

// Get latency background class
const getLatencyBg = (
    ms: number,
    targetMs: number,
    maxMs: number
): string => {
    if (ms <= targetMs) return 'bg-green-500';
    if (ms <= maxMs) return 'bg-yellow-500';
    return 'bg-red-500';
};

export const MetricsDashboard = ({
    results,
    targetLatencyMs,
    maxLatencyMs,
    isRunning,
    currentIteration,
    totalIterations,
}: MetricsDashboardProps) => {
    // Filter out warmup results
    const testResults = results.filter((r) => !r.isWarmup);
    const warmupResults = results.filter((r) => r.isWarmup);

    // Extract metrics
    const e2eLatencies = testResults
        .map((r) => r.metrics.e2eMs)
        .filter((v): v is number => v !== null);
    const asrLatencies = testResults.map((r) => r.metrics.asrMs);
    const llmLatencies = testResults.map((r) => r.metrics.llmMs);
    const ttsLatencies = testResults.map((r) => r.metrics.ttsMs);
    const clientLoadLatencies = testResults
        .map((r) => r.metrics.clientLoadMs)
        .filter((v): v is number => v !== null);
    const sttConfidences = testResults
        .map((r) => r.metrics.sttConfidence)
        .filter((v): v is number => v !== undefined && v !== null);
    const latestApiVersion = testResults.length > 0
        ? testResults[testResults.length - 1]?.metrics.recognitionApi
        : undefined;

    // WER/CER accuracy
    const werValues = testResults
        .map((r) => r.metrics.wer)
        .filter((v): v is number => v !== undefined && v !== null);
    const cerValues = testResults
        .map((r) => r.metrics.cer)
        .filter((v): v is number => v !== undefined && v !== null);
    const avgWer = werValues.length > 0
        ? werValues.reduce((a, b) => a + b, 0) / werValues.length
        : null;
    const avgCer = cerValues.length > 0
        ? cerValues.reduce((a, b) => a + b, 0) / cerValues.length
        : null;
    const hasAccuracyData = werValues.length > 0;

    // Calculate stats
    const e2eStats = calculateStats(e2eLatencies);
    const asrStats = calculateStats(asrLatencies);
    const llmStats = calculateStats(llmLatencies);
    const ttsStats = calculateStats(ttsLatencies);
    const clientLoadStats = calculateStats(clientLoadLatencies);
    const avgConfidence = sttConfidences.length > 0
        ? sttConfidences.reduce((a, b) => a + b, 0) / sttConfidences.length
        : null;

    // Check if target is met
    const isTargetMet = e2eStats && e2eStats.avg <= targetLatencyMs;

    // Progress percentage
    const progressPercent = (currentIteration / totalIterations) * 100;

    return (
        <div className="space-y-6">
            {/* Progress Bar */}
            {isRunning && (
                <Card>
                    <CardContent className="py-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">진행률</span>
                                <span className="font-medium">
                                    {currentIteration} / {totalIterations}
                                    {warmupResults.length > 0 &&
                                        currentIteration <= warmupResults.length && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                (Warmup)
                                            </span>
                                        )}
                                </span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            {testResults.length > 0 && (
                <div className='grid gap-4'>
                    <div className={`grid grid-cols-2 ${hasAccuracyData ? 'md:grid-cols-4' : 'md:grid-cols-4'} gap-4`}>
                        {/* E2E Average */}
                        <Card className={isTargetMet ? 'border-green-500' : 'border-yellow-500'}>
                            <CardContent className="py-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Clock className="h-4 w-4" />
                                    E2E 평균
                                </div>
                                <div
                                    className={`text-2xl font-bold ${e2eStats
                                        ? getLatencyColor(e2eStats.avg, targetLatencyMs, maxLatencyMs)
                                        : ''
                                        }`}
                                >
                                    {formatMs(e2eStats?.avg)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    목표: {formatMs(targetLatencyMs)}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ASR Latency */}
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <MessageSquare className="h-4 w-4" />
                                    STT 평균
                                    {latestApiVersion && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${latestApiVersion === 'v2' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                                            {latestApiVersion.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="text-2xl font-bold">
                                    {formatMs(asrStats?.avg)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    P95: {formatMs(asrStats?.p95)}
                                    {avgConfidence !== null && (
                                        <span className="ml-2">
                                            신뢰도: {(avgConfidence * 100).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* LLM Latency */}
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Zap className="h-4 w-4" />
                                    LLM 평균
                                </div>
                                <div className="text-2xl font-bold">
                                    {formatMs(llmStats?.avg)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    P95: {formatMs(llmStats?.p95)}
                                </div>
                            </CardContent>
                        </Card>

                        {/* TTS Latency */}
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Volume2 className="h-4 w-4" />
                                    TTS 평균
                                </div>
                                <div className="text-2xl font-bold">
                                    {formatMs(ttsStats?.avg)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    P95: {formatMs(ttsStats?.p95)}
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                    <div className='grid grid-cols-2 md:grid-cols-2 gap-4'>

                        {/* Client Load Latency */}
                        {clientLoadStats && (
                            <Card>
                                <CardContent className="py-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                        <Clock className="h-4 w-4" />
                                        Client Load 평균
                                    </div>
                                    <div className="text-2xl font-bold">
                                        {formatMs(clientLoadStats.avg)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        t2.5→t3
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* WER Accuracy Card */}
                        {hasAccuracyData && (
                            <Card className={avgWer !== null && avgWer <= 0.1 ? 'border-green-500' : avgWer !== null && avgWer <= 0.3 ? 'border-yellow-500' : 'border-red-500'}>
                                <CardContent className="py-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                        <Target className="h-4 w-4" />
                                        정확도 (WER)
                                    </div>
                                    <div className={`text-2xl font-bold ${avgWer !== null && avgWer <= 0.1 ? 'text-green-600' : avgWer !== null && avgWer <= 0.3 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {avgWer !== null ? `${(Math.max(0, 1 - avgWer) * 100).toFixed(1)}%` : '-'}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        CER: {avgCer !== null ? `${(Math.max(0, 1 - avgCer) * 100).toFixed(1)}%` : '-'}
                                        <span className="ml-1 opacity-60">(높을수록 좋음)</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* Detailed Stats */}
            {e2eStats && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            E2E 레이턴시 상세
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-5 gap-4 text-center">
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">Min</div>
                                <div className="font-mono font-bold text-green-600">
                                    {formatMs(e2eStats.min)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">P50</div>
                                <div className="font-mono font-bold">{formatMs(e2eStats.p50)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">Avg</div>
                                <div
                                    className={`font-mono font-bold ${getLatencyColor(
                                        e2eStats.avg,
                                        targetLatencyMs,
                                        maxLatencyMs
                                    )}`}
                                >
                                    {formatMs(e2eStats.avg)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">P95</div>
                                <div className="font-mono font-bold">{formatMs(e2eStats.p95)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">Max</div>
                                <div className="font-mono font-bold text-red-600">
                                    {formatMs(e2eStats.max)}
                                </div>
                            </div>
                        </div>

                        {/* Visual Bar Chart */}
                        <div className="mt-6 space-y-2">
                            <div className="text-xs text-muted-foreground mb-2">
                                레이턴시 분포 (최근 {Math.min(testResults.length, 10)}회)
                            </div>
                            <div className="flex items-end gap-1 h-20">
                                {testResults.slice(-10).map((result, idx) => {
                                    const latency = result.metrics.e2eMs || result.metrics.serverTotalMs;
                                    const height = Math.min((latency / maxLatencyMs) * 100, 100);
                                    return (
                                        <div
                                            key={idx}
                                            className="flex-1 flex flex-col items-center"
                                        >
                                            <div
                                                className={`w-full rounded-t transition-all ${getLatencyBg(
                                                    latency,
                                                    targetLatencyMs,
                                                    maxLatencyMs
                                                )}`}
                                                style={{ height: `${height}%` }}
                                                title={`${formatMs(latency)}`}
                                            />
                                            <span className="text-[10px] text-muted-foreground mt-1">
                                                {idx + 1}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Target line indicator */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="flex-1 border-t-2 border-dashed border-green-500" />
                                <span>목표 ({formatMs(targetLatencyMs)})</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Accuracy Comparison Table */}
            {hasAccuracyData && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            인식 정확도 비교
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="text-left py-2 px-2">#</th>
                                        <th className="text-left py-2 px-2">정답 (Reference)</th>
                                        <th className="text-left py-2 px-2">STT 결과</th>
                                        <th className="text-right py-2 px-2">단어정확도</th>
                                        <th className="text-right py-2 px-2">문자정확도</th>
                                        <th className="text-right py-2 px-2">신뢰도</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {testResults.map((r, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="py-2 px-2 text-muted-foreground">{idx + 1}</td>
                                            <td className="py-2 px-2 text-xs font-mono max-w-[200px] truncate" title={r.referenceText}>
                                                {r.referenceText || '-'}
                                            </td>
                                            <td className="py-2 px-2 text-xs font-mono max-w-[200px] truncate" title={r.transcript}>
                                                {r.transcript}
                                            </td>
                                            <td className={`text-right py-2 px-2 font-mono ${r.metrics.wer !== undefined && r.metrics.wer !== null ? (Math.max(0, (1 - r.metrics.wer)) * 100 >= 90 ? 'text-green-600' : Math.max(0, (1 - r.metrics.wer)) * 100 >= 70 ? 'text-yellow-600' : 'text-red-600') : ''}`}>
                                                {r.metrics.wer !== undefined && r.metrics.wer !== null ? `${(Math.max(0, Math.min(100, (1 - r.metrics.wer) * 100))).toFixed(1)}%` : '-'}
                                            </td>
                                            <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                                                {r.metrics.cer !== undefined && r.metrics.cer !== null ? `${(Math.max(0, Math.min(100, (1 - r.metrics.cer) * 100))).toFixed(1)}%` : '-'}
                                            </td>
                                            <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                                                {r.metrics.sttConfidence !== undefined ? `${(r.metrics.sttConfidence * 100).toFixed(0)}%` : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Result Summary */}
            {testResults.length > 0 && !isRunning && (
                <Card className={isTargetMet ? 'bg-green-500/10' : 'bg-yellow-500/10'}>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            {isTargetMet ? (
                                <TrendingUp className="h-8 w-8 text-green-600" />
                            ) : (
                                <TrendingDown className="h-8 w-8 text-yellow-600" />
                            )}
                            <div>
                                <div className="font-medium">
                                    {isTargetMet
                                        ? '✅ 목표 달성!'
                                        : '⚠️ 목표 미달성'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    평균 E2E 레이턴시: {formatMs(e2eStats?.avg)} (목표:{' '}
                                    {formatMs(targetLatencyMs)})
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {testResults.length === 0 && !isRunning && (
                <Card>
                    <CardContent className="py-8 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <div className="text-sm text-muted-foreground">
                            아직 테스트 결과가 없습니다.
                            <br />
                            음성 녹음을 시작하여 레이턴시를 측정하세요.
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default MetricsDashboard;
