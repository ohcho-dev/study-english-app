'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BellRing } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const UIEventNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-yellow-400" />
            <NodeFrame
                icon={<BellRing className="h-4 w-4" />}
                title={String(data.label || 'UI 이벤트')}
                subtitle={`${String(data.target || 'session')} · ${String(data.event_type || '')}`}
                selected={selected}
                status={status}
                accent="bg-yellow-500 text-black"
            >
                <p className="line-clamp-3 text-xs text-zinc-300">{JSON.stringify(data.payload_template || {}, null, 2)}</p>
            </NodeFrame>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-yellow-400" />
        </>
    );
};
