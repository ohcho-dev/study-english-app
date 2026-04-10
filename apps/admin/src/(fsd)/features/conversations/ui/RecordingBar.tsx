'use client';

/**
 * RecordingBar Component
 * 
 * Bottom action bar for the Conversation Stage.
 * Handles: mic recording, pause, text mode toggle, auto-recording,
 * silence auto-stop, and status display. Mobile-first design.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Pause, Play, Keyboard, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { useVoiceRecorder } from '../model/useVoiceRecorder';

/** Silence auto-stop timeout (seconds) */
const SILENCE_TIMEOUT_SEC = 5;
/** Minimum recording duration (seconds) before silence detection activates */
const MIN_RECORD_SEC = 2;
/** Voice-band energy threshold — above mic noise floor (~0.03) but below speech (~0.1+) */
const VOICE_THRESHOLD = 0.05;
/** Minimum audio blob size (bytes) to consider valid — ~3KB for 1s of WebM */
const MIN_AUDIO_BYTES = 2000;
/** Debug log interval to avoid spam (ms) */
const DEBUG_LOG_INTERVAL = 2000;

interface RecordingBarProps {
    isUserTurn: boolean;
    isProcessing: boolean;
    isSessionActive: boolean;
    currentSpeakerName?: string;
    onRecordingComplete: (blob: Blob, t0UserEnd: number, tRecordingStart?: number, tFirstSpeech?: number) => void;
    onTextSubmit?: (text: string, t0UserEnd?: number, t1ServerFinal?: number, tRecordingStart?: number, tFirstSpeech?: number) => void;
    onEndSession: () => void;
    enableTextMode?: boolean;
    /** Streaming STT callbacks — when provided, recording data is also forwarded to streaming */
    onStreamStart?: () => void;
    onStreamData?: (data: Blob) => void;
    onStreamStop?: () => void;
}

export const RecordingBar = ({
    isUserTurn,
    isProcessing,
    isSessionActive,
    currentSpeakerName,
    onRecordingComplete,
    onTextSubmit,
    onEndSession,
    enableTextMode = true,
    onStreamStart,
    onStreamData,
    onStreamStop,
}: RecordingBarProps) => {
    const [isTextMode, setIsTextMode] = useState(false);
    const [textValue, setTextValue] = useState('');
    const [autoRecord, setAutoRecord] = useState(true);
    const prevIsUserTurnRef = useRef(false);
    // Timing refs for text input mode
    const textFocusTimeRef = useRef<number | null>(null);   // t_recording_start: input 포커스 시점
    const textFirstKeyTimeRef = useRef<number | null>(null); // t_first_speech: 첫 키 입력 시점
    // Silence detection: track when silence started
    const silenceStartRef = useRef<number | null>(null);
    const lastDebugLogRef = useRef<number>(0);

    // isUserTurn이 true로 전환되면 텍스트 모드 타이밍 자동 시작
    useEffect(() => {
        if (isUserTurn && isTextMode) {
            // 사용자 턴 시작 = t_recording_start
            if (!textFocusTimeRef.current) {
                textFocusTimeRef.current = Date.now();
            }
        }
    }, [isUserTurn, isTextMode]);

    const recorder = useVoiceRecorder({
        onStop: (result) => {
            // Guard: don't send empty/too-short audio (causes STT 400 errors)
            if (result.blob.size < MIN_AUDIO_BYTES) {
                console.warn(`Audio too small (${result.blob.size} bytes), skipping send`);
                return;
            }
            // In streaming mode, send stop signal BEFORE processing recording blob
            // (matches Run0 VoiceRecorder options.onStop pattern)
            onStreamStop?.();
            onRecordingComplete(result.blob, result.t0UserEnd, result.tRecordingStart, result.tFirstSpeech ?? undefined);
        },
        onStart: onStreamStart,
        onDataAvailable: onStreamData,
    });

    // Auto-recording: start recording when it becomes user's turn
    useEffect(() => {
        if (
            autoRecord &&
            isUserTurn &&
            !prevIsUserTurnRef.current &&
            !recorder.isRecording &&
            !isProcessing &&
            !isTextMode
        ) {
            const timer = setTimeout(() => {
                recorder.startRecording();
            }, 300);
            return () => clearTimeout(timer);
        }
        prevIsUserTurnRef.current = isUserTurn;
    }, [isUserTurn, autoRecord, recorder.isRecording, isProcessing, isTextMode]);

    // Silence auto-stop: runs in BOTH manual and hands-free recording modes
    // (audioLevel updates every 100ms from useVoiceRecorder)
    useEffect(() => {
        if (!recorder.isRecording || recorder.isPaused) {
            silenceStartRef.current = null;
            return;
        }

        // Don't activate silence detection until minimum recording time
        if (recorder.duration < MIN_RECORD_SEC) {
            silenceStartRef.current = null;
            return;
        }

        const now = Date.now();
        // Debug log every 2s
        if (now - lastDebugLogRef.current > DEBUG_LOG_INTERVAL) {
            const silenceElapsed = silenceStartRef.current
                ? ((now - silenceStartRef.current) / 1000).toFixed(1)
                : '0';
            console.log(`[VoiceDetect] level=${recorder.audioLevel.toFixed(4)} threshold=${VOICE_THRESHOLD} silence=${silenceElapsed}s/${SILENCE_TIMEOUT_SEC}s dur=${recorder.duration.toFixed(1)}s`);
            lastDebugLogRef.current = now;
        }

        if (recorder.audioLevel < VOICE_THRESHOLD) {
            // Voice-band energy below threshold — consider silence
            if (!silenceStartRef.current) {
                silenceStartRef.current = now;
            } else {
                const silenceDuration = (now - silenceStartRef.current) / 1000;
                if (silenceDuration >= SILENCE_TIMEOUT_SEC) {
                    console.log(`[HandsFree] Auto-stopping after ${SILENCE_TIMEOUT_SEC}s silence (voice level: ${recorder.audioLevel.toFixed(4)})`);
                    recorder.stopRecording();
                    silenceStartRef.current = null;
                }
            }
        } else {
            // Voice detected — reset silence timer
            silenceStartRef.current = null;
        }
    }, [recorder.isRecording, recorder.isPaused, recorder.audioLevel, recorder.duration]);

    const handleTextSubmit = () => {
        if (!textValue.trim() || !onTextSubmit) return;
        const t0 = Date.now();
        // fallback: 포커스 시점이 없으면 제출 2초 전으로 추정
        const recStart = textFocusTimeRef.current ?? (t0 - 2000);
        // fallback: 첫 키 없으면 포커스 직후로 추정
        const firstKey = textFirstKeyTimeRef.current ?? (recStart + 100);
        onTextSubmit(
            textValue.trim(),
            t0,              // t0_user_end: 제출 시점
            undefined,       // t1_server_final: 해당 없음
            recStart,        // t_recording_start
            firstKey,        // t_first_speech
        );
        setTextValue('');
        // 다음 턴을 위해 리셋
        textFocusTimeRef.current = null;
        textFirstKeyTimeRef.current = null;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // 첫 키 입력 시점 기록 (t_first_speech 대용)
        if (!textFirstKeyTimeRef.current && e.key !== 'Enter') {
            textFirstKeyTimeRef.current = Date.now();
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit();
        }
    };

    // Status message
    const getStatusMessage = () => {
        if (isProcessing) return 'Processing...';
        if (recorder.isPaused) return `⏸ Paused ${recorder.formattedDuration} / ${recorder.formatDuration(recorder.maxDuration)}`;
        if (recorder.isRecording) return `Recording ${recorder.formattedDuration} / ${recorder.formatDuration(recorder.maxDuration)}`;
        if (isUserTurn) return 'Your Turn! 🎤';
        if (currentSpeakerName) return `${currentSpeakerName} is speaking...`;
        return 'Waiting...';
    };

    const statusColor = isUserTurn
        ? recorder.isPaused
            ? 'text-yellow-400'
            : 'text-emerald-400'
        : recorder.isRecording
            ? 'text-destructive'
            : 'text-muted-foreground';

    if (!isSessionActive) return null;

    return (
        <div className="shrink-0 border-t border-border/50 bg-card/80 backdrop-blur-xl">
            {/* Pause hint — shown only when recording */}
            {recorder.isRecording && !recorder.isPaused && (
                <div className="text-center py-1 text-[10px] text-muted-foreground/60">
                    💡 생각할 시간이 필요하면 일시정지를 누르세요
                </div>
            )}

            {/* Status text */}
            <div className={cn('text-center text-xs font-medium py-1.5', statusColor)}>
                {getStatusMessage()}
            </div>

            {/* Action row */}
            <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-1">
                {isTextMode ? (
                    /* ── Text Input Mode ── */
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <button
                            onClick={() => setIsTextMode(false)}
                            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                            <Mic className="h-5 w-5" />
                        </button>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={textValue}
                                onFocus={() => {
                                    // t_recording_start: input에 포커스된 시점
                                    if (!textFocusTimeRef.current) {
                                        textFocusTimeRef.current = Date.now();
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                onChange={(e) => {
                                    setTextValue(e.target.value);
                                    // 첫 키 입력 시점 캡쳐 (한글 IME 등 onKeyDown 누락 대비)
                                    if (!textFirstKeyTimeRef.current && e.target.value.length > 0) {
                                        textFirstKeyTimeRef.current = Date.now();
                                    }
                                }}
                                placeholder="Type your response..."
                                disabled={!isUserTurn || isProcessing}
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-full text-sm',
                                    'bg-muted/50 border border-border/50',
                                    'placeholder:text-muted-foreground/40',
                                    'focus:outline-none focus:ring-2 focus:ring-secondary/40',
                                    'disabled:opacity-40'
                                )}
                            />
                        </div>
                        <Button
                            size="icon"
                            variant="default"
                            className="rounded-full h-10 w-10 bg-secondary hover:bg-secondary/80"
                            onClick={handleTextSubmit}
                            disabled={!textValue.trim() || !isUserTurn || isProcessing}
                        >
                            <svg className="h-4 w-4 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </Button>
                    </div>
                ) : (
                    /* ── Voice Mode ── */
                    <>
                        {/* Left: Pause / Resume */}
                        <div className="flex flex-col items-center gap-0.5">
                            <button
                                onClick={() => {
                                    if (recorder.isPaused) {
                                        console.log(`[RecordingBar] Resume at ${recorder.formattedDuration}`);
                                        recorder.resumeRecording();
                                    } else if (recorder.isRecording) {
                                        console.log(`[RecordingBar] Pause at ${recorder.formattedDuration}`);
                                        recorder.pauseRecording();
                                    }
                                }}
                                disabled={!recorder.isRecording}
                                className={cn(
                                    'p-3 rounded-full transition-all',
                                    recorder.isRecording
                                        ? recorder.isPaused
                                            ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 animate-pulse'
                                            : 'text-foreground bg-muted/50 hover:bg-muted'
                                        : 'text-muted-foreground/30'
                                )}
                            >
                                {recorder.isPaused ? (
                                    <Play className="h-5 w-5" />
                                ) : (
                                    <Pause className="h-5 w-5" />
                                )}
                            </button>
                        </div>

                        {/* Center: Main mic button */}
                        <div className="relative">
                            {recorder.isRecording && !recorder.isPaused && (
                                <div className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" />
                            )}
                            {isUserTurn && !recorder.isRecording && !isProcessing && (
                                <div className="absolute -inset-1 rounded-full bg-emerald-500/20 animate-pulse" />
                            )}
                            <Button
                                size="icon"
                                variant={recorder.isRecording ? 'destructive' : 'default'}
                                className={cn(
                                    'relative rounded-full h-14 w-14 transition-all shadow-lg',
                                    recorder.isRecording
                                        ? 'bg-destructive hover:bg-destructive/80 shadow-destructive/30'
                                        : isUserTurn
                                            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 text-white'
                                            : 'bg-muted hover:bg-muted'
                                )}
                                onClick={() => {
                                    if (recorder.isRecording) {
                                        recorder.stopRecording();
                                    } else {
                                        recorder.startRecording();
                                    }
                                }}
                                disabled={!isUserTurn || isProcessing}
                            >
                                {isProcessing ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : recorder.isRecording ? (
                                    <Square className="h-5 w-5" />
                                ) : (
                                    <Mic className="h-6 w-6" />
                                )}
                            </Button>
                        </div>

                        {/* Right: Text mode + Auto-record toggles with labels */}
                        <div className="flex flex-col items-center gap-1.5">
                            {enableTextMode && (
                                <button
                                    onClick={() => {
                                        // When switching to text mode, disable auto-record
                                        // so silence auto-stop stops immediately
                                        if (autoRecord) {
                                            console.log('[RecordingBar] Switching to text mode — disabling auto-record');
                                            setAutoRecord(false);
                                        }
                                        setIsTextMode(true);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all"
                                >
                                    <Keyboard className="h-3.5 w-3.5" />
                                    <span className="text-[10px]">텍스트</span>
                                </button>
                            )}
                            <button
                                onClick={() => setAutoRecord(!autoRecord)}
                                className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-full transition-all',
                                    autoRecord
                                        ? 'text-emerald-400 bg-emerald-400/10'
                                        : 'text-muted-foreground/40 hover:text-muted-foreground/60'
                                )}
                                title={autoRecord ? '핸즈프리 ON' : '핸즈프리 OFF'}
                            >
                                <Radio className="h-3.5 w-3.5" />
                                <span className="text-[10px]">{autoRecord ? '자동' : '수동'}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Paused indicator */}
            {recorder.isPaused && (
                <div className="text-center pb-2 text-xs text-yellow-400">
                    ⏸ 일시정지됨 — Play를 눌러 재개
                </div>
            )}
        </div>
    );
};
