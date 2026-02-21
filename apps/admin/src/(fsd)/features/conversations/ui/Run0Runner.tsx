'use client';

/**
 * Run0Runner Component - Pure latency measurement UI
 * 
 * STT → LLM → TTS pipeline latency testing interface.
 * No template or scenario dependencies.
 */

import { useState } from 'react';
import { Play, Square, RotateCcw, Download, MessageSquare } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { resolveMediaUrl } from '@/shared/lib/api';

import { useRun0, useTestPhrases } from '../model/useRun0';
import { VoiceRecorder } from './VoiceRecorder';
import { Run0ConfigPanel } from './Run0ConfigPanel';
import { MetricsDashboard } from './MetricsDashboard';

export const Run0Runner = () => {
    const run0 = useRun0();
    const { data: testPhrases = [] } = useTestPhrases();

    const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
    const [showConversation, setShowConversation] = useState(true);

    // Handle recording completion
    const handleRecordingComplete = (blob: Blob, t0UserEnd: number) => {
        run0.processRecording(blob, t0UserEnd);
    };

    // Export results as CSV
    const exportResults = () => {
        const csvRows = [
            ['Iteration', 'IsWarmup', 'Transcript', 'Reply', 'ASR_ms', 'LLM_ms', 'TTS_ms', 'ClientLoad_ms', 'Server_ms', 'E2E_ms', 'Timestamp'],
            ...run0.results.map((r) => [
                r.iteration.toString(),
                r.isWarmup.toString(),
                `"${r.transcript.replace(/"/g, '""')}"`,
                `"${r.reply.replace(/"/g, '""')}"`,
                r.metrics.asrMs.toString(),
                r.metrics.llmMs.toString(),
                r.metrics.ttsMs.toString(),
                r.metrics.clientLoadMs?.toString() || '',
                r.metrics.serverTotalMs.toString(),
                r.metrics.e2eMs?.toString() || '',
                new Date(r.timestamp).toISOString(),
            ]),
        ];

        const csvContent = csvRows.map((row) => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `run0_results_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Latency Lab (Run0)</h1>
                    <p className="text-muted-foreground">
                        STT → LLM → TTS 파이프라인 레이턴시 베이스라인 측정
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {run0.isRunning ? (
                        <Button variant="destructive" onClick={run0.stopExperiment}>
                            <Square className="h-4 w-4 mr-2" />
                            실험 중지
                        </Button>
                    ) : (
                        <Button onClick={run0.startExperiment}>
                            <Play className="h-4 w-4 mr-2" />
                            실험 시작
                        </Button>
                    )}

                    {run0.results.length > 0 && (
                        <>
                            <Button variant="outline" onClick={run0.resetExperiment}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                초기화
                            </Button>
                            <Button variant="outline" onClick={exportResults}>
                                <Download className="h-4 w-4 mr-2" />
                                CSV 내보내기
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Settings */}
                <div className="space-y-6">
                    <Run0ConfigPanel
                        config={run0.config}
                        onConfigChange={run0.updateConfig}
                        defaultCollapsed={false}
                        disabled={run0.isRunning}
                    />
                </div>

                {/* Center Column: Voice Recorder */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <Card>
                        <CardContent className="py-6">
                            <div className="text-center space-y-4">
                                {/* Status Badge */}
                                <div>
                                    <Badge
                                        variant={
                                            run0.isProcessing
                                                ? 'default'
                                                : run0.isRunning
                                                    ? 'outline'
                                                    : 'secondary'
                                        }
                                        className="text-sm"
                                    >
                                        {run0.isProcessing
                                            ? '처리 중...'
                                            : run0.isWarmingUp
                                                ? `워밍업 ${run0.currentIteration}/${run0.config.warmupIterations}`
                                                : run0.isRunning
                                                    ? `테스트 ${run0.currentIteration - run0.config.warmupIterations}/${run0.config.testIterations}`
                                                    : '대기 중'}
                                    </Badge>
                                </div>

                                {/* Voice Recorder */}
                                <VoiceRecorder
                                    onRecordingComplete={handleRecordingComplete}
                                    disabled={!run0.isRunning}
                                    size="lg"
                                    options={{
                                        maxDuration: 30,
                                    }}
                                />

                                {/* Selected Phrase Display */}
                                {selectedPhrase && (
                                    <div className="mt-4 p-3 bg-muted/50 rounded-md">
                                        <p className="text-sm text-muted-foreground mb-1">
                                            선택된 테스트 문구:
                                        </p>
                                        <p className="font-medium">{selectedPhrase}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Test Phrases */}
                    {testPhrases.length > 0 && (
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-base">테스트 문구</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {testPhrases.map((phrase, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedPhrase === phrase
                                            ? 'bg-primary/10 border border-primary/30'
                                            : 'bg-muted/50 hover:bg-muted'
                                            }`}
                                        onClick={() => setSelectedPhrase(phrase)}
                                    >
                                        {phrase}
                                    </button>
                                ))}
                                <p className="text-xs text-muted-foreground pt-2">
                                    클릭하여 테스트할 문구 선택 (참고용)
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Last Response */}
                    {run0.lastResponse && (
                        <Card>
                            <CardHeader className="py-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    최근 대화
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowConversation(!showConversation)}
                                >
                                    {showConversation ? '숨기기' : '보기'}
                                </Button>
                            </CardHeader>
                            {showConversation && (
                                <CardContent className="space-y-3">
                                    {/* User */}
                                    <div className="flex gap-2">
                                        <span className="text-xs font-medium text-muted-foreground w-8">
                                            You
                                        </span>
                                        <p className="flex-1 text-sm bg-primary/10 rounded-lg px-3 py-2">
                                            {run0.lastResponse.transcript}
                                        </p>
                                    </div>

                                    {/* AI */}
                                    <div className="flex gap-2">
                                        <span className="text-xs font-medium text-muted-foreground w-8">
                                            AI
                                        </span>
                                        <p className="flex-1 text-sm bg-muted rounded-lg px-3 py-2">
                                            {run0.lastResponse.reply_text}
                                        </p>
                                    </div>

                                    {/* Audio Player */}
                                    {(run0.lastResponse.audio_base64 || run0.lastResponse.audio_url) && (
                                        <audio
                                            src={
                                                run0.lastResponse.audio_base64
                                                    ? `data:audio/mp3;base64,${run0.lastResponse.audio_base64}`
                                                    : run0.lastResponse.audio_url
                                                        ? resolveMediaUrl(run0.lastResponse.audio_url)
                                                        : undefined
                                            }
                                            controls
                                            className="w-full h-8"
                                        />
                                    )}

                                    {/* Quick Metrics */}
                                    {run0.config.showMetrics && (
                                        <div className="flex gap-2 text-xs">
                                            <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded">
                                                STT: {run0.lastResponse.asr_latency_ms}ms
                                            </span>
                                            <span className="px-2 py-1 bg-purple-500/10 text-purple-600 rounded">
                                                LLM: {run0.lastResponse.llm_latency_ms}ms
                                            </span>
                                            <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded">
                                                TTS: {run0.lastResponse.tts_latency_ms}ms
                                            </span>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Error Display */}
                    {run0.error && (
                        <Card className="border-red-500 bg-red-500/10">
                            <CardContent className="py-4">
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    ❌ {run0.error}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: Metrics */}
                <div>
                    <MetricsDashboard
                        results={run0.results}
                        targetLatencyMs={run0.config.targetLatencyMs}
                        maxLatencyMs={run0.config.maxLatencyMs}
                        isRunning={run0.isRunning}
                        currentIteration={run0.currentIteration}
                        totalIterations={run0.totalIterations}
                    />
                </div>
            </div>
        </div >
    );
};

export default Run0Runner;

