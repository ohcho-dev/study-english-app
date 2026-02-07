'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

import {
    AgentEditor,
    useCreatePipeline,
    type AgentCreate,
} from '@/features/ai-lab';

const NewPipelinePage = () => {
    const router = useRouter();
    const createMutation = useCreatePipeline();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [agents, setAgents] = useState<AgentCreate[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !systemPrompt.trim() || agents.length === 0) {
            alert('이름, 시스템 프롬프트, 그리고 최소 1개 이상의 에이전트가 필요합니다.');
            return;
        }

        // Validate agents
        const invalidAgent = agents.find((a) => !a.role_name.trim() || !a.prompt.trim());
        if (invalidAgent) {
            alert('모든 에이전트의 역할과 프롬프트를 입력해주세요.');
            return;
        }

        try {
            await createMutation.mutateAsync({
                name: name.trim(),
                description: description.trim() || null,
                system_prompt: systemPrompt.trim(),
                agents,
            });
            router.push('/ai-lab/pipelines');
        } catch (error) {
            console.error('Failed to create pipeline:', error);
            alert('파이프라인 생성에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/ai-lab/pipelines">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">새 파이프라인 만들기</h1>
                    <p className="text-muted-foreground">
                        AI 에이전트들의 파이프라인을 구성합니다.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>기본 정보</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                파이프라인 이름 *
                            </label>
                            <Input
                                placeholder="예: 콘텐츠 생성 파이프라인"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                설명 (선택)
                            </label>
                            <Input
                                placeholder="이 파이프라인에 대한 간단한 설명"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* System Prompt */}
                <Card>
                    <CardHeader>
                        <CardTitle>📝 시스템 프롬프트</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="모든 에이전트에게 적용될 공통 시스템 프롬프트를 입력하세요..."
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            이 프롬프트는 모든 에이전트의 기본 행동 지침으로 사용됩니다.
                        </p>
                    </CardContent>
                </Card>

                {/* Agents */}
                <Card>
                    <CardContent className="pt-6">
                        <AgentEditor agents={agents} onChange={setAgents} />
                    </CardContent>
                </Card>

                {/* Submit */}
                <div className="flex justify-end gap-3">
                    <Button variant="outline" type="button" asChild>
                        <Link href="/ai-lab/pipelines">취소</Link>
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        {createMutation.isPending ? '저장 중...' : '파이프라인 저장'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default NewPipelinePage;
