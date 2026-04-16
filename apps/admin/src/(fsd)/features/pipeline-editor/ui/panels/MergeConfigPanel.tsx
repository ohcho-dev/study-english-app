'use client';

import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';

import type { EditorNode, MergeNodeData } from '../../model/types';
import { DeclaredOutputsEditor, SectionBlock } from './shared';

export const MergeConfigPanel = ({ node, onPatch }: {
    node: EditorNode;
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as MergeNodeData;
    return (
        <div className="space-y-4">
            <SectionBlock title="병합 전략" description="분기 출력을 어떤 방식으로 합칠지 결정합니다.">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>전략</Label>
                    <Select value={data.merge_strategy || 'all'} onValueChange={(value) => onPatch({ merge_strategy: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">모두 수집</SelectItem>
                            <SelectItem value="first">가장 먼저 완료된 결과</SelectItem>
                            <SelectItem value="custom">사용자 정의 식</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {data.merge_strategy === 'custom' ? (
                    <div className="space-y-2">
                        <Label>사용자 정의 식</Label>
                        <Input value={data.custom_merge_expression || ''} onChange={(event) => onPatch({ custom_merge_expression: event.target.value })} placeholder="branches['code_1']" />
                    </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>타임아웃(ms)</Label>
                        <Input type="number" value={data.timeout_ms || 12000} onChange={(event) => onPatch({ timeout_ms: Number(event.target.value || 12000) })} />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
                        <span className="text-sm text-zinc-700">보조 브랜치 생략</span>
                        <Switch checked={Boolean(data.skip_sidecar_on_timeout)} onCheckedChange={(checked) => onPatch({ skip_sidecar_on_timeout: checked })} />
                    </div>
                </div>
            </SectionBlock>
            <DeclaredOutputsEditor
                value={data.declared_outputs}
                onChange={(declared_outputs) => onPatch({ declared_outputs })}
            />
        </div>
    );
};
