'use client';

/**
 * ConversationStage Component
 * 
 * Main immersive view for My Turn conversation.
 * Combines: ParticipantCircle + TranscriptTimeline + RecordingBar.
 * Mobile-first, full-screen app-like experience.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

import { useMyTurn } from '../model/useMyTurn';
import type { Template } from '../model/types';
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
}

export const ConversationStage = ({
    template,
    sessionId,
    onSessionEnd,
    onSpeakerChange,
    isEnded = false,
    userName = 'User',
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

    const handleEnd = async () => {
        await endSession();
        onSessionEnd?.();
    };

    const handleRecordingComplete = (blob: Blob, t0UserEnd: number) => {
        sendAudio(blob, t0UserEnd);
    };

    const participants = template.participants || [];

    // Determine if AI is "thinking" (current speaker is AI and no response yet)
    const isAiThinking = !!currentSpeaker && !isUserTurn && !aiResponse && isProcessing;

    return (
        <div
            className={cn(
                'flex flex-col h-full bg-background relative overflow-hidden',
                // Green ambient glow when it's user's turn
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
                /* Session Ended State */
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
                    messages={chatHistory}
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
                />
            )}
        </div>
    );
};
