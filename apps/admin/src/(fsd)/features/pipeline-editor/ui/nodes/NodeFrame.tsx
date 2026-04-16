'use client';

import type { ReactNode } from 'react';

import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';

const statusClassNames: Record<string, string> = {
    running: 'border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]',
    completed: 'border-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]',
    failed: 'border-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.18)]',
    skipped: 'border-slate-500 opacity-70',
};

export const NodeFrame = ({
    icon,
    title,
    subtitle,
    selected,
    status,
    accent,
    children,
}: {
    icon: ReactNode;
    title: string;
    subtitle?: string;
    selected?: boolean;
    status?: string;
    accent: string;
    children?: ReactNode;
}) => {
    const statusClassName = status ? statusClassNames[status] : '';
    return (
        <Card
            className={[
                'w-64 overflow-hidden border-2 bg-zinc-950 text-zinc-50',
                statusClassName,
                selected ? 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background' : '',
            ].join(' ')}
        >
            <div className={['flex items-center justify-between px-3 py-2 text-white', accent].join(' ')}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                    {icon}
                    <span>{title}</span>
                </div>
                {status ? (
                    <Badge className="border-white/20 bg-white/10 text-[10px] text-white hover:bg-white/10">
                        {status}
                    </Badge>
                ) : null}
            </div>
            <CardContent className="space-y-2 bg-zinc-950 p-3">
                {subtitle ? <p className="text-xs text-zinc-400">{subtitle}</p> : null}
                {children}
            </CardContent>
        </Card>
    );
};
