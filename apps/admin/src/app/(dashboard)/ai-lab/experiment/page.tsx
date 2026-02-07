'use client';

import { useSearchParams } from 'next/navigation';

import { Skeleton } from '@/shared/ui/skeleton';

import {
    ExperimentRunner,
    ExperimentResult,
    RecentLogs,
    usePipelines,
    useModels,
    useExperimentState,
} from '@/features/ai-lab';

const ExperimentPage = () => {
    const searchParams = useSearchParams();
    const defaultPipelineId = searchParams.get('pipeline') || undefined;

    const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
    const { data: models, isLoading: modelsLoading } = useModels();
    const { result, run, cancel, isLoading: runLoading, error } = useExperimentState();

    const isLoading = pipelinesLoading || modelsLoading;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-80 rounded-lg" />
                <Skeleton className="h-60 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">🧪 실험 테스트</h1>
                <p className="text-muted-foreground">
                    파이프라인을 선택하고 AI 모델을 테스트합니다.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Runner */}
                <div className="space-y-6">
                    <ExperimentRunner
                        pipelines={pipelines || []}
                        models={models || []}
                        isLoading={runLoading}
                        onRun={async (request) => { await run(request); }}
                        onCancel={cancel}
                        defaultPipelineId={defaultPipelineId}
                    />

                    {error && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                            ⚠️ 오류: {error.message}
                        </div>
                    )}
                </div>

                {/* Right: Result */}
                <div>
                    {result ? (
                        <ExperimentResult result={result} />
                    ) : (
                        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                            <p className="text-lg mb-2">👈 왼쪽에서 실험을 실행하세요</p>
                            <p className="text-sm">결과가 여기에 표시됩니다.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Logs */}
            <RecentLogs limit={5} pipelineId={defaultPipelineId} />
        </div>
    );
};

export default ExperimentPage;
