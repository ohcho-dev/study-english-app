'use client';

/**
 * FeedbackCard Component
 *
 * Displays grammar corrections and better expression suggestions
 * inline below user messages in the TranscriptTimeline.
 * Collapsible, mobile-responsive, education-focused design.
 */

import { useState } from 'react';
import { ChevronDown, Pen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackCardProps {
    corrections?: string[];
    betterExpressions?: string[];
}

/** Parse various formats into { before, after } for display.
 *  Supports: "wrong → right", "wrong → right (Tier)", JSON object strings, plain text */
const parseItem = (s: string): { before: string; after: string } | null => {
    // Try JSON object format (LLM sometimes returns structured objects)
    if (s.startsWith('{')) {
        try {
            const obj = JSON.parse(s);
            // Correction: {"original": "...", "corrected": "..."}
            if (obj.original && obj.corrected) {
                return { before: obj.original, after: obj.corrected };
            }
            // Expression upgrade: {"original": "...", "upgraded": "...", "tier": "..."}
            if (obj.original && obj.upgraded) {
                const tier = obj.tier ? ` (${obj.tier})` : '';
                return { before: obj.original, after: `${obj.upgraded}${tier}` };
            }
            // Response hint: {"hint": "...", "example": "...", "tier": "..."}
            if (obj.hint && (obj.example || obj.example_response)) {
                const example = obj.example || obj.example_response;
                const tier = obj.tier ? ` (${obj.tier})` : '';
                return { before: obj.hint, after: `${example}${tier}` };
            }
        } catch { /* not valid JSON, fall through */ }
    }

    // Arrow format: "wrong → right"
    const idx = s.indexOf('→');
    if (idx !== -1) {
        return {
            before: s.slice(0, idx).trim(),
            after: s.slice(idx + 1).trim(),
        };
    }

    return null;
};

export const FeedbackCard = ({ corrections, betterExpressions }: FeedbackCardProps) => {
    const hasCorrections = corrections && corrections.length > 0;
    const hasBetter = betterExpressions && betterExpressions.length > 0;

    if (!hasCorrections && !hasBetter) return null;

    const [isOpen, setIsOpen] = useState(true);

    const totalCount = (corrections?.length ?? 0) + (betterExpressions?.length ?? 0);

    return (
        <div className={cn(
            'ml-0 mt-1 mb-1 rounded-lg overflow-hidden',
            'border border-border/40',
            'bg-card/40 backdrop-blur-sm',
            'transition-all duration-300 ease-out',
        )}>
            {/* Toggle Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5',
                    'text-xs text-muted-foreground hover:text-foreground/80',
                    'transition-colors duration-150',
                )}
            >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="font-medium truncate">
                        표현 피드백
                        <span className="ml-1 text-muted-foreground/60">{totalCount}</span>
                    </span>
                </div>
                <ChevronDown className={cn(
                    'h-3 w-3 shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-180',
                )} />
            </button>

            {/* Collapsible Body */}
            <div className={cn(
                'grid transition-all duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}>
                <div className="overflow-hidden">
                    <div className="px-3 pb-2.5 space-y-2">
                        {/* Corrections Section */}
                        {hasCorrections && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Pen className="h-2.5 w-2.5 text-rose-400" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400/80">
                                        교정
                                    </span>
                                </div>
                                <div className="space-y-0.5">
                                    {corrections.map((c, i) => {
                                        const parsed = parseItem(c);
                                        return (
                                            <div key={i} className="text-xs leading-relaxed pl-4">
                                                {parsed ? (
                                                    <>
                                                        <span className="text-rose-400/90 line-through decoration-rose-400/40">
                                                            {parsed.before}
                                                        </span>
                                                        <span className="text-muted-foreground/50 mx-1.5">→</span>
                                                        <span className="text-emerald-400 font-medium">
                                                            {parsed.after}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-foreground/70">{c}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Better Expressions Section */}
                        {hasBetter && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                                        추천 표현
                                    </span>
                                </div>
                                <div className="space-y-0.5">
                                    {betterExpressions.map((b, i) => {
                                        const parsed = parseItem(b);
                                        return (
                                            <div key={i} className="text-xs leading-relaxed pl-4">
                                                {parsed ? (
                                                    <>
                                                        <span className="text-muted-foreground/70">
                                                            {parsed.before}
                                                        </span>
                                                        <span className="text-muted-foreground/50 mx-1.5">→</span>
                                                        <span className="text-amber-300 font-medium">
                                                            {parsed.after}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-amber-300/90">{b}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
