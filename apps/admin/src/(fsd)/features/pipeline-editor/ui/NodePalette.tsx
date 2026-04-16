'use client';

import { BellRing, Brain, Code2, GitBranch, GitFork, GitMerge, TimerReset } from 'lucide-react';

import { NODE_DESCRIPTIONS, NODE_LABELS } from '../model/constants';
import type { NodeType } from '../model/types';

const paletteItems: Array<{ type: NodeType; icon: React.ComponentType<{ className?: string }>; accent: string }> = [
    { type: 'llm', icon: Brain, accent: 'bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-400/25' },
    { type: 'code', icon: Code2, accent: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25' },
    { type: 'router', icon: GitBranch, accent: 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25' },
    { type: 'parallel', icon: GitFork, accent: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-400/25' },
    { type: 'merge', icon: GitMerge, accent: 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/25' },
    { type: 'ui_event', icon: BellRing, accent: 'bg-yellow-500/15 text-yellow-300 ring-1 ring-inset ring-yellow-400/25' },
    { type: 'delay', icon: TimerReset, accent: 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/25' },
];

export const NodePalette = () => {
    return (
        <aside className="w-[260px] border-r border-border bg-card/80 p-4 backdrop-blur">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">노드 팔레트</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">캔버스 빌더</h2>
                <p className="mt-1 text-sm text-muted-foreground">아래 노드를 끌어다 캔버스에 놓으세요. 시작 노드는 이미 배치되어 있습니다.</p>
            </div>
            <div className="mt-4 space-y-3">
                {paletteItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.type}
                            type="button"
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData('application/pipeline-node-type', item.type)}
                            className="w-full rounded-2xl border border-border bg-background/70 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm"
                        >
                            <div className="flex items-start gap-3">
                                <div className={['rounded-xl p-2', item.accent].join(' ')}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{NODE_LABELS[item.type]}</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{NODE_DESCRIPTIONS[item.type]}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};
