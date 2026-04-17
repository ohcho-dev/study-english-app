'use client';

import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { ScrollArea } from '@/shared/ui/scroll-area';

import { getScopedOutputSuggestions } from '../model/outputRegistry';
import { usePipelineEditor } from '../model/usePipelineEditor';
import { CodeConfigPanel } from './panels/CodeConfigPanel';
import { EndConfigPanel } from './panels/EndConfigPanel';
import { LLMConfigPanel } from './panels/LLMConfigPanel';
import { MergeConfigPanel } from './panels/MergeConfigPanel';
import { ParallelConfigPanel } from './panels/ParallelConfigPanel';
import { RouterConfigPanel } from './panels/RouterConfigPanel';
import { DeclaredOutputsEditor, SectionBlock } from './panels/shared';
import { UIEventConfigPanel } from './panels/UIEventConfigPanel';
import type { DelayNodeData, StartNodeData } from '../model/types';

export const NodeConfigPanel = () => {
    const nodes = usePipelineEditor((state) => state.nodes);
    const edges = usePipelineEditor((state) => state.edges);
    const selectedNodeId = usePipelineEditor((state) => state.selectedNodeId);
    const updateNodeData = usePipelineEditor((state) => state.updateNodeData);
    const node = nodes.find((item) => item.id === selectedNodeId);

    if (!node) return null;

    const suggestions = getScopedOutputSuggestions(nodes, edges, node.id);

    const onPatch = (patch: Record<string, unknown>) => updateNodeData(node.id, patch);
    const nodeLabel = typeof node.data.label === 'string' ? node.data.label : node.id;
    const delayData = node.data as unknown as DelayNodeData;
    const startData = node.data as unknown as StartNodeData;

    return (
        <aside className="w-[380px] border-l border-border bg-card/85 backdrop-blur">
            <ScrollArea className="h-[calc(100vh-64px)]">
                <div className="space-y-4 p-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">노드 설정</p>
                        <h2 className="mt-1 text-lg font-semibold text-foreground">{nodeLabel}</h2>
                        <p className="text-sm text-muted-foreground">타입: {node.type}</p>
                    </div>
                    {node.type === 'llm' ? <LLMConfigPanel node={node} suggestions={suggestions} onPatch={onPatch} /> : null}
                    {node.type === 'code' ? <CodeConfigPanel node={node} suggestions={suggestions} onPatch={onPatch} /> : null}
                    {node.type === 'router' ? <RouterConfigPanel node={node} suggestions={suggestions} onPatch={onPatch} /> : null}
                    {node.type === 'parallel' ? <ParallelConfigPanel node={node} onPatch={onPatch} /> : null}
                    {node.type === 'merge' ? <MergeConfigPanel node={node} onPatch={onPatch} /> : null}
                    {node.type === 'ui_event' ? <UIEventConfigPanel node={node} suggestions={suggestions} onPatch={onPatch} /> : null}
                    {node.type === 'end' ? <EndConfigPanel node={node} suggestions={suggestions} onPatch={onPatch} /> : null}
                    {node.type === 'delay' ? (
                        <div className="space-y-4">
                            <SectionBlock title="지연 설정" description="밀리초 또는 템플릿 식으로 대기 시간을 설정합니다.">
                                <div className="space-y-2">
                                    <Label>노드 이름</Label>
                                    <Input value={String(delayData.label || '')} onChange={(event) => onPatch({ label: event.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>지연 시간(ms 또는 식)</Label>
                                    <Input value={String(delayData.delay_ms || '')} onChange={(event) => onPatch({ delay_ms: event.target.value })} />
                                </div>
                            </SectionBlock>
                            <DeclaredOutputsEditor
                                value={delayData.declared_outputs}
                                onChange={(declared_outputs) => onPatch({ declared_outputs })}
                            />
                        </div>
                    ) : null}
                    {node.type === 'start' ? (
                        <div className="space-y-4">
                            <SectionBlock title="시작 노드" description="세션 컨텍스트에서 전달되는 입력 필드를 등록합니다.">
                                <div className="space-y-2">
                                    <Label>노드 이름</Label>
                                    <Input value={String(startData.label || '')} onChange={(event) => onPatch({ label: event.target.value })} />
                                </div>
                            </SectionBlock>
                            <DeclaredOutputsEditor
                                value={startData.declared_outputs}
                                onChange={(declared_outputs) => onPatch({ declared_outputs })}
                            />
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </aside>
    );
};
