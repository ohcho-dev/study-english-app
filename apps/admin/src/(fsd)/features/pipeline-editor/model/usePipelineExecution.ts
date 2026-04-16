'use client';

import { useEffect } from 'react';

import { WS_BASE_URL } from '@/shared/lib/api';

import { usePipelineEditor } from './usePipelineEditor';

export const usePipelineExecution = (sessionId: string | null) => {
    const setExecutionState = usePipelineEditor((state) => state.setExecutionState);
    const updateNodeStatus = usePipelineEditor((state) => state.updateNodeStatus);
    const setExecuting = usePipelineEditor((state) => state.setExecuting);

    useEffect(() => {
        if (!sessionId) return;
        const ws = new WebSocket(`${WS_BASE_URL}/api/v1/visual-pipelines/monitor/${sessionId}/ws`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data) as {
                type: string;
                trace_id?: string;
                node_id?: string;
            };
            switch (data.type) {
                case 'pipeline:started':
                    setExecutionState(data.trace_id || null, {});
                    setExecuting(true);
                    break;
                case 'pipeline:node_started':
                    if (data.node_id) updateNodeStatus(data.node_id, 'running');
                    break;
                case 'pipeline:node_completed':
                    if (data.node_id) updateNodeStatus(data.node_id, 'completed');
                    break;
                case 'pipeline:node_failed':
                    if (data.node_id) updateNodeStatus(data.node_id, 'failed');
                    break;
                case 'pipeline:node_skipped':
                    if (data.node_id) updateNodeStatus(data.node_id, 'skipped');
                    break;
                case 'pipeline:completed':
                case 'pipeline:failed':
                    setExecuting(false);
                    break;
                default:
                    break;
            }
        };
        ws.onclose = () => setExecuting(false);
        return () => ws.close();
    }, [sessionId, setExecutionState, setExecuting, updateNodeStatus]);
};
