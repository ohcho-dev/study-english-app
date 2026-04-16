'use client';

/**
 * DetailedFeedbackCard Component
 *
 * Enhanced feedback card with structured sections:
 * - Corrections (교정)
 * - Point: educational insight with Strip/Shift/Capture breakdown
 * - Natural Korean (이런 뜻이에요): fluent Korean equivalents
 * - Generic fallback for unrecognized formats
 *
 * Selectable per-template via feedback_card_type = "detailed".
 */

import { useState } from 'react';
import { ChevronDown, Pen, Sparkles, BookOpen, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetailedFeedbackCardProps {
    corrections?: string[];
    betterExpressions?: string[];
}

/* ── Typed parse results ── */

type ParsedGeneric = { kind: 'generic'; before: string; after: string };
type ParsedPoint = { kind: 'point'; hint: string; thought?: string; strip?: string; shift?: string; capture?: string };
type ParsedNaturalKo = { kind: 'natural-ko'; original: string; upgraded: string };
type ParsedItem = ParsedGeneric | ParsedPoint | ParsedNaturalKo;

/** Parse a single better_expression string into a typed result. */
const parseBetterExpression = (s: unknown): ParsedItem => {
    // Non-string values (e.g. objects from pipeline output) — serialize to display as generic
    if (typeof s !== 'string') {
        const text = typeof s === 'object' ? JSON.stringify(s) : String(s ?? '');
        const mid = text.length > 0 ? text : '(empty)';
        return { kind: 'generic', before: '', after: mid };
    }
    if (s.startsWith('{')) {
        try {
            const obj = JSON.parse(s);

            // Point: {hint, example, tier:"Point"} or {hint, example, tier:"EMF Point"}
            if (obj.hint && (obj.example || obj.example_response)) {
                const raw = typeof (obj.example || obj.example_response) === 'string'
                    ? (obj.example || obj.example_response)
                    : '';
                const lines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean);

                const result: ParsedPoint = { kind: 'point', hint: obj.hint };
                for (const line of lines) {
                    if (line.startsWith('Strip:')) result.strip = line.slice(6).trim();
                    else if (line.startsWith('Shift:')) result.shift = line.slice(6).trim();
                    else if (line.startsWith('Capture:')) result.capture = line.slice(8).trim();
                    else if (!result.thought) result.thought = line;
                }
                return result;
            }

            // Natural Korean: {original, upgraded, tier:"자연스러운 한국어"}
            if (obj.original && obj.upgraded && obj.tier === '자연스러운 한국어') {
                return { kind: 'natural-ko', original: obj.original, upgraded: obj.upgraded };
            }

            // Generic upgrade: {original, upgraded, tier?}
            if (obj.original && obj.upgraded) {
                const tier = obj.tier ? ` (${obj.tier})` : '';
                return { kind: 'generic', before: obj.original, after: `${obj.upgraded}${tier}` };
            }

            // Correction style fallback: {original, corrected}
            if (obj.original && obj.corrected) {
                return { kind: 'generic', before: obj.original, after: obj.corrected };
            }

            // Unrecognized hint format
            if (obj.hint) {
                const example = obj.example || obj.example_response || '';
                const tier = obj.tier ? ` (${obj.tier})` : '';
                return { kind: 'generic', before: obj.hint, after: `${example}${tier}` };
            }
        } catch { /* not valid JSON, fall through */ }
    }

    // Arrow format: "before → after"
    const idx = s.indexOf('→');
    if (idx !== -1) {
        return { kind: 'generic', before: s.slice(0, idx).trim(), after: s.slice(idx + 1).trim() };
    }

    return { kind: 'generic', before: s, after: '' };
};

/** Parse corrections (same logic as default FeedbackCard) */
const parseCorrection = (s: string): { before: string; after: string } | null => {
    if (s.startsWith('{')) {
        try {
            const obj = JSON.parse(s);
            if (obj.original && obj.corrected) return { before: obj.original, after: obj.corrected };
            if (obj.original && obj.upgraded) {
                const tier = obj.tier ? ` (${obj.tier})` : '';
                return { before: obj.original, after: `${obj.upgraded}${tier}` };
            }
        } catch { /* fall through */ }
    }
    const idx = s.indexOf('→');
    if (idx !== -1) return { before: s.slice(0, idx).trim(), after: s.slice(idx + 1).trim() };
    return null;
};

/* ── Sub-components ── */

const PointSection = ({ item }: { item: ParsedPoint }) => (
    <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
            <BookOpen className="h-2.5 w-2.5 text-violet-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
                Point
            </span>
        </div>
        <div className={cn(
            'ml-4 rounded-md p-2.5 space-y-2',
            'bg-violet-500/5 border border-violet-500/10',
        )}>
            {/* Hint — educational insight */}
            <p className="text-xs text-foreground/80 leading-relaxed">
                {item.hint}
            </p>

            {/* Strip / Shift / Capture steps */}
            {(item.thought || item.strip || item.shift || item.capture) && (
                <div className={cn(
                    'rounded px-2.5 py-2 space-y-1',
                    'bg-background/50 border border-border/30',
                )}>
                    {item.thought && (
                        <div className="text-xs text-muted-foreground/70 leading-relaxed">
                            {item.thought}
                        </div>
                    )}
                    {item.strip && (
                        <div className="flex items-baseline gap-2 text-xs">
                            <span className="shrink-0 font-mono text-[10px] font-semibold text-sky-400/80 w-14">
                                Strip
                            </span>
                            <span className="text-foreground/60">{item.strip}</span>
                        </div>
                    )}
                    {item.shift && (
                        <div className="flex items-baseline gap-2 text-xs">
                            <span className="shrink-0 font-mono text-[10px] font-semibold text-amber-400/80 w-14">
                                Shift
                            </span>
                            <span className="text-foreground/60">{item.shift}</span>
                        </div>
                    )}
                    {item.capture && (
                        <div className="flex items-baseline gap-2 text-xs">
                            <span className="shrink-0 font-mono text-[10px] font-semibold text-emerald-400/80 w-14">
                                Capture
                            </span>
                            <span className="text-emerald-400 font-medium">{item.capture}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
);

const NaturalKoreanSection = ({ items }: { items: ParsedNaturalKo[] }) => (
    <div className="space-y-1">
        <div className="flex items-center gap-1.5">
            <MessageSquareText className="h-2.5 w-2.5 text-teal-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400/80">
                이런 뜻이에요
            </span>
        </div>
        <div className="ml-4 space-y-0.5">
            {items.map((item, i) => (
                <div key={i} className="text-xs leading-relaxed flex items-baseline gap-1.5">
                    <span className="text-muted-foreground/50 shrink-0">-</span>
                    <span className="text-teal-300/90 font-medium">{item.upgraded}</span>
                </div>
            ))}
        </div>
    </div>
);

/* ── Main Component ── */

export const DetailedFeedbackCard = ({ corrections, betterExpressions }: DetailedFeedbackCardProps) => {
    const hasCorrections = corrections && corrections.length > 0;
    const hasBetter = betterExpressions && betterExpressions.length > 0;

    if (!hasCorrections && !hasBetter) return null;

    const [isOpen, setIsOpen] = useState(true);

    const totalCount = (corrections?.length ?? 0) + (betterExpressions?.length ?? 0);

    // Parse & group better expressions
    const points: ParsedPoint[] = [];
    const naturalKo: ParsedNaturalKo[] = [];
    const genericItems: ParsedGeneric[] = [];

    if (hasBetter) {
        for (const b of betterExpressions) {
            const parsed = parseBetterExpression(b);
            if (parsed.kind === 'point') points.push(parsed);
            else if (parsed.kind === 'natural-ko') naturalKo.push(parsed);
            else genericItems.push(parsed);
        }
    }

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
                    <div className="px-3 pb-2.5 space-y-3">
                        {/* ── Corrections Section ── */}
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
                                        const parsed = parseCorrection(c);
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

                        {/* ── Point Section ── */}
                        {points.map((item, i) => (
                            <PointSection key={`point-${i}`} item={item} />
                        ))}

                        {/* ── Natural Korean Section ── */}
                        {naturalKo.length > 0 && (
                            <NaturalKoreanSection items={naturalKo} />
                        )}

                        {/* ── Generic fallback (legacy / arrow format) ── */}
                        {genericItems.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                                        추천 표현
                                    </span>
                                </div>
                                <div className="space-y-0.5">
                                    {genericItems.map((item, i) => (
                                        <div key={i} className="text-xs leading-relaxed pl-4">
                                            <span className="text-muted-foreground/70">
                                                {item.before}
                                            </span>
                                            {item.after && (
                                                <>
                                                    <span className="text-muted-foreground/50 mx-1.5">→</span>
                                                    <span className="text-amber-300 font-medium whitespace-pre-line">
                                                        {item.after}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
