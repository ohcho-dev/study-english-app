'use client';

import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

import type { EditorNode, EndNodeData, OutputFieldDescriptor } from '../../model/types';
import { BindingsEditor, SectionBlock } from './shared';

export const EndConfigPanel = ({ node, suggestions, onPatch }: {
    node: EditorNode;
    suggestions: OutputFieldDescriptor[];
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as EndNodeData;
    const mapping = (data.output_mapping as Record<string, string> | undefined) || {};
    return (
        <div className="space-y-4">
            <SectionBlock title="기본 설정">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
            </SectionBlock>
            <BindingsEditor
                title="세션 출력 계약"
                description="process_ai_turn()이 읽는 필드를 자유롭게 추가/삭제합니다."
                value={mapping}
                onChange={(output_mapping) => onPatch({ output_mapping })}
                suggestions={suggestions}
            />
        </div>
    );
};
