/**
 * RUN0 Hook - Experiment orchestration with customizable settings
 */

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import {
    endSession,
    getTestPhrases,
    logClientTimestamp,
    processVoice,
    processText,
} from '../api/conversationsApi';
import type { Run0VoiceResponse } from './types';
import { resolveMediaUrl } from '@/shared/lib/api';

// ============================================================================
// Experiment Configuration Types
// ============================================================================

export interface Run0Config {
    /** TTS voice ID */
    voiceId: string;
    /** STT model */
    sttModel: string;
    /** STT mode: sync (batch) or streaming */
    sttMode: 'sync' | 'streaming';
    /** LLM model */
    llmModel: string;
    /** TTS provider: google-cloud or gemini */
    ttsProvider: string;
    /** TTS model (for Gemini TTS) */
    ttsModel: string;
    /** TTS mode: sync (batch) or streaming */
    ttsMode: 'sync' | 'streaming';
    /** Custom system prompt */
    systemPrompt: string;
    /** Auto-play response audio */
    autoPlayAudio: boolean;
    /** Show latency metrics in real-time */
    showMetrics: boolean;
    /** Log timestamps for analysis */
    enableTimestampLogging: boolean;
    /** Number of warmup iterations before actual test */
    warmupIterations: number;
    /** Number of test iterations */
    testIterations: number;
    /** Target E2E latency (ms) - for visual feedback */
    targetLatencyMs: number;
    /** Max acceptable E2E latency (ms) */
    maxLatencyMs: number;
    /** Enable TTS A/B comparison mode */
    enableTtsComparison: boolean;
    /** TTS B provider (for A/B comparison) */
    ttsBProvider: string;
    /** TTS B model */
    ttsBModel: string;
    /** TTS B voice ID */
    ttsBVoiceId: string;
}

export const DEFAULT_RUN0_CONFIG: Run0Config = {
    voiceId: 'en-US-Journey-F',
    sttModel: 'chirp_3',
    sttMode: 'sync',
    llmModel: 'gemini-2.5-flash',
    ttsProvider: 'google-cloud',
    ttsModel: 'gemini-2.5-flash-preview-tts',
    ttsMode: 'sync',
    systemPrompt: `You are a helpful AI friend. We are currently discussing three options for our upcoming secret party. Always reply in one short English sentence within 12 words.`,
    autoPlayAudio: true,
    showMetrics: true,
    enableTimestampLogging: true,
    warmupIterations: 1,
    testIterations: 5,
    targetLatencyMs: 3000,
    maxLatencyMs: 5000,
    enableTtsComparison: false,
    ttsBProvider: 'gemini',
    ttsBModel: 'gemini-2.5-flash-preview-tts',
    ttsBVoiceId: 'Kore',
};

// ============================================================================
// Experiment State Types
// ============================================================================

export interface LatencyMetrics {
    asrMs: number;
    llmMs: number;
    ttsMs: number;
    clientLoadMs: number | null; // null until t3 is logged
    serverTotalMs: number;
    e2eMs: number | null; // null until t3 is logged
    // Phase 1: accuracy & performance metrics
    sttConfidence?: number;
    recognitionApi?: 'v1' | 'v2';
    // Phase 2: WER/CER
    wer?: number;
    cer?: number;
}

export interface TestResult {
    iteration: number;
    transcript: string;
    reply: string;
    referenceText?: string;
    metrics: LatencyMetrics;
    isWarmup: boolean;
    timestamp: number;
}

export interface Run0State {
    /** Current session ID */
    sessionId: string | null;
    /** Is experiment running */
    isRunning: boolean;
    /** Is processing current turn */
    isProcessing: boolean;
    /** Current iteration (including warmup) */
    currentIteration: number;
    /** Test results */
    results: TestResult[];
    /** Last response for display */
    lastResponse: Run0VoiceResponse | null;
    /** Error message if any */
    error: string | null;
}

// ============================================================================
// Hooks
// ============================================================================



/**
 * Hook to fetch test phrases
 */
export const useTestPhrases = () => {
    return useQuery({
        queryKey: ['test-phrases'],
        queryFn: getTestPhrases,
    });
};

/**
 * Main RUN0 experiment hook with full customization
 */
export const useRun0 = () => {
    const [config, setConfig] = useState<Run0Config>(DEFAULT_RUN0_CONFIG);
    const [state, setState] = useState<Run0State>({
        sessionId: null,
        isRunning: false,
        isProcessing: false,
        currentIteration: 0,
        results: [],
        lastResponse: null,
        error: null,
    });

    // Use a ref to synchronously track sessionId, avoiding React batching/stale closure issues
    const sessionIdRef = useRef<string | null>(null);

    // Audio element for playback
    const audioRef = useCallback(() => {
        if (typeof window !== 'undefined') {
            return new Audio();
        }
        return null;
    }, []);

    // Shared response handler (used by both sync and streaming modes)
    const handleResponse = useCallback(async (response: Run0VoiceResponse) => {
        // Capture completion info from setState to use in side effect
        const completionInfo = { isComplete: false, sessionId: '' };

        // Use setState callback to get FRESH state (avoids stale closure)
        setState((prev) => {
            const isWarmup = prev.currentIteration < config.warmupIterations;
            const testResult: TestResult = {
                iteration: prev.currentIteration,
                transcript: response.transcript,
                reply: response.reply_text,
                referenceText: response.reference_text,
                metrics: {
                    asrMs: response.asr_latency_ms,
                    llmMs: response.llm_latency_ms,
                    ttsMs: response.tts_latency_ms,
                    clientLoadMs: null,
                    serverTotalMs: response.server_total_ms,
                    e2eMs: null,
                    sttConfidence: response.stt_confidence,
                    recognitionApi: response.recognition_api,
                    wer: response.wer,
                    cer: response.cer,
                },
                isWarmup,
                timestamp: Date.now(),
            };

            const nextIteration = prev.currentIteration + 1;
            const totalIter = config.warmupIterations + config.testIterations;
            const isComplete = nextIteration >= totalIter;
            const sessionId = prev.sessionId || response.session_id;

            // Sync ref for identical latest ID
            sessionIdRef.current = sessionId;

            completionInfo.isComplete = isComplete;
            completionInfo.sessionId = sessionId;

            return {
                ...prev,
                sessionId,
                lastResponse: response,
                results: [...prev.results, testResult],
                currentIteration: nextIteration,
                isProcessing: false,
                isRunning: !isComplete,
            };
        });

        // Auto-play audio if enabled
        if (config.autoPlayAudio) {
            const audio = audioRef();
            if (audio) {
                let audioSrc: string | null = null;
                if (response.audio_base64) {
                    audioSrc = `data:audio/mp3;base64,${response.audio_base64}`;
                } else if (response.audio_url) {
                    audioSrc = resolveMediaUrl(response.audio_url);
                }

                if (audioSrc) {
                    audio.src = audioSrc;
                    audio.onplay = () => {
                        if (config.enableTimestampLogging) {
                            const t3 = Date.now();
                            logClientTimestamp({
                                session_id: response.session_id,
                                turn_id: response.turn_id,
                                t3_audio_play_start: t3,
                            }).then((logResult) => {
                                setState((prev) => ({
                                    ...prev,
                                    results: prev.results.map((r, i) =>
                                        i === prev.results.length - 1
                                            ? {
                                                ...r,
                                                metrics: {
                                                    ...r.metrics,
                                                    e2eMs: logResult.e2e_latency_ms,
                                                    clientLoadMs: t3 - response.t2_5_tts_ready,
                                                },
                                            }
                                            : r
                                    ),
                                }));
                            });
                        }
                    };
                    audio.play().catch(console.error);
                }
            }
        }

        // Handle completion
        if (completionInfo.isComplete) {
            setTimeout(async () => {
                try {
                    await endSession(completionInfo.sessionId, 'completed');
                    alert('모든 테스트가 완료되었습니다.');
                } catch (error) {
                    console.error('Failed to auto-end session:', error);
                }
            }, 100);
        }
    }, [config, audioRef]);

    // Shared error handler
    const handleError = useCallback((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('409') || errorMessage.toLowerCase().includes('time out')) {
            alert('세션이 만료되었습니다. 페이지를 새로고침합니다.');
            window.location.reload();
            return;
        }

        setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: errorMessage,
        }));
    }, []);

    const processVoiceMutation = useMutation({
        mutationFn: async ({
            audioBlob,
            t0UserEnd,
            referenceText,
        }: {
            audioBlob: Blob;
            t0UserEnd: number;
            referenceText?: string;
        }) => {
            const currentSessionId = sessionIdRef.current || undefined;
            return processVoice(audioBlob, t0UserEnd, {
                sessionId: currentSessionId,
                voiceId: config.voiceId,
                systemPrompt: config.systemPrompt,
                sttModel: config.sttModel,
                sttMode: config.sttMode,
                llmModel: config.llmModel,
                ttsProvider: config.ttsProvider,
                ttsModel: config.ttsModel,
                ttsMode: config.ttsMode,
                referenceText,
                warmupIterations: config.warmupIterations,
            });
        },
        onSuccess: handleResponse,
        onError: handleError,
    });

    // Start experiment
    const startExperiment = useCallback(async () => {
        sessionIdRef.current = null;
        setState({
            sessionId: null,
            isRunning: true,
            isProcessing: false,
            currentIteration: 0,
            results: [],
            lastResponse: null,
            error: null,
        });
    }, []);

    // Stop experiment
    const stopExperiment = useCallback(async () => {
        if (state.sessionId) {
            try {
                await endSession(state.sessionId, 'completed');
            } catch (error) {
                console.error('Failed to end session:', error);
            }
        }
        setState((prev) => ({ ...prev, isRunning: false }));
    }, [state.sessionId]);

    // Process a voice recording (sync STT mode)
    const processRecording = useCallback(
        (audioBlob: Blob, t0UserEnd: number, referenceText?: string) => {
            setState((prev) => ({ ...prev, isProcessing: true, error: null }));
            processVoiceMutation.mutate({ audioBlob, t0UserEnd, referenceText });
        },
        [processVoiceMutation]
    );

    // Process streaming STT result (streaming mode — skips STT, goes directly to LLM→TTS)
    const processStreamingResult = useCallback(
        async (transcript: string, t0UserEnd: number, t1AsrFinal: number, referenceText?: string, sttConfidence?: number, sttLatencyMs?: number) => {
            const currentSessionId = sessionIdRef.current || undefined;
            setState((prev) => ({ ...prev, isProcessing: true, error: null }));

            try {
                const response = await processText(transcript, t0UserEnd, t1AsrFinal, {
                    sessionId: currentSessionId,
                    voiceId: config.voiceId,
                    systemPrompt: config.systemPrompt,
                    sttModel: config.sttModel,
                    sttMode: 'streaming',
                    llmModel: config.llmModel,
                    ttsProvider: config.ttsProvider,
                    ttsModel: config.ttsModel,
                    ttsMode: config.ttsMode,
                    referenceText,
                    warmupIterations: config.warmupIterations,
                    sttConfidence,
                    sttLatencyMs,
                });
                await handleResponse(response);
            } catch (error) {
                handleError(error);
            }
        },
        [config, handleResponse, handleError]
    );

    // Update config
    const updateConfig = useCallback((updates: Partial<Run0Config>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
    }, []);

    // Reset experiment
    const resetExperiment = useCallback(() => {
        sessionIdRef.current = null;
        setState({
            sessionId: null,
            isRunning: false,
            isProcessing: false,
            currentIteration: 0,
            results: [],
            lastResponse: null,
            error: null,
        });
    }, []);

    // Calculate summary metrics
    const getSummaryMetrics = useCallback(() => {
        const testResults = state.results.filter((r) => !r.isWarmup);
        if (testResults.length === 0) return null;

        const e2eLatencies = testResults
            .map((r) => r.metrics.e2eMs)
            .filter((v): v is number => v !== null);

        const avg = (arr: number[]) =>
            arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

        const percentile = (arr: number[], p: number) => {
            if (arr.length === 0) return null;
            const sorted = [...arr].sort((a, b) => a - b);
            const idx = Math.floor(sorted.length * p);
            return sorted[Math.min(idx, sorted.length - 1)];
        };

        return {
            count: testResults.length,
            e2e: {
                avg: avg(e2eLatencies),
                p50: percentile(e2eLatencies, 0.5),
                p95: percentile(e2eLatencies, 0.95),
                min: e2eLatencies.length > 0 ? Math.min(...e2eLatencies) : null,
                max: e2eLatencies.length > 0 ? Math.max(...e2eLatencies) : null,
            },
            asr: {
                avg: avg(testResults.map((r) => r.metrics.asrMs)),
            },
            llm: {
                avg: avg(testResults.map((r) => r.metrics.llmMs)),
            },
            tts: {
                avg: avg(testResults.map((r) => r.metrics.ttsMs)),
            },
            serverTotal: {
                avg: avg(testResults.map((r) => r.metrics.serverTotalMs)),
            },
        };
    }, [state.results]);

    // Check if target met
    const isTargetMet = useCallback(() => {
        const summary = getSummaryMetrics();
        if (!summary || summary.e2e.avg === null) return null;
        return summary.e2e.avg <= config.targetLatencyMs;
    }, [getSummaryMetrics, config.targetLatencyMs]);

    return {
        // State
        ...state,
        config,

        // Derived state
        isWarmingUp: state.currentIteration < config.warmupIterations,
        totalIterations: config.warmupIterations + config.testIterations,
        remainingIterations:
            config.warmupIterations + config.testIterations - state.currentIteration,
        summaryMetrics: getSummaryMetrics(),
        isTargetMet: isTargetMet(),

        // Actions
        startExperiment,
        stopExperiment,
        processRecording,
        processStreamingResult,
        updateConfig,
        resetExperiment,
        setProcessing: (isProcessing: boolean) => setState((prev) => ({ ...prev, isProcessing })),
    };
};

export default useRun0;
