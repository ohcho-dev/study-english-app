/**
 * useStreamingSTT — WebSocket client for real-time streaming STT
 * 
 * Connects to /ws/stt/stream, receives audio chunks from VoiceRecorder,
 * and displays interim/final transcription results in real-time.
 * 
 * Usage:
 *   1. Call connect(config) to open WebSocket
 *   2. Pipe audio chunks via sendChunk(blob) from VoiceRecorder's onDataAvailable
 *   3. Call disconnect() when recording stops
 */

import { useCallback, useRef, useState } from 'react';

export interface StreamingSTTConfig {
    model?: string;
    language?: string;
    interim_results?: boolean;
    speech_end_timeout?: number;
    phrase_hints?: string[];
    enable_word_confidence?: boolean;
}

export interface StreamingSTTResult {
    type: 'interim' | 'final' | 'done' | 'error';
    transcript?: string;
    confidence?: number;
    is_final?: boolean;
    ttfr_ms?: number;
    interim_count?: number;
    processing_ms?: number;
    speech_end_method?: string;
    server_final_timestamp_ms?: number;
    error?: string;
}

export interface UseStreamingSTTReturn {
    /** Whether WebSocket is connected */
    isConnected: boolean;
    /** Whether currently streaming */
    isStreaming: boolean;
    /** Latest interim transcript */
    interimTranscript: string;
    /** Final transcript */
    finalTranscript: string;
    /** All results received */
    results: StreamingSTTResult[];
    /** Connect WebSocket and start streaming session */
    connect: (config?: StreamingSTTConfig) => void;
    /** Send an audio chunk (from VoiceRecorder's onDataAvailable) */
    sendChunk: (data: Blob) => void;
    /** Send stop signal to server (audio done, wait for final result) */
    sendStop: () => void;
    /** Force disconnect WebSocket (keeps transcripts) */
    disconnect: () => void;
    /** Whether any streaming results were received in this session */
    hasResult: boolean;
    /** Time To First Result in ms (from connect to first interim) */
    ttfrMs: number | null;
    /** Timestamp when final transcript was received */
    finalTimestamp: number | null;
    /** Whether server has finished processing (sent 'done' message) */
    isDone: boolean;
    /** Server timestamp when is_final was received (server clock, for accurate t1) */
    serverFinalTimestamp: number | null;
    /** Error message */
    error: string | null;
    /** Timestamp when WebSocket connected (streaming start time) */
    connectTime: number;
}

const getWsBaseUrl = (): string => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return apiBase.replace(/^http/, 'ws');
};

export const useStreamingSTT = (): UseStreamingSTTReturn => {
    const [isConnected, setIsConnected] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [finalTranscript, setFinalTranscript] = useState('');
    const [results, setResults] = useState<StreamingSTTResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasResult, setHasResult] = useState(false);
    const [ttfrMs, setTtfrMs] = useState<number | null>(null);
    const [finalTimestamp, setFinalTimestamp] = useState<number | null>(null);
    const [isDone, setIsDone] = useState(false);
    const [serverFinalTimestamp, setServerFinalTimestamp] = useState<number | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const connectTimeRef = useRef<number>(0);
    const hasResultRef = useRef<boolean>(false);

    /** Handle incoming WebSocket messages */
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const result: StreamingSTTResult = JSON.parse(event.data);
            setResults((prev) => [...prev, result]);

            if (result.type === 'interim' && result.transcript) {
                // Show accumulated finals + current interim
                setInterimTranscript((prevFinal) => {
                    // We can't access finalTranscriptRef here, so just show interim
                    return result.transcript!;
                });
                if (!hasResultRef.current) {
                    // First interim result: record TTFR
                    setTtfrMs(Date.now() - connectTimeRef.current);
                }
                hasResultRef.current = true;
                setHasResult(true);
            } else if (result.type === 'final' && result.transcript) {
                // Accumulate multiple final results (user may pause and continue)
                setFinalTranscript((prev) => prev ? `${prev} ${result.transcript}` : result.transcript!);
                setFinalTimestamp(Date.now());
                // Capture server's is_final timestamp for accurate t1 measurement
                if (result.server_final_timestamp_ms) {
                    setServerFinalTimestamp(result.server_final_timestamp_ms);
                }
                setInterimTranscript('');
                hasResultRef.current = true;
                setHasResult(true);
            } else if (result.type === 'error') {
                setError(result.error || 'Streaming STT error');
            }

            if (result.type === 'done' || result.type === 'error') {
                setIsDone(true);
                cleanupWs();
            }
        } catch {
            // Ignore parse errors
        }
    }, []);

    /** Cleanup WebSocket connection (does NOT reset transcripts) */
    const cleanupWs = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setIsStreaming(false);
        // NOTE: intentionally NOT resetting transcripts here
    }, []);
    const retryCountRef = useRef(0);
    const savedConfigRef = useRef<StreamingSTTConfig>({});
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500;

    /** Internal connect implementation */
    const connectInternal = useCallback((config: StreamingSTTConfig, isRetry: boolean) => {
        if (!isRetry) {
            // Only reset state on first attempt (not retries)
            retryCountRef.current = 0;
            setError(null);
            setInterimTranscript('');
            setFinalTranscript('');
            setResults([]);
            setHasResult(false);
            setTtfrMs(null);
            setFinalTimestamp(null);
            setIsDone(false);
            hasResultRef.current = false;
            chunkCountRef.current = 0;
            pendingChunksRef.current = [];
            connectTimeRef.current = Date.now();
        }
        savedConfigRef.current = config;

        const wsUrl = `${getWsBaseUrl()}/api/v1/conversations/ws/stt/stream`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setIsStreaming(true);
            retryCountRef.current = 0; // Reset retry count on successful connection

            // Send config as first message
            ws.send(JSON.stringify({
                model: config.model || 'chirp_3',
                language: config.language || 'en-US',
                interim_results: config.interim_results ?? true,
                speech_end_timeout: config.speech_end_timeout || 5.0,
                phrase_hints: config.phrase_hints,
                enable_word_confidence: config.enable_word_confidence || false,
            }));
        };

        ws.onmessage = handleMessage;

        ws.onerror = () => {
            console.warn(`[StreamingSTT] WebSocket error (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
        };

        ws.onclose = () => {
            setIsConnected(false);
            setIsStreaming(false);

            // Auto-retry if closed unexpectedly (no results received yet)
            if (!hasResultRef.current && retryCountRef.current < MAX_RETRIES) {
                retryCountRef.current++;
                console.log(`[StreamingSTT] Retrying connection (${retryCountRef.current}/${MAX_RETRIES})...`);
                setTimeout(() => {
                    connectInternal(savedConfigRef.current, true);
                }, RETRY_DELAY_MS);
            }
        };
    }, [handleMessage]);

    /** Connect WebSocket and send initial config */
    const connect = useCallback((config: StreamingSTTConfig = {}) => {
        // Prevent duplicate connections
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            cleanupWs();
        }
        connectInternal(config, false);
    }, [connectInternal, cleanupWs]);

    const pendingChunksRef = useRef<ArrayBuffer[]>([]);
    const chunkCountRef = useRef(0);

    /** Send an audio chunk via WebSocket */
    const sendChunk = useCallback((data: Blob) => {
        if (!wsRef.current) return;

        data.arrayBuffer().then((buffer) => {
            if (!wsRef.current) return;

            if (wsRef.current.readyState === WebSocket.OPEN) {
                // Flush any pending chunks first
                const pendingCount = pendingChunksRef.current.length;
                while (pendingChunksRef.current.length > 0) {
                    const pending = pendingChunksRef.current.shift()!;
                    wsRef.current.send(pending);
                }
                wsRef.current.send(buffer);
                chunkCountRef.current++;
                if (chunkCountRef.current === 1) {
                    console.log(`[StreamingSTT] First chunk sent (${buffer.byteLength}B, flushed ${pendingCount} pending)`);
                } else if (chunkCountRef.current % 50 === 0) {
                    console.log(`[StreamingSTT] ${chunkCountRef.current} chunks sent`);
                }
            } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
                // Buffer chunks until connection opens
                pendingChunksRef.current.push(buffer);
            } else {
                console.warn(`[StreamingSTT] WS state=${wsRef.current.readyState}, dropping chunk`);
            }
        });
    }, []);

    /** Send stop signal — tells server audio is done, waits for final result */
    const sendStop = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'stop' }));
            console.log('[StreamingSTT] Sent stop signal');
        }
    }, []);

    /** Force disconnect and cleanup */
    const disconnect = useCallback(() => {
        retryCountRef.current = MAX_RETRIES; // Prevent auto-retry on intentional disconnect
        cleanupWs();
    }, [cleanupWs]);

    // Legacy aliases for backward compatibility
    const startStreaming = useCallback((stream: MediaStream, config?: StreamingSTTConfig) => {
        // Just connect — audio chunks will come via sendChunk
        void stream; // unused, kept for API compatibility
        connect(config);
    }, [connect]);

    const stopStreaming = useCallback(() => {
        disconnect();
    }, [disconnect]);

    return {
        isConnected,
        isStreaming,
        interimTranscript,
        finalTranscript,
        results,
        connect,
        sendChunk,
        sendStop,
        disconnect,
        hasResult,
        ttfrMs,
        finalTimestamp,
        error,
        connectTime: connectTimeRef.current,
        isDone,
        serverFinalTimestamp,
    };
};

export default useStreamingSTT;
