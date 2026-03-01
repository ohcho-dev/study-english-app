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
}

export const ConversationStage = ({
    template,
    sessionId,
    onSessionEnd,
    onSpeakerChange,
    isEnded = false,
    userName = 'User',
    sessionConfig,
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
    } = useMyTurn(sessionId);

    const streamingSTT = useStreamingSTT();

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

        // Send transcript to server (async — response will add to chatHistory)
        sendText(transcript);
        setRecordingStopTime(null);

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

    const handleRecordingComplete = useCallback((blob: Blob, t0UserEnd: number) => {
        if (isStreamingMode) {
            // Streaming mode: record stop time and wait for transcript
            // (sendStop is already called by RecordingBar's internal onStreamStop)
            console.log('[ConversationStage] Recording stopped (streaming mode), waiting for transcript...');
            setRecordingStopTime(t0UserEnd);
        } else {
            // Sync mode: send audio blob directly
            sendAudio(blob, t0UserEnd);
        }
    }, [isStreamingMode, sendAudio]);

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
                />
            )}
        </div>
    );
};
