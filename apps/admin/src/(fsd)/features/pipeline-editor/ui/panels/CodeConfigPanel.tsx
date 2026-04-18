'use client';

import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

import type { CodeNodeData, EditorNode, OutputFieldDescriptor } from '../../model/types';
import { BindingsEditor, DeclaredOutputsEditor, SectionBlock } from './shared';

export const CodeConfigPanel = ({ node, suggestions, onPatch }: {
    node: EditorNode;
    suggestions: OutputFieldDescriptor[];
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as CodeNodeData;
    return (
        <div className="space-y-4">
            <SectionBlock title="기본 설정" description="코드 노드의 실행 환경과 타임아웃을 설정합니다.">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>타임아웃(ms)</Label>
                    <Input type="number" value={data.timeout_ms || 5000} onChange={(event) => onPatch({ timeout_ms: Number(event.target.value || 5000) })} />
                </div>
            </SectionBlock>
            <SectionBlock title="실행 코드" description="`async def execute(inputs)` 함수를 작성하세요.">
                <Textarea className="max-w-[350px] font-mono text-xs" rows={16} value={data.code || ''} onChange={(event) => onPatch({ code: event.target.value })} />
            </SectionBlock>
            <BindingsEditor title="입력 변수 바인딩" value={data.input_variables || {}} onChange={(input_variables) => onPatch({ input_variables })} suggestions={suggestions} />
            <DeclaredOutputsEditor
                value={data.declared_outputs}
                onChange={(declared_outputs) => onPatch({ declared_outputs })}
            />
        </div>
    );
};
