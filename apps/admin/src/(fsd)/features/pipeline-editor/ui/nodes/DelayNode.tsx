'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { TimerReset } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const DelayNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-300" />
            <NodeFrame
                icon={<TimerReset className="h-4 w-4" />}
                title={String(data.label || '지연 노드')}
                subtitle={`${String(data.delay_ms || 0)}ms 대기`}
                selected={selected}
                status={status}
                accent="bg-slate-700"
            />
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-300" />
        </>
    );
};
