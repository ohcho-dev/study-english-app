'use client';

import { Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

import type { AgentCreate } from '../model/types';

interface AgentEditorProps {
    agents: AgentCreate[];
    onChange: (agents: AgentCreate[]) => void;
}

/**
 * Agent editor component for managing pipeline agents
 */
export const AgentEditor = ({ agents, onChange }: AgentEditorProps) => {
    const addAgent = () => {
        const newAgent: AgentCreate = {
            role_name: '',
            prompt: '',
            order_index: agents.length,
        };
        onChange([...agents, newAgent]);
    };

    const updateAgent = (index: number, field: keyof AgentCreate, value: string | number) => {
        const updated = agents.map((agent, i) =>
            i === index ? { ...agent, [field]: value } : agent
        );
        onChange(updated);
    };

    const removeAgent = (index: number) => {
        const updated = agents
            .filter((_, i) => i !== index)
            .map((agent, i) => ({ ...agent, order_index: i }));
        onChange(updated);
    };

    const moveAgent = (index: number, direction: 'up' | 'down') => {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === agents.length - 1)
        ) {
            return;
        }

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const updated = [...agents];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

        // Update order indices
        const reindexed = updated.map((agent, i) => ({ ...agent, order_index: i }));
        onChange(reindexed);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">🤖 에이전트 목록</h3>
                <Button type="button" variant="outline" size="sm" onClick={addAgent}>
                    + 에이전트 추가
                </Button>
            </div>

            {agents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    아직 에이전트가 없습니다. 위 버튼을 클릭하여 추가하세요.
                </div>
            )}

            <div className="space-y-4">
                {agents.map((agent, index) => (
                    <Card key={index} className="relative">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">
                                    Agent {index + 1}
                                </span>
                                <div className="flex-1" />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => moveAgent(index, 'up')}
                                    disabled={index === 0}
                                >
                                    <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => moveAgent(index, 'down')}
                                    disabled={index === agents.length - 1}
                                >
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => removeAgent(index)}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">역할</label>
                                <Input
                                    placeholder="예: 분석가, 검증자, 요약자"
                                    value={agent.role_name}
                                    onChange={(e) => updateAgent(index, 'role_name', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">프롬프트</label>
                                <textarea
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="이 에이전트가 수행할 작업을 설명하세요..."
                                    value={agent.prompt}
                                    onChange={(e) => updateAgent(index, 'prompt', e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
