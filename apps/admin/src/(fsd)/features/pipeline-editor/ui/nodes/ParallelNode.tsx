'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitFork } from 'lucide-react';

import { usePipelineEditor } from '../../model/usePipelineEditor';
import { NodeFrame } from './NodeFrame';

export const ParallelNode = ({ data, selected, id }: NodeProps) => {
    const status = usePipelineEditor((state) => state.nodeStatuses[id]);
    const branches = (data.branches as Array<{ id: string; label: string; affects_turn_flow: boolean }> | undefined) || [];
    return (
        <>
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-cyan-500" />
            <NodeFrame
                icon={<GitFork className="h-4 w-4" />}
                title={String(data.label || '병렬 노드')}
                subtitle={`브랜치 ${branches.length}개`}
                selected={selected}
                status={status}
                accent="bg-cyan-700"
            >
                <div className="space-y-1 text-xs text-zinc-300">
                    {branches.map((branch) => (
                        <div key={branch.id} className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
                            <span>{branch.label}</span>
                            <span>{branch.affects_turn_flow ? '메인' : '보조'}</span>
                        </div>
                    ))}
                </div>
            </NodeFrame>
            {branches.map((branch, index) => (
                <Handle
                    key={branch.id}
                    id={branch.id}
                    type="source"
                    position={Position.Right}
                    style={{ top: 32 + index * 18 }}
                    className="!h-3 !w-3 !bg-cyan-500"
                />
            ))}
        </>
    );
};
