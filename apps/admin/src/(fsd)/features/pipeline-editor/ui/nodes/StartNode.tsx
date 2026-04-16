'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

import { NodeFrame } from './NodeFrame';

export const StartNode = ({ data, selected, id }: NodeProps) => (
    <>
        <NodeFrame
            icon={<Play className="h-4 w-4" />}
            title={String(data.label || '사용자 입력')}
            subtitle="세션 문맥과 사용자 발화가 이 지점에서 시작됩니다."
            selected={selected}
            status={undefined}
            accent="bg-emerald-600"
        />
        <Handle id={`${id}-out`} type="source" position={Position.Right} className="!h-3 !w-3 !bg-emerald-500" />
    </>
);
