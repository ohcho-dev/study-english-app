'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitMerge } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const MergeNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    return (
        <>
            <Handle type="target" position={Position.Left} id={`${id}-left`} style={{ top: '35%' }} className="!h-3 !w-3 !bg-cyan-300" />
            <Handle type="target" position={Position.Left} id={`${id}-left-2`} style={{ top: '65%' }} className="!h-3 !w-3 !bg-cyan-300" />
            <NodeFrame
                icon={<GitMerge className="h-4 w-4" />}
                title={String(data.label || '병합 노드')}
                subtitle={`전략 ${String(data.merge_strategy || 'all')}`}
                selected={selected}
                status={status}
                accent="bg-cyan-900"
            >
                <p className="text-xs text-zinc-300">보조 브랜치 타임아웃 건너뛰기: {String(Boolean(data.skip_sidecar_on_timeout))}</p>
            </NodeFrame>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-cyan-300" />
        </>
    );
};
