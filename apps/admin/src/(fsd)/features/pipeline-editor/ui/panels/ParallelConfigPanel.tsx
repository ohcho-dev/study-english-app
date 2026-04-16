'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

import type { EditorNode, ParallelNodeData } from '../../model/types';
import { DeclaredOutputsEditor, SectionBlock } from './shared';

export const ParallelConfigPanel = ({ node, onPatch }: {
    node: EditorNode;
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as ParallelNodeData;
    const branches = data.branches || [];
    return (
        <div className="space-y-4">
            <SectionBlock title="브랜치 구성" description="메인 흐름과 보조 흐름을 분리합니다.">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
                <div className="space-y-3">
                    {branches.map((branch, index) => (
                        <div key={branch.id} className="grid grid-cols-[110px_1fr_84px_auto] items-center gap-2 rounded-xl border border-zinc-200 p-3">
                            <Input value={branch.id} onChange={(event) => {
                                const next = [...branches];
                                next[index] = { ...branch, id: event.target.value };
                                onPatch({ branches: next });
                            }} placeholder="ID" />
                            <Input value={branch.label} onChange={(event) => {
                                const next = [...branches];
                                next[index] = { ...branch, label: event.target.value };
                                onPatch({ branches: next });
                            }} placeholder="브랜치 이름" />
                            <label className="flex items-center gap-2 text-xs text-zinc-600">
                                <Checkbox checked={branch.affects_turn_flow} onCheckedChange={(checked) => {
                                    const next = [...branches];
                                    next[index] = { ...branch, affects_turn_flow: Boolean(checked) };
                                    onPatch({ branches: next });
                                }} />
                                메인
                            </label>
                            <Button variant="ghost" size="icon" onClick={() => onPatch({ branches: branches.filter((_, branchIndex) => branchIndex !== index) })}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => onPatch({ branches: [...branches, { id: `branch_${branches.length + 1}`, label: `브랜치 ${branches.length + 1}`, affects_turn_flow: true }] })}>
                    <Plus className="mr-2 h-4 w-4" />
                    브랜치 추가
                </Button>
            </SectionBlock>
            <DeclaredOutputsEditor
                value={data.declared_outputs}
                onChange={(declared_outputs) => onPatch({ declared_outputs })}
            />
        </div>
    );
};
