'use client';

/**
 * TranscriptTimeline Component
 * 
 * Displays full conversation history as a subtitle-style timeline.
 * All participants' speech is visible (including AI-to-AI).
 * Each entry has a translation toggle for Korean translation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../model/useMyTurn';
import type { FeedbackCardType } from '../model/types';
import { FeedbackCard } from './FeedbackCard';
import { DetailedFeedbackCard } from './DetailedFeedbackCard';
import { EnergyFlowCard } from './EnergyFlowCard';

interface TranscriptTimelineProps {
    messages: ChatMessage[];
    currentSpeaker?: { name: string } | null;
    isProcessing?: boolean;
    feedbackCardType?: FeedbackCardType;
}

/** Per-message translation cache */
const translationCache = new Map<string, string>();

interface TranscriptEntryProps {
    message: ChatMessage;
    /** Feedback data from the preceding user message (shown below moderator messages) */
    pendingFeedback?: { corrections?: string[]; betterExpressions?: string[] } | null;
    feedbackCardType?: FeedbackCardType;
}

const TranscriptEntry = ({ message, pendingFeedback, feedbackCardType }: TranscriptEntryProps) => {
    const [showTranslation, setShowTranslation] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    const handleTranslate = useCallback(async () => {
        if (showTranslation) {
            setShowTranslation(false);
            return;
        }

        // Check cache first
        const cached = translationCache.get(message.id);
        if (cached) {
            setTranslation(cached);
            setShowTranslation(true);
            return;
        }

        setIsTranslating(true);
        setShowTranslation(true);

        try {
            // Use server translation API
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/v1/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: message.text,
                    target_language: 'ko',
                }),
            });

            if (res.ok) {
                const data = await res.json();
                const translated = data.translated_text || message.text;
                translationCache.set(message.id, translated);
                setTranslation(translated);
            } else {
                setTranslation('번역을 불러올 수 없습니다.');
            }
        } catch {
            setTranslation('번역 오류가 발생했습니다.');
        } finally {
            setIsTranslating(false);
        }
    }, [message.id, message.text, showTranslation]);

    const isInterim = message.id === '__streaming_interim__';
    const isStreamingFinal = message.id === '__streaming_final__';
    const isStreamingMsg = isInterim || isStreamingFinal;

    const speakerColor = isInterim
        ? 'text-amber-400'
        : message.isUser
            ? 'text-emerald-400'
            : 'text-blue-400';

    return (
        <div className={cn(
            "group px-4 py-2 hover:bg-card/30 transition-colors rounded-lg",
        )}>
            {/* Main message row */}
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <span className={cn('text-xs font-semibold', speakerColor)}>
                        {message.speaker}:
                    </span>
                    <span className={cn(
                        "text-sm ml-1.5 leading-relaxed transition-all duration-200",
                        isInterim
                            ? "text-foreground/50 italic"
                            : isStreamingFinal
                                ? "text-foreground/80"
                                : "text-foreground/90"
                    )}>
                        {message.text}
                    </span>
                </div>

                {/* Translation toggle (hide for streaming messages) */}
                {!isStreamingMsg && (
                    <button
                        onClick={handleTranslate}
                        className={cn(
                            'flex-shrink-0 p-1 rounded-md transition-all mt-0.5',
                            'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50',
                            'sm:opacity-0 sm:group-hover:opacity-100',
                            showTranslation && 'text-secondary opacity-100 sm:opacity-100'
                        )}
                        aria-label="번역 보기"
                    >
                        <Languages className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* Translation row */}
            {showTranslation && (
                <div className="mt-1 ml-0 pl-3 border-l-2 border-secondary/30">
                    {isTranslating ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            번역 중...
                        </div>
                    ) : (
                        <p className="text-xs text-secondary/80 leading-relaxed">
                            {translation}
                        </p>
                    )}
                </div>
            )}

            {/* Pipeline data shown below user messages (evaluator/planner, when available) */}
            {message.isUser && (message.evaluatorData || message.plannerData) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                    {message.evaluatorData?.overall_score != null && (
                        <span className={cn(
                            "px-1.5 py-0.5 rounded-full font-medium",
                            message.evaluatorData.overall_score >= 80
                                ? "bg-emerald-500/15 text-emerald-400"
                                : message.evaluatorData.overall_score >= 50
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-red-500/15 text-red-400"
                        )}>
                            Score {message.evaluatorData.overall_score}
                        </span>
                    )}
                    {message.evaluatorData?.wpm != null && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                            {message.evaluatorData.wpm} WPM
                        </span>
                    )}
                    {message.plannerData?.current_level != null && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
                            Lv.{message.plannerData.current_level}
                        </span>
                    )}
                    {message.plannerData?.path && message.plannerData.path !== 'LEVEL_HOLD' && (
                        <span className={cn(
                            "px-1.5 py-0.5 rounded-full font-medium",
                            message.plannerData.path === 'LEVEL_UP'
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                        )}>
                            {message.plannerData.path === 'LEVEL_UP' ? '↑ UP' : '↓ DOWN'}
                        </span>
                    )}
                    {message.evaluatorData?.primary_issue && message.evaluatorData.primary_issue !== 'NONE' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">
                            {message.evaluatorData.primary_issue}
                        </span>
                    )}
                    {message.evaluatorData?.recommended_action && message.evaluatorData.recommended_action !== 'CONTINUE' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400">
                            {message.evaluatorData.recommended_action}
                        </span>
                    )}
                    {/* Engine trace: extra fields from evaluator */}
                    {message.evaluatorData?.engine_trace && Object.entries(message.evaluatorData.engine_trace).map(([key, value]) => (
                        <span key={`eval-${key}`} className="px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400">
                            {key}: {String(value)}
                        </span>
                    ))}
                    {/* Engine trace: extra fields from planner */}
                    {message.plannerData?.engine_trace && Object.entries(message.plannerData.engine_trace).map(([key, value]) => (
                        <span key={`plan-${key}`} className="px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
                            {key}: {String(value)}
                        </span>
                    ))}
                </div>
            )}

            {/* Energy flow card shown below user messages (parallel API, appears first) */}
            {message.isUser && (message.energyFlowLoading || message.energyFlow) && (
                <EnergyFlowCard
                    data={message.energyFlow!}
                    isLoading={message.energyFlowLoading}
                />
            )}

            {/* Feedback card shown below moderator message (data from preceding user message) */}
            {pendingFeedback && (
                feedbackCardType === 'detailed' ? (
                    <DetailedFeedbackCard
                        corrections={pendingFeedback.corrections}
                        betterExpressions={pendingFeedback.betterExpressions}
                    />
                ) : (
                    <FeedbackCard
                        corrections={pendingFeedback.corrections}
                        betterExpressions={pendingFeedback.betterExpressions}
                    />
                )
            )}
        </div>
    );
};

/** Typing indicator for AI processing */
const TypingIndicator = ({ speakerName }: { speakerName: string }) => (
    <div className="px-4 py-2">
        <span className="text-xs font-semibold text-blue-400">{speakerName}:</span>
        <span className="inline-flex items-center gap-0.5 ml-2">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </span>
    </div>
);

export const TranscriptTimeline = ({
    messages,
    currentSpeaker,
    isProcessing,
    feedbackCardType,
}: TranscriptTimelineProps) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    return (
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
                    대화가 시작되면 여기에 표시됩니다
                </div>
            ) : (
                <div className="py-2 space-y-0.5">
                    {messages.map((msg, idx) => {
                        // Show feedback below the first AI message that follows a user message with feedback
                        let pendingFeedback: { corrections?: string[]; betterExpressions?: string[] } | null = null;
                        if (!msg.isUser && idx > 0) {
                            const prev = messages[idx - 1];
                            if (prev.isUser && (prev.corrections?.length || prev.betterExpressions?.length)) {
                                pendingFeedback = {
                                    corrections: prev.corrections,
                                    betterExpressions: prev.betterExpressions,
                                };
                            }
                        }
                        return (
                            <TranscriptEntry key={msg.id} message={msg} pendingFeedback={pendingFeedback} feedbackCardType={feedbackCardType} />
                        );
                    })}

                    {/* Typing indicator when AI is composing */}
                    {currentSpeaker && isProcessing && (
                        <TypingIndicator speakerName={currentSpeaker.name} />
                    )}

                    <div ref={bottomRef} />
                </div>
            )}
        </div>
    );
};
