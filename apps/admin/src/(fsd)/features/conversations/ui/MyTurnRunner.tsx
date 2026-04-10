'use client';

/**
 * MyTurnRunner Component - Chat Panel for "My Turn" conversation
 * 
 * Renders: speaker status bar + chat history + mic recorder.
 * No longer manages full-page layout — that's done by page.tsx.
 */

import { useEffect, useRef } from 'react';
import { Mic, PhoneOff, Wifi, WifiOff } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';

import { useMyTurn } from '../model/useMyTurn';
import type { Template } from '../model/types';
import { VoiceRecorder } from './VoiceRecorder';

interface MyTurnRunnerProps {
    template: Template;
    sessionId: string;
    onStatusChange?: (isRunning: boolean) => void;
    onSessionEnd?: () => void;
    onSpeakerChange?: (speakerId: string | null) => void;
    isEnded?: boolean;
}

export const MyTurnRunner = ({ template, sessionId, onStatusChange, onSessionEnd, onSpeakerChange, isEnded = false }: MyTurnRunnerProps) => {

    const {
        isConnected,
        isSessionActive,
        error,
        connect,
        disconnect,
        startSession,
        sendAudio,
        currentSpeaker,
        isUserTurn,
        aiResponse,
        transcript,
        isProcessing,
        endSession,
        chatHistory
    } = useMyTurn(sessionId);

    const chatBottomRef = useRef<HTMLDivElement>(null);

    const allParticipants = template.participants || [];
    const aiParticipants = allParticipants.filter(p => p.participant_type !== 'user');
    const userParticipant = allParticipants.find(p => p.participant_type === 'user');

    // Auto-connect and start session
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
            startSession('User');
        }
    }, [isConnected, isSessionActive, startSession]);

    useEffect(() => {
        onStatusChange?.(isSessionActive);
    }, [isSessionActive, onStatusChange]);

    // Notify parent of speaker changes
    useEffect(() => {
        onSpeakerChange?.(currentSpeaker?.id || null);
    }, [currentSpeaker, onSpeakerChange]);

    // Auto-scroll chat
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, aiResponse]);

    const handleEnd = async () => {
        await endSession();
        onSessionEnd?.();
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg bg-card/30 overflow-hidden">

            {/* ── Speaker Status Bar ── */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
                {/* Connection indicator */}
                <div className="flex items-center gap-1.5 mr-2">
                    {isConnected ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-success/50 text-success">
                            <Wifi className="h-3 w-3" />
                            연결됨
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 border-destructive/50 text-destructive">
                            <WifiOff className="h-3 w-3" />
                            연결 중...
                        </Badge>
                    )}
                </div>

                {/* Participant pills */}
                <div className="flex items-center gap-2 flex-1">
                    {aiParticipants.map((p) => {
                        const isSpeaking = currentSpeaker?.id === p.id;
                        return (
                            <div
                                key={p.id}
                                className={`
                                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                                    transition-all duration-300
                                    ${isSpeaking
                                        ? 'bg-primary/15 text-primary ring-1 ring-primary/40 shadow-sm'
                                        : 'bg-muted/50 text-muted-foreground'
                                    }
                                `}
                            >
                                {/* Avatar initial */}
                                <span className={`
                                    flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                                    ${isSpeaking ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}
                                `}>
                                    {p.name[0]}
                                </span>
                                <span className="font-medium whitespace-nowrap">{p.name}</span>
                                {isSpeaking && (
                                    <div className="flex items-center gap-0.5 ml-0.5">
                                        <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
                                        <div className="w-1 h-3 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
                                        <div className="w-1 h-2 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* User pill */}
                    <div className={`
                        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                        transition-all duration-300
                        ${isUserTurn
                            ? 'bg-success/15 text-success ring-1 ring-success/40 shadow-sm'
                            : 'bg-muted/50 text-muted-foreground'
                        }
                    `}>
                        <span className={`
                            flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                            ${isUserTurn ? 'bg-success text-success-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}
                        `}>
                            나
                        </span>
                        <span className="font-medium">Me</span>
                        {isUserTurn && (
                            <Mic className="h-3 w-3 text-success animate-pulse" />
                        )}
                    </div>
                </div>

                {error && <Badge variant="destructive" className="text-[10px]">{error}</Badge>}
            </div>

            {/* ── Chat Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
                {chatHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        대화가 시작되면 여기에 내용이 표시됩니다.
                    </div>
                ) : (
                    chatHistory.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
                        >
                            {/* Speaker name */}
                            <div className="flex items-center gap-1.5 mb-1">
                                {!msg.isUser && (
                                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                                        {msg.speaker[0]}
                                    </span>
                                )}
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    {msg.speaker}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>
                            {/* Bubble */}
                            <div
                                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${msg.isUser
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'bg-card border border-border rounded-tl-sm'
                                    }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}

                {/* Typing indicator when AI is responding */}
                {currentSpeaker && !isUserTurn && !aiResponse && (
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                                {currentSpeaker.name[0]}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">
                                {currentSpeaker.name}
                            </span>
                        </div>
                        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={chatBottomRef} />
            </div>

            {/* ── Footer: Mic + Status ── */}
            <div className="shrink-0 border-t border-border bg-card/50 px-4 py-3">
                {isEnded ? (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <PhoneOff className="h-4 w-4" />
                        <p className="text-sm">세션이 종료되었습니다. 새 세션을 시작하세요.</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        {/* Voice Recorder */}
                        <div className="relative">
                            <VoiceRecorder
                                onRecordingComplete={(blob, t0UserEnd, _dur, tRecStart, tFirstSp) => sendAudio(blob, t0UserEnd, tRecStart, tFirstSp)}
                                disabled={!isUserTurn || isProcessing}
                                size="sm"
                                showAudioLevel={false}
                                showDuration={false}
                            />
                        </div>

                        {/* Status text */}
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${isUserTurn ? 'text-success' : 'text-muted-foreground'}`}>
                                {isProcessing
                                    ? '답변 전송 중...'
                                    : isUserTurn
                                        ? '🎤 당신의 차례입니다! 마이크를 눌러 말씀해주세요.'
                                        : currentSpeaker
                                            ? `${currentSpeaker.name}님이 말하는 중...`
                                            : '대기 중...'}
                            </p>
                        </div>

                        {/* End session button (small) */}
                        {isSessionActive && (
                            <button
                                onClick={handleEnd}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <PhoneOff className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
