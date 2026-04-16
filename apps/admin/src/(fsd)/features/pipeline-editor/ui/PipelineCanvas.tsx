'use client';

import { useCallback, useEffect, type DragEvent } from 'react';
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    ReactFlowProvider,
    type EdgeTypes,
    type NodeTypes,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { usePipelineEditor } from '../model/usePipelineEditor';
import type { NodeType } from '../model/types';
import { DelayNode } from './nodes/DelayNode';
import { CodeNode } from './nodes/CodeNode';
import { EndNode } from './nodes/EndNode';
import { LLMNode } from './nodes/LLMNode';
import { MergeNode } from './nodes/MergeNode';
import { ParallelNode } from './nodes/ParallelNode';
import { RouterNode } from './nodes/RouterNode';
import { StartNode } from './nodes/StartNode';
import { UIEventNode } from './nodes/UIEventNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import { ExecutionOverlay } from './ExecutionOverlay';
import { NodeConfigPanel } from './NodeConfigPanel';
import { NodePalette } from './NodePalette';
import { PipelineToolbar } from './PipelineToolbar';

const nodeTypes: NodeTypes = {
    start: StartNode,
    end: EndNode,
    llm: LLMNode,
    code: CodeNode,
    router: RouterNode,
    parallel: ParallelNode,
    merge: MergeNode,
    ui_event: UIEventNode,
    delay: DelayNode,
};

const edgeTypes: EdgeTypes = {
    animated: AnimatedEdge,
};

const isTypingTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const tagName = element.tagName;
    return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        element.isContentEditable
    );
};

const CanvasBody = () => {
    const reactFlow = useReactFlow();
    const nodes = usePipelineEditor((state) => state.nodes);
    const edges = usePipelineEditor((state) => state.edges);
    const viewport = usePipelineEditor((state) => state.viewport);
    const selectedNodeId = usePipelineEditor((state) => state.selectedNodeId);
    const selectedEdgeId = usePipelineEditor((state) => state.selectedEdgeId);
    const onNodesChange = usePipelineEditor((state) => state.onNodesChange);
    const onEdgesChange = usePipelineEditor((state) => state.onEdgesChange);
    const onConnect = usePipelineEditor((state) => state.onConnect);
    const addNode = usePipelineEditor((state) => state.addNode);
    const selectNode = usePipelineEditor((state) => state.selectNode);
    const selectEdge = usePipelineEditor((state) => state.selectEdge);
    const setViewport = usePipelineEditor((state) => state.setViewport);
    const copySelectedNode = usePipelineEditor((state) => state.copySelectedNode);
    const pasteClipboardNode = usePipelineEditor((state) => state.pasteClipboardNode);
    const removeSelection = usePipelineEditor((state) => state.removeSelection);
    const undo = usePipelineEditor((state) => state.undo);
    const redo = usePipelineEditor((state) => state.redo);

    const handleDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/pipeline-node-type') as NodeType;
        if (!type) return;
        const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode(type, position);
    }, [addNode, reactFlow]);

    const handleDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    useEffect(() => {
        void reactFlow.setViewport(viewport, { duration: 0 });
    }, [reactFlow, viewport]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isTypingTarget(event.target)) {
                return;
            }

            const key = event.key.toLowerCase();
            const hasModifier = event.metaKey || event.ctrlKey;

            if (hasModifier && key === 'z') {
                event.preventDefault();
                if (event.shiftKey) {
                    redo();
                    return;
                }
                undo();
                return;
            }

            if (hasModifier && key === 'y') {
                event.preventDefault();
                redo();
                return;
            }

            if (hasModifier && key === 'c') {
                if (selectedNodeId && copySelectedNode()) {
                    event.preventDefault();
                }
                return;
            }

            if (hasModifier && key === 'v') {
                if (pasteClipboardNode()) {
                    event.preventDefault();
                }
                return;
            }

            if ((event.key === 'Delete' || event.key === 'Backspace') && (selectedNodeId || selectedEdgeId)) {
                event.preventDefault();
                removeSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [copySelectedNode, pasteClipboardNode, redo, removeSelection, selectedEdgeId, selectedNodeId, undo]);

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.15),_transparent_28%),linear-gradient(180deg,_#f6fffd_0%,_#eef7f7_100%)]">
            <NodePalette />
            <div className="relative flex-1" onDrop={handleDrop} onDragOver={handleDragOver}>
                <PipelineToolbar />
                <ExecutionOverlay />
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_, node) => selectNode(node.id)}
                    onEdgeClick={(_, edge) => selectEdge(edge.id)}
                    onPaneClick={() => {
                        selectNode(null);
                        selectEdge(null);
                    }}
                    onMoveEnd={(_, nextViewport) => setViewport(nextViewport)}
                    defaultEdgeOptions={{ type: 'animated', animated: true }}
                >
                    <Background gap={24} size={1.1} color="#b8d7d5" />
                    <Controls />
                    <MiniMap zoomable pannable className="!bg-white !shadow-lg" />
                </ReactFlow>
            </div>
            {selectedNodeId ? <NodeConfigPanel /> : null}
        </div>
    );
};

export const PipelineCanvas = () => (
    <ReactFlowProvider>
        <CanvasBody />
    </ReactFlowProvider>
);
