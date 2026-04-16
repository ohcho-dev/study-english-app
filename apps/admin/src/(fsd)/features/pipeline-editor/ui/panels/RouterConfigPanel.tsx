'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

import type { EditorNode, OutputFieldDescriptor, RouterNodeData, RouterRoute } from '../../model/types';
import { DeclaredOutputsEditor, SectionBlock, VariableSuggestions } from './shared';

const operators = [
    { value: 'eq', label: '같음' },
    { value: 'neq', label: '다름' },
    { value: 'gt', label: '초과' },
    { value: 'gte', label: '이상' },
    { value: 'lt', label: '미만' },
    { value: 'lte', label: '이하' },
    { value: 'contains', label: '포함' },
    { value: 'regex', label: '정규식' },
];

export const RouterConfigPanel = ({ node, suggestions, onPatch }: {
    node: EditorNode;
    suggestions: OutputFieldDescriptor[];
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as RouterNodeData;
    const routes: RouterRoute[] = data.routes || [];
    return (
        <div className="space-y-4">
            <DeclaredOutputsEditor
                value={data.declared_outputs}
                onChange={(declared_outputs) => onPatch({ declared_outputs })}
            />
            <SectionBlock title="라우팅 기준" description="어떤 값을 기준으로 분기할지 정합니다.">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>입력 식</Label>
                    <Input value={data.input_variable || ''} onChange={(event) => onPatch({ input_variable: event.target.value })} list="router-suggestions" />
                </div>
                <VariableSuggestions registry={suggestions} />
                <datalist id="router-suggestions">
                    {suggestions.map((field) => <option key={field.key} value={`{{${field.path}}}`} />)}
                </datalist>
            </SectionBlock>
            <SectionBlock title="분기 규칙" description="위에서부터 순서대로 평가됩니다.">
                <div className="space-y-3">
                    {routes.map((route, index) => (
                        <div key={route.id} className="space-y-2 rounded-xl border border-zinc-200 p-3">
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                <Input value={route.id} onChange={(event) => {
                                    const next = [...routes];
                                    next[index] = { ...route, id: event.target.value };
                                    onPatch({ routes: next });
                                }} placeholder="핸들 ID" />
                                <Input value={route.label} onChange={(event) => {
                                    const next = [...routes];
                                    next[index] = { ...route, label: event.target.value };
                                    onPatch({ routes: next });
                                }} placeholder="라벨" />
                                <Button variant="ghost" size="icon" onClick={() => onPatch({ routes: routes.filter((_, routeIndex) => routeIndex !== index) })}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="grid grid-cols-[180px_1fr] gap-2">
                                <Select value={route.condition.operator} onValueChange={(value) => {
                                    const next = [...routes];
                                    next[index] = { ...route, condition: { ...route.condition, operator: value as RouterRoute['condition']['operator'] } };
                                    onPatch({ routes: next });
                                }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {operators.map((operator) => <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input value={String(route.condition.value)} onChange={(event) => {
                                    const next = [...routes];
                                    next[index] = { ...route, condition: { ...route.condition, value: event.target.value } };
                                    onPatch({ routes: next });
                                }} placeholder="비교 값" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onPatch({ routes: [...routes, { id: `route_${routes.length + 1}`, label: `분기 ${routes.length + 1}`, condition: { operator: 'eq', value: '' } }] })}>
                        <Plus className="mr-2 h-4 w-4" />
                        분기 추가
                    </Button>
                    <Input value={data.default_route || ''} onChange={(event) => onPatch({ default_route: event.target.value })} placeholder="기본 라우트 ID" />
                </div>
            </SectionBlock>
        </div>
    );
};
