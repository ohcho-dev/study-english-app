'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Flag } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const EndNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    const mappingCount = Object.keys((data.output_mapping as Record<string, string> | undefined) || {}).length;
    const runtimeBindingCount = Object.keys((data.runtime_bindings as Record<string, string> | undefined) || {}).length;
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-sky-500" />
            <NodeFrame
                icon={<Flag className="h-4 w-4" />}
                title={String(data.label || '파이프라인 출력')}
                subtitle={`출력 ${mappingCount}개 · 런타임 바인딩 ${runtimeBindingCount}개`}
                selected={selected}
                status={status}
                accent="bg-sky-600"
            />
        </>
    );
};
