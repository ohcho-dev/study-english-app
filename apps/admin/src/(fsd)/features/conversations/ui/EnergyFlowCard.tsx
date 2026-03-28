'use client';

/**
 * EnergyFlowCard Component
 *
 * Visualizes the energy flow of English control verbs in a table format.
 * Shows how the same concept changes when expressed with different verbs,
 * highlighting the directional energy each verb carries.
 *
 * Displayed independently of the feedback card, rendered below user messages
 * via a parallel API call for fast response.
 */

import { useState } from 'react';
import { ChevronDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EnergyFlowComparison {
    korean: string;
    english: string;
    direction: string;
}

export interface EnergyFlowData {
    verb: string;
    core_energy: string;
    comparisons: EnergyFlowComparison[];
}

interface EnergyFlowCardProps {
    data: EnergyFlowData;
    isLoading?: boolean;
}

/** Highlight the CAPITALIZED verb in the English expression */
const HighlightedEnglish = ({ text }: { text: string }) => {
    // Split by words, highlight fully-uppercase words (2+ chars)
    const parts = text.split(/(\s+)/);
    return (
        <>
            {parts.map((part, i) =>
                /^[A-Z]{2,}$/.test(part) ? (
                    <span key={i} className="font-bold text-amber-400">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
};

/** Loading skeleton */
const EnergyFlowSkeleton = () => (
    <div className={cn(
        'ml-0 mt-1 mb-1 rounded-lg overflow-hidden',
        'border border-border/40',
        'bg-card/40 backdrop-blur-sm',
    )}>
        <div className="flex items-center gap-2 px-3 py-1.5">
            <Zap className="h-3 w-3 text-amber-400/50 animate-pulse" />
            <span className="text-xs text-muted-foreground/50 animate-pulse">
                에너지 흐름 분석 중...
            </span>
        </div>
    </div>
);

export const EnergyFlowCard = ({ data, isLoading }: EnergyFlowCardProps) => {
    const [isOpen, setIsOpen] = useState(true);

    if (isLoading) return <EnergyFlowSkeleton />;
    if (!data || !data.comparisons?.length) return null;

    return (
        <div className={cn(
            'ml-0 mt-1 mb-1 rounded-lg overflow-hidden',
            'border border-amber-500/20',
            'bg-amber-500/[0.03] backdrop-blur-sm',
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
                    <Zap className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="font-medium truncate">
                        에너지 흐름
                        <span className="ml-1.5 text-amber-400 font-bold">{data.verb}</span>
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
                        {/* Core Energy Description */}
                        <p className="text-[10px] text-amber-400/70 leading-relaxed">
                            {data.core_energy}
                        </p>

                        {/* Comparison Table */}
                        <div className={cn(
                            'rounded-md overflow-hidden',
                            'border border-border/30',
                        )}>
                            {/* Header */}
                            <div className="grid grid-cols-[1fr_1.3fr_0.8fr] gap-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 bg-background/30">
                                <div className="px-2 py-1 border-r border-border/20">상황</div>
                                <div className="px-2 py-1 border-r border-border/20">영어</div>
                                <div className="px-2 py-1">에너지 방향</div>
                            </div>

                            {/* Rows */}
                            {data.comparisons.map((row, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'grid grid-cols-[1fr_1.3fr_0.8fr] gap-0 text-xs',
                                        'border-t border-border/20',
                                        i % 2 === 0 ? 'bg-background/20' : 'bg-background/10',
                                    )}
                                >
                                    <div className="px-2 py-1.5 text-foreground/60 border-r border-border/20">
                                        {row.korean}
                                    </div>
                                    <div className="px-2 py-1.5 text-foreground/80 border-r border-border/20">
                                        <HighlightedEnglish text={row.english} />
                                    </div>
                                    <div className="px-2 py-1.5 text-amber-400/80 text-[10px]">
                                        {row.direction}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
