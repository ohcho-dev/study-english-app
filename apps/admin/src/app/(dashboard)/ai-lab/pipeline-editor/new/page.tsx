'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { PipelineCanvas, usePipelineEditor } from '@/features/pipeline-editor';

const NewVisualPipelinePage = () => {
    const reset = usePipelineEditor((state) => state.reset);

    useEffect(() => {
        reset();
    }, [reset]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/ai-lab/visual-pipelines">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">새 비주얼 파이프라인</h1>
                    <p className="text-sm text-muted-foreground">기존 기능을 건드리지 않는 새 세션 엔진 편집기입니다.</p>
                </div>
            </div>
            <PipelineCanvas />
        </div>
    );
};

export default NewVisualPipelinePage;
