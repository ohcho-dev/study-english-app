'use client';

/**
 * ConversationStage Component
 * 
 * Main immersive view for My Turn conversation.
 * Combines: ParticipantCircle + TranscriptTimeline + RecordingBar.
 * Mobile-first, full-screen app-like experience.
 * 
 * Supports both sync and streaming STT modes based on session config.
 * Streaming pattern mirrors Run0Runner for consistency.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

import { useMyTurn, type ChatMessage } from '../model/useMyTurn';
import { useStreamingSTT } from '../model/useStreamingSTT';
import type { Template } from '../model/types';
import type { SessionConfig } from './SettingsDrawer';
import { ParticipantCircle } from './ParticipantCircle';
import { TranscriptTimeline } from './TranscriptTimeline';
import { RecordingBar } from './RecordingBar';

interface ConversationStageProps {
    template: Template;
    sessionId: string;
    onSessionEnd?: () => void;
    onSpeakerChange?: (speakerId: string | null) => void;
    isEnded?: boolean;
    userName?: string;
    /** Session config with per-participant settings (stt_mode, etc.) */
    sessionConfig?: SessionConfig;
    /** Whether to display response timing stats (admins only) */
    showResponseStats?: boolean;
}

export const ConversationStage = ({
    template,
    sessionId,
    onSessionEnd,
    onSpeakerChange,
    isEnded = false,
    userName = 'User',
    sessionConfig,
    showResponseStats = false,
}: ConversationStageProps) => {
    const {
        isConnected,
        isSessionActive,
        error,
        connect,
        disconnect,
        startSession,
        sendAudio,
        sendText,
        currentSpeaker,
        isUserTurn,
        aiResponse,
        isProcessing,
        endSession,
        chatHistory,
    } = useMyTurn(sessionId, { energyFlowEnabled: template.energy_flow_enabled });

    const streamingSTT = useStreamingSTT();

    const responseTrackingEnabled = showResponseStats;

    const [responseStats, setResponseStats] = useState({
        first: null as number | null,
        last: null as number | null,
        avg: null as number | null,
        count: 0,
        total: 0,
    });
    const lastPreviewStartRef = useRef<number | null>(null);

    const resetResponseStats = useCallback(() => {
        setResponseStats({ first: null, last: null, avg: null, count: 0, total: 0 });
    }, []);

    useEffect(() => {
        if (!responseTrackingEnabled) {
            lastPreviewStartRef.current = null;
            return;
        }
        resetResponseStats();
        lastPreviewStartRef.current = null;
    }, [sessionId, resetResponseStats, responseTrackingEnabled]);

    const updateResponseStats = useCallback((tRecordingStart?: number | null, tFirstSpeech?: number | null) => {
        if (!responseTrackingEnabled) return;
        if (!tRecordingStart || !tFirstSpeech || tFirstSpeech < tRecordingStart) return;
        const intervalSec = Number(((tFirstSpeech - tRecordingStart) / 1000).toFixed(2));
        if (Number.isNaN(intervalSec) || intervalSec < 0) return;
        setResponseStats((prev) => {
            const nextCount = prev.count + 1;
            const nextTotal = prev.total + intervalSec;
            const avg = Number((nextTotal / nextCount).toFixed(2));
            return {
                first: prev.first ?? intervalSec,
                last: intervalSec,
                avg,
                count: nextCount,
                total: nextTotal,
            };
        });
    }, [responseTrackingEnabled]);

    const handleResponsePreview = useCallback((tRecordingStart: number, tFirstSpeech: number) => {
        if (!responseTrackingEnabled) return;
        lastPreviewStartRef.current = tRecordingStart;
        updateResponseStats(tRecordingStart, tFirstSpeech);
    }, [updateResponseStats, responseTrackingEnabled]);

    // Determine STT settings from the user participant's config
    const userSttConfig = useMemo(() => {
        if (!sessionConfig || !template?.participants) {
            return { mode: 'streaming' as const, display: 'immediate' as const, model: 'chirp_3' };
        }
        const userParticipant = template.participants.find(p => p.participant_type === 'user');
        if (!userParticipant) {
            return { mode: 'streaming' as const, display: 'immediate' as const, model: 'chirp_3' };
        }
        const pConfig = sessionConfig.participants[userParticipant.id];
        return {
            mode: (pConfig?.stt_mode || 'streaming') as 'sync' | 'streaming',
            display: (pConfig?.stt_streaming_display || 'immediate') as 'immediate' | 'final',
            model: pConfig?.stt_model || 'chirp_3',
        };
    }, [sessionConfig, template?.participants]);

    const isStreamingMode = userSttConfig.mode === 'streaming';
    const showImmediate = userSttConfig.display === 'immediate';

    // ── Streaming STT state (mirrors Run0Runner pattern) ──
    const [recordingStopTime, setRecordingStopTime] = useState<number | null>(null);
    const recordingStartTimeRef = useRef<number | null>(null);
    const firstSpeechTimeRef = useRef<number | null>(null);
    const streamingProcessedRef = useRef(false); // Guard against double-processing

    // ── Inline interim message for TranscriptTimeline ──
    // This stays stable (same id) so the DOM doesn't flicker.
    // Only the text content and `isInterim` flag change.
    const [streamingText, setStreamingText] = useState<string>('');
    const [streamingIsFinal, setStreamingIsFinal] = useState(false);
    const [showStreamingMessage, setShowStreamingMessage] = useState(false);

    // Auto-connect
    useEffect(() => {
        if (sessionId) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [sessionId, connect, disconnect]);

    // Auto-start session once connected
    useEffect(() => {
        if (isConnected && !isSessionActive) {
            startSession(userName);
        }
    }, [isConnected, isSessionActive, startSession, userName]);

    // Notify parent of speaker changes
    useEffect(() => {
        onSpeakerChange?.(currentSpeaker?.id || null);
    }, [currentSpeaker, onSpeakerChange]);

    // ── Streaming STT: update inline text in real-time ──
    // Watch interimTranscript and finalTranscript to update inline display.
    // Key behavior:
    //   - "실시간 표시" mode: show interim text (amber italic), swap to final (emerald solid)
    //   - "확정 후 표시" mode: hide interim, show final text immediately on is_final
    useEffect(() => {
        if (!isStreamingMode) return;

        const hasInterim = !!streamingSTT.interimTranscript;
        const hasFinal = !!streamingSTT.finalTranscript;

        if (showImmediate) {
            // "실시간 표시" mode — show everything
            if (hasInterim || hasFinal) {
                // Build display text: accumulated finals + current interim
                const parts = [streamingSTT.finalTranscript, streamingSTT.interimTranscript].filter(Boolean);
                setStreamingText(parts.join(' '));
                setStreamingIsFinal(!hasInterim && hasFinal); // fully final only when no more interim
                setShowStreamingMessage(true);
            }
        } else {
            // "확정 후 표시" mode — only show when final arrives
            if (hasFinal) {
                setStreamingText(streamingSTT.finalTranscript);
                setStreamingIsFinal(true);
                setShowStreamingMessage(true);
            }
        }
    }, [isStreamingMode, showImmediate, streamingSTT.interimTranscript, streamingSTT.finalTranscript]);

    // ── Streaming STT: process result when done (mirrors Run0Runner) ──
    // IMPORTANT: Keep streaming message visible until sendText response arrives
    // to avoid the "processing..." gap where no text is shown.
    const streamingTranscriptRef = useRef<string>('');

    useEffect(() => {
        if (!isStreamingMode || !recordingStopTime || !streamingSTT.isDone) return;
        if (streamingProcessedRef.current) return; // Prevent duplicate

        // Combine accumulated finals + any remaining interim
        const transcript = [streamingSTT.finalTranscript, streamingSTT.interimTranscript]
            .filter(Boolean).join(' ').trim();
        if (!transcript) {
            setRecordingStopTime(null);
            setShowStreamingMessage(false);
            setStreamingText('');
            return;
        }

        streamingProcessedRef.current = true;
        streamingTranscriptRef.current = transcript;
        console.log('[ConversationStage] ✅ Streaming STT done, sending text:', transcript);

        // Keep showStreamingMessage=true so text stays visible during sendText processing!
        // Mark as final style
        setStreamingText(transcript);
        setStreamingIsFinal(true);
        setShowStreamingMessage(true);

        // Send transcript to server with timing (async — response will add to chatHistory)
        sendText(
            transcript,
            recordingStopTime || undefined,
            streamingSTT.serverFinalTimestamp || undefined,
            recordingStartTimeRef.current ?? undefined,
            firstSpeechTimeRef.current ?? undefined,
        );
        setRecordingStopTime(null);
        recordingStartTimeRef.current = null;
        firstSpeechTimeRef.current = null;

        // Reset streaming STT for next turn
        streamingSTT.disconnect();
    }, [isStreamingMode, recordingStopTime, streamingSTT.isDone,
        streamingSTT.finalTranscript, streamingSTT.interimTranscript,
        sendText, streamingSTT]);

    // ── Clear streaming message once the real chat message arrives in chatHistory ──
    // This prevents the gap between streaming text hide and sendText response.
    useEffect(() => {
        if (!showStreamingMessage || !streamingTranscriptRef.current) return;
        // Check if the latest user message in chatHistory matches our streaming transcript
        const lastUserMsg = [...chatHistory].reverse().find(m => m.isUser);
        if (lastUserMsg && lastUserMsg.text === streamingTranscriptRef.current) {
            setShowStreamingMessage(false);
            setStreamingText('');
            setStreamingIsFinal(false);
            streamingTranscriptRef.current = '';
        }
    }, [chatHistory, showStreamingMessage]);

    const handleEnd = async () => {
        await endSession();
        onSessionEnd?.();
    };

    const handleRecordingComplete = useCallback((blob: Blob, t0UserEnd: number, tRecordingStart?: number, tFirstSpeech?: number) => {
        if (responseTrackingEnabled) {
            const alreadyPreviewed = !!(tRecordingStart && lastPreviewStartRef.current === tRecordingStart);
            if (!alreadyPreviewed) {
                updateResponseStats(tRecordingStart, tFirstSpeech);
            }
            lastPreviewStartRef.current = null;
        }
        if (isStreamingMode) {
            // Streaming mode: save all timing, wait for transcript
            console.log(`[ConversationStage] Recording stopped (streaming), recStart=${tRecordingStart}, firstSpeech=${tFirstSpeech}`);
            setRecordingStopTime(t0UserEnd);
            recordingStartTimeRef.current = tRecordingStart ?? null;
            firstSpeechTimeRef.current = tFirstSpeech ?? null;
        } else {
            // Sync mode: send audio blob directly with timing data
            sendAudio(blob, t0UserEnd, tRecordingStart, tFirstSpeech);
        }
    }, [isStreamingMode, sendAudio, updateResponseStats, responseTrackingEnabled]);

    // Streaming STT callbacks for RecordingBar (matches Run0 VoiceRecorder pattern)
    const handleStreamStart = useCallback(() => {
        if (!isStreamingMode) return;
        console.log(`[ConversationStage] Starting streaming STT (model: ${userSttConfig.model})`);
        streamingProcessedRef.current = false; // Reset guard for new recording
        setShowStreamingMessage(false);
        setStreamingText('');
        setStreamingIsFinal(false);
        streamingSTT.connect({
            model: userSttConfig.model,
            language: 'en-US',
            interim_results: true,
        });
    }, [isStreamingMode, userSttConfig.model, streamingSTT]);

    const handleStreamData = useCallback((data: Blob) => {
        if (!isStreamingMode) return;
        streamingSTT.sendChunk(data);
    }, [isStreamingMode, streamingSTT]);

    const handleStreamStop = useCallback(() => {
        if (!isStreamingMode) return;
        // Send stop signal so server finishes gRPC and returns final result
        // (don't disconnect — wait for 'done' message)
        streamingSTT.sendStop();
    }, [isStreamingMode, streamingSTT]);

    const participants = template.participants || [];

    const formatSeconds = (value: number | null) => {
        if (value === null || Number.isNaN(value)) return '–';
        return `${value.toFixed(2)}s`;
    };

    // Determine if AI is "thinking"
    const isAiThinking = !!currentSpeaker && !isUserTurn && !aiResponse && isProcessing;

    // Build messages list including inline streaming transcript
    const displayMessages = useMemo(() => {
        if (!showStreamingMessage || !streamingText) return chatHistory;
        const streamingMsg: ChatMessage = {
            id: streamingIsFinal ? '__streaming_final__' : '__streaming_interim__',
            speaker: 'Me',
            text: streamingText,
            isUser: true,
            timestamp: Date.now(),
        };
        return [...chatHistory, streamingMsg];
    }, [chatHistory, showStreamingMessage, streamingText, streamingIsFinal]);

    return (
        <div
            className={cn(
                'flex flex-col h-full bg-background relative overflow-hidden',
                isUserTurn && !isEnded && 'ring-2 ring-emerald-500/20 ring-inset',
            )}
        >
            {/* ── Connection + Error Banner ── */}
            {!isConnected && (
                <div className="shrink-0 bg-destructive/10 text-destructive text-xs text-center py-1.5">
                    연결 중...
                </div>
            )}
            {error && (
                <div className="shrink-0 bg-destructive/10 text-destructive text-xs text-center py-1.5">
                    {error}
                </div>
            )}

            {/* ── Participant Avatars ── */}
            <div className="shrink-0 border-b border-border/30 bg-card/30 backdrop-blur-sm">
                <ParticipantCircle
                    participants={participants}
                    currentSpeakerId={currentSpeaker?.id || null}
                    isUserTurn={isUserTurn}
                    userName={userName}
                />
                {responseTrackingEnabled && (
                    <div className="px-4 pb-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
                        <div className="rounded-lg border border-border/30 bg-background/60 px-2 py-1.5">
                            <div className="text-xs font-semibold text-foreground">첫 응답</div>
                            <div className="text-base font-bold text-foreground">
                                {formatSeconds(responseStats.first)}
                            </div>
                            <div>첫 턴</div>
                        </div>
                        <div className="rounded-lg border border-border/30 bg-background/60 px-2 py-1.5">
                            <div className="text-xs font-semibold text-foreground">이번 턴</div>
                            <div className="text-base font-bold text-foreground">
                                {formatSeconds(responseStats.last)}
                            </div>
                            <div>현재</div>
                        </div>
                        <div className="rounded-lg border border-border/30 bg-background/60 px-2 py-1.5">
                            <div className="text-xs font-semibold text-foreground">평균</div>
                            <div className="text-base font-bold text-foreground">
                                {formatSeconds(responseStats.avg)}
                            </div>
                            <div>{responseStats.count > 0 ? `${responseStats.count}회` : '응답 없음'}</div>
                        </div>
                    </div>
                    </div>
                )}
            </div>

            {/* ── Transcript Timeline ── */}
            {isEnded ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                    <div className="text-4xl">🎉</div>
                    <h3 className="text-lg font-semibold text-foreground">세션 완료!</h3>
                    <p className="text-sm text-muted-foreground text-center">
                        총 {chatHistory.length}개의 대화가 진행되었습니다.
                    </p>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-2">
                        <div className="bg-card/50 rounded-xl p-3 text-center border border-border/30">
                            <div className="text-lg font-bold text-foreground">
                                {chatHistory.filter(m => m.isUser).length}
                            </div>
                            <div className="text-[10px] text-muted-foreground">내 발화</div>
                        </div>
                        <div className="bg-card/50 rounded-xl p-3 text-center border border-border/30">
                            <div className="text-lg font-bold text-foreground">
                                {chatHistory.filter(m => !m.isUser).length}
                            </div>
                            <div className="text-[10px] text-muted-foreground">AI 발화</div>
                        </div>
                    </div>
                </div>
            ) : (
                <TranscriptTimeline
                    messages={displayMessages}
                    currentSpeaker={currentSpeaker}
                    isProcessing={isAiThinking}
                    feedbackCardType={(template.feedback_card_type as 'default' | 'detailed') || 'default'}
                />
            )}

            {/* ── Bottom Recording Bar ── */}
            {!isEnded && (
                <RecordingBar
                    isUserTurn={isUserTurn}
                    isProcessing={isProcessing}
                    isSessionActive={isSessionActive}
                    currentSpeakerName={currentSpeaker?.name}
                    onRecordingComplete={handleRecordingComplete}
                    onTextSubmit={sendText}
                    onEndSession={handleEnd}
                    enableTextMode={true}
                    onStreamStart={isStreamingMode ? handleStreamStart : undefined}
                    onStreamData={isStreamingMode ? handleStreamData : undefined}
                    onStreamStop={isStreamingMode ? handleStreamStop : undefined}
                    onResponseIntervalPreview={responseTrackingEnabled ? handleResponsePreview : undefined}
                />
            )}
        </div>
    );
};
