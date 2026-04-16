'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

export const AnimatedEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    data,
}: EdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });

    return (
        <>
            <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ strokeWidth: 2, stroke: 'rgba(45, 212, 191, 0.85)' }} />
            {data?.label ? (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        }}
                        className="rounded-full border border-teal-400/30 bg-card/95 px-2 py-1 text-[10px] font-medium text-teal-300 shadow-sm shadow-black/20 backdrop-blur"
                    >
                        {String(data.label)}
                    </div>
                </EdgeLabelRenderer>
            ) : null}
        </>
    );
};
