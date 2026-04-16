'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code2 } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const CodeNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    const declaredOutputs = (data.declared_outputs as Array<{ label?: string }> | undefined) || [];
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-emerald-500" />
            <NodeFrame
                icon={<Code2 className="h-4 w-4" />}
                title={String(data.label || '코드 노드')}
                subtitle={`출력 등록 ${declaredOutputs.length}개`}
                selected={selected}
                status={status}
                accent="bg-emerald-700"
            >
                <p className="line-clamp-3 text-xs text-zinc-300">{String(data.code || '')}</p>
            </NodeFrame>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-emerald-500" />
        </>
    );
};
