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
    const runtimeBindings = (data.runtime_bindings as Record<string, string> | undefined) || {};
    const outputSuggestions: OutputFieldDescriptor[] = Object.keys(mapping).map((key) => ({
        key,
        path: key,
        label: key,
    }));
    return (
        <div className="space-y-4">
            <SectionBlock title="기본 설정">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
            </SectionBlock>
            <BindingsEditor
                title="출력 객체 매핑"
                description="upstream 출력만 연결할 수 있습니다. 이 노드가 최종적으로 내보낼 임의의 결과 객체를 정의하세요."
                value={mapping}
                onChange={(output_mapping) => onPatch({ output_mapping })}
                suggestions={suggestions}
            />
            <BindingsEditor
                title="세션 런타임 바인딩"
                description="왼쪽은 세션 엔진이 읽을 슬롯 이름이고, 오른쪽은 위 출력 객체의 키 또는 경로입니다. 예: intervention_emitted -> intervention_emitted"
                value={runtimeBindings}
                onChange={(runtime_bindings) => onPatch({ runtime_bindings })}
                suggestions={outputSuggestions}
                placeholder="intervention_emitted"
                addButtonLabel="바인딩 추가"
                suggestionValueFormatter={(field) => field.path}
                suggestionLabelFormatter={(field) => field.path}
            />
        </div>
    );
};
