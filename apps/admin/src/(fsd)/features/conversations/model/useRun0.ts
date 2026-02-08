/**
 * RUN0 Hook - Experiment orchestration with customizable settings
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import {
    getAvailableVoices,
    getTestPhrases,
    logClientTimestamp,
    processVoice,
} from '../api/conversationsApi';
import type { Run0VoiceResponse } from './types';

// ============================================================================
// Experiment Configuration Types
// ============================================================================

export interface Run0Config {
    /** TTS voice ID */
    voiceId: string;
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
}

export const DEFAULT_RUN0_CONFIG: Run0Config = {
    voiceId: 'en-US-Wavenet-F',
    systemPrompt: `You are a friendly English conversation partner.
You help users practice English through natural conversation.
Keep responses concise (1-3 sentences) and conversational.
Respond naturally to what the user says.`,
    autoPlayAudio: true,
    showMetrics: true,
    enableTimestampLogging: true,
    warmupIterations: 2,
    testIterations: 10,
    targetLatencyMs: 3000,
    maxLatencyMs: 5000,
};

// ============================================================================
// Experiment State Types
// ============================================================================

export interface LatencyMetrics {
    asrMs: number;
    llmMs: number;
    ttsMs: number;
    serverTotalMs: number;
    e2eMs: number | null; // null until t3 is logged
}

export interface TestResult {
    iteration: number;
    transcript: string;
    reply: string;
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
 * Hook to fetch available TTS voices
 */
export const useVoices = () => {
    return useQuery({
        queryKey: ['voices'],
        queryFn: getAvailableVoices,
    });
};

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
export const useRun0 = (templateId?: string) => {
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

    // Audio element for playback
    const audioRef = useCallback(() => {
        if (typeof window !== 'undefined') {
            return new Audio();
        }
        return null;
    }, []);

    // Process voice mutation
    const processVoiceMutation = useMutation({
        mutationFn: async ({
            audioBlob,
            t0UserEnd,
        }: {
            audioBlob: Blob;
            t0UserEnd: number;
        }) => {
            return processVoice(audioBlob, t0UserEnd, {
                sessionId: state.sessionId || undefined,
                templateId,
                voiceId: config.voiceId,
                systemPrompt: config.systemPrompt,
            });
        },
        onSuccess: async (response) => {
            // Update session ID from first response
            if (!state.sessionId) {
                setState((prev) => ({ ...prev, sessionId: response.session_id }));
            }

            const isWarmup = state.currentIteration < config.warmupIterations;
            const testResult: TestResult = {
                iteration: state.currentIteration,
                transcript: response.transcript,
                reply: response.reply_text,
                metrics: {
                    asrMs: response.asr_latency_ms,
                    llmMs: response.llm_latency_ms,
                    ttsMs: response.tts_latency_ms,
                    serverTotalMs: response.server_total_ms,
                    e2eMs: null,
                },
                isWarmup,
                timestamp: Date.now(),
            };

            setState((prev) => ({
                ...prev,
                lastResponse: response,
                results: [...prev.results, testResult],
                currentIteration: prev.currentIteration + 1,
                isProcessing: false,
            }));

            // Auto-play audio if enabled
            if (config.autoPlayAudio && response.audio_url) {
                const audio = audioRef();
                if (audio) {
                    audio.src = response.audio_url;
                    audio.onplay = () => {
                        // Log t3 timestamp
                        if (config.enableTimestampLogging) {
                            const t3 = Date.now();
                            logClientTimestamp({
                                session_id: response.session_id,
                                turn_id: response.turn_id,
                                t3_audio_play_start: t3,
                            }).then((logResult) => {
                                // Update E2E latency in results
                                setState((prev) => ({
                                    ...prev,
                                    results: prev.results.map((r, i) =>
                                        i === prev.results.length - 1
                                            ? {
                                                ...r,
                                                metrics: {
                                                    ...r.metrics,
                                                    e2eMs: logResult.e2e_latency_ms,
                                                },
                                            }
                                            : r
                                    ),
                                }));
                            });
                        }
                    };
                    audio.play();
                }
            }
        },
        onError: (error) => {
            setState((prev) => ({
                ...prev,
                isProcessing: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }));
        },
    });

    // Start experiment
    const startExperiment = useCallback(() => {
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
    const stopExperiment = useCallback(() => {
        setState((prev) => ({ ...prev, isRunning: false }));
    }, []);

    // Process a voice recording
    const processRecording = useCallback(
        (audioBlob: Blob, t0UserEnd: number) => {
            setState((prev) => ({ ...prev, isProcessing: true, error: null }));
            processVoiceMutation.mutate({ audioBlob, t0UserEnd });
        },
        [processVoiceMutation]
    );

    // Update config
    const updateConfig = useCallback((updates: Partial<Run0Config>) => {
        setConfig((prev) => ({ ...prev, ...updates }));
    }, []);

    // Reset experiment
    const resetExperiment = useCallback(() => {
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
        updateConfig,
        resetExperiment,
    };
};

export default useRun0;
