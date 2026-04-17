'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { PipelineCanvas, usePipelineEditor, useVisualPipeline } from '@/features/pipeline-editor';

const VisualPipelineEditorPage = () => {
    const params = useParams();
    const pipelineId = params.id as string;
    const { data, isLoading } = useVisualPipeline(pipelineId);
    const loadPipeline = usePipelineEditor((state) => state.loadPipeline);

    useEffect(() => {
        if (data) loadPipeline(data);
    }, [data, loadPipeline]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/ai-lab/visual-pipelines">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">비주얼 파이프라인 편집기</h1>
                    <p className="text-sm text-muted-foreground">시각 그래프와 출력 계약을 기준으로 세션 엔진을 편집합니다.</p>
                </div>
            </div>
            {isLoading || !data ? <Skeleton className="h-[720px] rounded-3xl" /> : <PipelineCanvas />}
        </div>
    );
};

export default VisualPipelineEditorPage;
