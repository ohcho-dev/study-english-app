'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';

import {
    PipelineCard,
    usePipelines,
    useDeletePipeline,
} from '@/features/ai-lab';

const PipelinesPage = () => {
    const { data: pipelines, isLoading } = usePipelines();
    const deleteMutation = useDeletePipeline();

    const handleDelete = async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id);
        } catch (error) {
            console.error('Failed to delete pipeline:', error);
            alert('파이프라인 삭제에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">🔗 파이프라인 관리</h1>
                    <p className="text-muted-foreground">
                        AI 에이전트 파이프라인을 생성하고 관리합니다.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/ai-lab/pipelines/new">
                        <Plus className="h-4 w-4 mr-2" />
                        새 파이프라인
                    </Link>
                </Button>
            </div>

            {/* Pipeline List */}
            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-40 rounded-lg" />
                    ))}
                </div>
            ) : pipelines && pipelines.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pipelines.map((pipeline) => (
                        <PipelineCard
                            key={pipeline.id}
                            pipeline={pipeline}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border border-dashed rounded-lg">
                    <p className="text-muted-foreground mb-4">
                        아직 파이프라인이 없습니다.
                    </p>
                    <Button asChild>
                        <Link href="/ai-lab/pipelines/new">
                            <Plus className="h-4 w-4 mr-2" />
                            첫 파이프라인 만들기
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
};

export default PipelinesPage;
