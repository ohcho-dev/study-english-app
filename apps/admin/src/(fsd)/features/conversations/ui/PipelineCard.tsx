import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type PipelineVariant = 'evaluator' | 'planner' | 'conductor';

const pipelineThemes: Record<PipelineVariant, { badge: string; label: string }> = {
    evaluator: {
        badge: 'bg-emerald-500/10 border-emerald-400/30',
        label: 'text-emerald-200',
    },
    planner: {
        badge: 'bg-indigo-500/10 border-indigo-400/30',
        label: 'text-indigo-200',
    },
    conductor: {
        badge: 'bg-teal-500/10 border-teal-400/30',
        label: 'text-teal-200',
    },
};

interface PipelineCardProps {
    variant: PipelineVariant;
    children?: ReactNode;
    extras?: [string, unknown][];
    className?: string;
}

export const PipelineCard = ({ variant, children, extras, className }: PipelineCardProps) => {
    const theme = pipelineThemes[variant];
    if (!theme) return null;

    return (
        <div className={cn('rounded-xl px-2 py-1 border text-[10px] flex flex-wrap items-center gap-1', theme.badge, className)}>
            <span className={cn('font-semibold uppercase text-[10px]', theme.label)}>
                {variant === 'evaluator' ? 'Evaluator' : variant === 'planner' ? 'Planner' : 'Conductor'}
            </span>
            {children}
            {extras && extras.length > 0 && (
                <details className="ml-auto text-[10px] text-muted-foreground" open>
                    <summary className="cursor-pointer select-none">세부</summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {extras.map(([key, value]) => (
                            <span key={`${variant}-extra-${key}`} className="px-1.5 py-0.5 rounded-full bg-muted/40 text-foreground/70">
                                {key}: {String(value)}
                            </span>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
};
