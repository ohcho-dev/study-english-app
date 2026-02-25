'use client';

/**
 * Run0Runner Component - Pure latency measurement UI
 * 
 * STT → LLM → TTS pipeline latency testing interface.
 * No template or scenario dependencies.
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Download, MessageSquare } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { resolveMediaUrl } from '@/shared/lib/api';

import { useRun0, useTestPhrases } from '../model/useRun0';
import { useStreamingSTT } from '../model/useStreamingSTT';
import { VoiceRecorder } from './VoiceRecorder';
import { Run0ConfigPanel } from './Run0ConfigPanel';
import { MetricsDashboard } from './MetricsDashboard';

export const Run0Runner = () => {
    const run0 = useRun0();
    const { data: testPhrases = [] } = useTestPhrases();
    const streamingSTT = useStreamingSTT();

    const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
    const [showConversation, setShowConversation] = useState(true);
    const isStreamingMode = run0.config.sttMode === 'streaming';

    // Streaming mode: track when recording stopped (with timestamp for E2E)
    const [recordingStopTime, setRecordingStopTime] = useState<number | null>(null);
    const streamingProcessedRef = useRef(false);

    // Handle recording completion
    const handleRecordingComplete = (blob: Blob, t0UserEnd: number) => {
        if (isStreamingMode) {
            // In streaming mode: record stop time + show "처리중" immediately
            console.log('[Run0Runner] Recording stopped (streaming mode), waiting for transcript...');
            setRecordingStopTime(t0UserEnd);
            // Show "처리중..." immediately on stop (don't wait for useEffect)
            run0.setProcessing(true);
        } else {
            // Sync mode: send audio blob for full STT → LLM → TTS
            run0.processRecording(blob, t0UserEnd, selectedPhrase || undefined);
        }
    };

    // Streaming mode: process result when ALL conditions are met:
    // 1) Recording has stopped (recordingStopTime is set)
    // 2) Server has finished ALL gRPC sessions and sent 'done' (isDone)
    // 3) A transcript is available
    useEffect(() => {
        if (!isStreamingMode || !recordingStopTime || !streamingSTT.isDone) return;
        if (streamingProcessedRef.current) return;

        // Combine accumulated finals + any remaining interim
        const transcript = [streamingSTT.finalTranscript, streamingSTT.interimTranscript]
            .filter(Boolean).join(' ').trim();
        if (!transcript) return;

        streamingProcessedRef.current = true;
        const t1AsrFinal = streamingSTT.finalTimestamp || Date.now();
        const sttLatency = Math.max(0, t1AsrFinal - recordingStopTime);
        console.log('[Run0Runner] ✅ Server done — processing full transcript:',
            transcript, `STT: ${sttLatency}ms`);

        run0.processStreamingResult(
            transcript,
            recordingStopTime,
            t1AsrFinal,
            selectedPhrase || undefined,
            undefined,
            sttLatency,
        );

        setRecordingStopTime(null);
    }, [isStreamingMode, recordingStopTime, streamingSTT.isDone,
        streamingSTT.finalTranscript, streamingSTT.interimTranscript,
        streamingSTT.finalTimestamp, streamingSTT.connectTime,
        selectedPhrase, run0]);

    // Export results as CSV
    const exportResults = () => {
        const csvRows = [
            ['Iteration', 'IsWarmup', 'Transcript', 'Reply', 'ReferenceText', 'ASR_ms', 'LLM_ms', 'TTS_ms', 'ClientLoad_ms', 'Server_ms', 'E2E_ms', 'WER', 'CER', 'Timestamp'],
            ...run0.results.map((r) => [
                r.iteration.toString(),
                r.isWarmup.toString(),
                `"${r.transcript.replace(/"/g, '""')}"`,
                `"${r.reply.replace(/"/g, '""')}"`,
                `"${(r.referenceText || '').replace(/"/g, '""')}"`,
                r.metrics.asrMs.toString(),
                r.metrics.llmMs.toString(),
                r.metrics.ttsMs.toString(),
                r.metrics.clientLoadMs?.toString() || '',
                r.metrics.serverTotalMs.toString(),
                r.metrics.e2eMs?.toString() || '',
                r.metrics.wer?.toString() || '',
                r.metrics.cer?.toString() || '',
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
                                        enableVAD: true,
                                        vadSilenceThreshold: 0.15,
                                        vadSilenceTimeoutMs: 3000,
                                        vadMinDurationSec: 1,
                                        onStart: isStreamingMode
                                            ? () => {
                                                streamingProcessedRef.current = false;
                                                streamingSTT.connect({
                                                    model: run0.config.sttModel,
                                                    language: 'en-US',
                                                    interim_results: true,
                                                });
                                            }
                                            : undefined,
                                        onDataAvailable: isStreamingMode
                                            ? (data) => {
                                                streamingSTT.sendChunk(data);
                                            }
                                            : undefined,
                                        onStop: isStreamingMode
                                            ? () => {
                                                // Don't disconnect — send stop signal so server
                                                // can finish processing and return final result
                                                streamingSTT.sendStop();
                                            }
                                            : undefined,
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

                                {/* Streaming STT Subtitle Area */}
                                {isStreamingMode && (streamingSTT.isStreaming || streamingSTT.hasResult) && (
                                    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`h-2 w-2 rounded-full ${streamingSTT.isStreaming ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
                                            <span className="text-xs text-muted-foreground">
                                                {streamingSTT.isStreaming ? '실시간 인식 중...' : '인식 완료'}
                                            </span>
                                        </div>
                                        <p className="text-lg font-mono text-white min-h-[2rem]">
                                            {[streamingSTT.finalTranscript, streamingSTT.interimTranscript].filter(Boolean).join(' ') || '...'}
                                        </p>
                                        {streamingSTT.finalTranscript && (
                                            <div className="mt-2 flex items-center gap-3">
                                                <p className="text-xs text-green-400 font-mono">
                                                    ✓ {streamingSTT.finalTranscript}
                                                </p>
                                                {streamingSTT.ttfrMs !== null && (
                                                    <span className="text-xs text-zinc-400 font-mono">
                                                        TTFR: {(streamingSTT.ttfrMs / 1000).toFixed(2)}s
                                                    </span>
                                                )}
                                            </div>
                                        )}
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

