'use client';

import { Badge } from '@/shared/ui/badge';

import { usePipelineEditor } from '../model/usePipelineEditor';

export const ExecutionOverlay = () => {
    const isExecuting = usePipelineEditor((state) => state.isExecuting);
    const traceId = usePipelineEditor((state) => state.executionTraceId);
    const nodeStatuses = usePipelineEditor((state) => state.nodeStatuses);

    if (!traceId && !isExecuting) return null;

    const values = Object.values(nodeStatuses);
    const completed = values.filter((value) => value === 'completed').length;
    const failed = values.filter((value) => value === 'failed').length;
    const running = values.filter((value) => value === 'running').length;

    return (
        <div className="absolute right-4 top-20 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-lg shadow-black/20 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">실행 상태</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{isExecuting ? '실행 중' : '최근 실행 결과'}</p>
            {traceId ? <p className="mt-1 text-xs text-muted-foreground">추적 ID: {traceId}</p> : null}
            <div className="mt-3 flex gap-2">
                <Badge variant="outline">완료 {completed}</Badge>
                <Badge variant="outline">실행 {running}</Badge>
                <Badge variant="outline">실패 {failed}</Badge>
            </div>
        </div>
    );
};
