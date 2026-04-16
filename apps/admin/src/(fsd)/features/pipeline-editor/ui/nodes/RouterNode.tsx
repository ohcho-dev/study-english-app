'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const RouterNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    const routes = (data.routes as Array<{ id: string; label: string }> | undefined) || [];
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-amber-500" />
            <NodeFrame
                icon={<GitBranch className="h-4 w-4" />}
                title={String(data.label || '라우터')}
                subtitle={`분기 ${routes.length}개 · 기본 ${String(data.default_route || '-')}`}
                selected={selected}
                status={status}
                accent="bg-amber-600"
            >
                <p className="text-xs text-zinc-300">입력 식: {String(data.input_variable || '')}</p>
            </NodeFrame>
            {routes.map((route, index) => (
                <Handle
                    key={route.id}
                    id={route.id}
                    type="source"
                    position={Position.Right}
                    style={{ top: 32 + index * 18 }}
                    className="!h-3 !w-3 !bg-amber-500"
                />
            ))}
        </>
    );
};
