'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CopyPlus, Link2, ListTodo, PencilLine, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import {
    useDeleteVisualPipeline,
    useDuplicateVisualPipeline,
    useVisualPipelines,
} from '@/features/pipeline-editor';

const VisualPipelinesPage = () => {
    const router = useRouter();
    const { data, isLoading } = useVisualPipelines();
    const deleteMutation = useDeleteVisualPipeline();
    const duplicateMutation = useDuplicateVisualPipeline();

    const handleDelete = async (id: string) => {
        if (!confirm('이 비주얼 파이프라인을 삭제하시겠습니까?')) return;
        try {
            await deleteMutation.mutateAsync(id);
        } catch (error) {
            console.error(error);
            alert('삭제에 실패했습니다. 템플릿 연결 여부를 확인하세요.');
        }
    };

    const handleDuplicate = async (id: string) => {
        try {
            const result = await duplicateMutation.mutateAsync(id);
            router.push(`/ai-lab/pipeline-editor/${result.id}`);
        } catch (error) {
            console.error(error);
            alert('복제에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-950">비주얼 파이프라인</h1>
                    <p className="mt-1 text-sm text-zinc-500">기존 AI Lab 실험 파이프라인과 분리된 세션 실행 전용 빌더입니다.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/ai-lab/template-links">
                            <Link2 className="mr-2 h-4 w-4" />
                            템플릿 연결
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/ai-lab/pipeline-logs">
                            <ListTodo className="mr-2 h-4 w-4" />
                            실행 로그
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/ai-lab/pipeline-editor/new">
                            <Plus className="mr-2 h-4 w-4" />
                            새 비주얼 파이프라인
                        </Link>
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-3xl" />)}
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {(data || []).map((pipeline) => (
                        <Card key={pipeline.id} className="rounded-3xl border-zinc-200">
                            <CardHeader>
                                <CardTitle className="text-lg text-zinc-950">{pipeline.name}</CardTitle>
                                <CardDescription>
                                    버전 {pipeline.version} · {pipeline.status} · 노드 {pipeline.node_count}개 / 엣지 {pipeline.edge_count}개
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="min-h-12 text-sm text-zinc-600">
                                    {pipeline.description || '설명이 아직 없습니다.'}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    최근 수정 {formatDistanceToNow(new Date(pipeline.updated_at), { addSuffix: true, locale: ko })}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/ai-lab/pipeline-editor/${pipeline.id}`}>
                                            <PencilLine className="mr-2 h-4 w-4" />
                                            열기
                                        </Link>
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(pipeline.id)}>
                                        <CopyPlus className="mr-2 h-4 w-4" />
                                        복제
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => handleDelete(pipeline.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        삭제
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {data && data.length === 0 ? (
                        <Card className="col-span-full rounded-3xl border-dashed border-zinc-300 bg-zinc-50">
                            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                                <p className="text-lg font-semibold text-zinc-900">아직 비주얼 파이프라인이 없습니다.</p>
                                <p className="text-sm text-zinc-500">새 버전의 세션 엔진을 여기서 설계할 수 있습니다.</p>
                                <Button asChild>
                                    <Link href="/ai-lab/pipeline-editor/new">
                                        <Plus className="mr-2 h-4 w-4" />
                                        첫 파이프라인 만들기
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default VisualPipelinesPage;
