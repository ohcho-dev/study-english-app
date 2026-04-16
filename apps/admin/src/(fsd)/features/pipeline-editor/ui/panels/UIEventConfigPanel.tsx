'use client';

import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

import type { EditorNode, OutputFieldDescriptor, UIEventNodeData } from '../../model/types';
import { DeclaredOutputsEditor, SectionBlock, VariableSuggestions } from './shared';

export const UIEventConfigPanel = ({ node, suggestions, onPatch }: {
    node: EditorNode;
    suggestions: OutputFieldDescriptor[];
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as UIEventNodeData;
    return (
        <div className="space-y-4">
            <SectionBlock title="이벤트 설정" description="세션 앱 또는 어드민 모니터에 보낼 이벤트를 정의합니다.">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>이벤트 타입</Label>
                    <Input value={data.event_type || ''} onChange={(event) => onPatch({ event_type: event.target.value })} placeholder="pipeline:ui_update" />
                </div>
                <div className="space-y-2">
                    <Label>대상</Label>
                    <Select value={data.target || 'session'} onValueChange={(value) => onPatch({ target: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="session">세션 앱</SelectItem>
                            <SelectItem value="admin">어드민 모니터</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>페이로드 템플릿(JSON)</Label>
                    <Textarea
                        rows={10}
                        className="font-mono text-xs"
                        value={JSON.stringify(data.payload_template || {}, null, 2)}
                        onChange={(event) => {
                            try {
                                onPatch({ payload_template: JSON.parse(event.target.value) });
                            } catch {
                                onPatch({ payload_template: data.payload_template || {} });
                            }
                        }}
                    />
                </div>
                <VariableSuggestions registry={suggestions} />
            </SectionBlock>
            <DeclaredOutputsEditor
                value={data.declared_outputs}
                onChange={(declared_outputs) => onPatch({ declared_outputs })}
            />
        </div>
    );
};
