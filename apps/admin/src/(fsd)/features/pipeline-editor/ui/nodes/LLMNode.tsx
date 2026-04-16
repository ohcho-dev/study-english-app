'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Brain } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const LLMNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-fuchsia-500" />
            <NodeFrame
                icon={<Brain className="h-4 w-4" />}
                title={String(data.label || 'LLM 노드')}
                subtitle={`${String(data.model || '모델 미선택')} · ${String(data.response_format || 'text')}`}
                selected={selected}
                status={status}
                accent="bg-fuchsia-600"
            >
                <p className="line-clamp-3 text-xs text-zinc-300">{String(data.prompt || '프롬프트를 입력하세요.')}</p>
            </NodeFrame>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-fuchsia-500" />
        </>
    );
};
