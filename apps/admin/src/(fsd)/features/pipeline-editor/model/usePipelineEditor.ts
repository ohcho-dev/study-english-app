'use client';

import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type EdgeChange,
    type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';

import { buildDefaultGraph, createEditorNode } from './constants';
import type { EditorEdge, EditorNode, PipelineGraph } from './types';

interface EditorSnapshot {
    pipelineName: string;
    pipelineDescription: string;
    timeoutMs: number;
    nodes: EditorNode[];
    edges: EditorEdge[];
    viewport: { x: number; y: number; zoom: number };
}

interface ClipboardNode {
    type: EditorNode['type'];
    data: EditorNode['data'];
    position: { x: number; y: number };
}

interface PipelineEditorState {
    pipelineId: string | null;
    pipelineName: string;
    pipelineDescription: string;
    timeoutMs: number;
    nodes: EditorNode[];
    edges: EditorEdge[];
    viewport: { x: number; y: number; zoom: number };
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    isExecuting: boolean;
    executionTraceId: string | null;
    nodeStatuses: Record<string, string>;
    isDirty: boolean;
    lastSavedAt: string | null;
    historyPast: EditorSnapshot[];
    historyFuture: EditorSnapshot[];
    clipboardNode: ClipboardNode | null;
    setMeta: (payload: Partial<Pick<PipelineEditorState, 'pipelineName' | 'pipelineDescription' | 'timeoutMs'>>) => void;
    setNodes: (nodes: EditorNode[]) => void;
    setEdges: (edges: EditorEdge[]) => void;
    setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
    onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
    onEdgesChange: (changes: EdgeChange<EditorEdge>[]) => void;
    onConnect: (connection: Connection) => void;
    addNode: (type: EditorNode['type'], position: { x: number; y: number }) => void;
    updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
    updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
    removeNode: (nodeId: string) => void;
    removeEdge: (edgeId: string) => void;
    removeSelection: () => void;
    selectNode: (nodeId: string | null) => void;
    selectEdge: (edgeId: string | null) => void;
    copySelectedNode: () => boolean;
    pasteClipboardNode: () => boolean;
    undo: () => void;
    redo: () => void;
    setExecutionState: (traceId: string | null, statuses: Record<string, string>) => void;
    updateNodeStatus: (nodeId: string, status: string) => void;
    setExecuting: (isExecuting: boolean) => void;
    markSaved: () => void;
    loadImportedGraph: (payload: {
        pipelineName?: string;
        pipelineDescription?: string | null;
        timeoutMs?: number;
        graphJson: PipelineGraph;
    }) => void;
    loadPipeline: (pipeline: {
        id: string;
        name: string;
        description: string | null;
        timeout_ms: number;
        graph_json: PipelineGraph;
        updated_at: string;
    }) => void;
    reset: () => void;
}

const HISTORY_LIMIT = 80;

const clone = <T,>(value: T): T => structuredClone(value);

const createSnapshot = (state: Pick<PipelineEditorState, 'pipelineName' | 'pipelineDescription' | 'timeoutMs' | 'nodes' | 'edges' | 'viewport'>): EditorSnapshot => clone({
    pipelineName: state.pipelineName,
    pipelineDescription: state.pipelineDescription,
    timeoutMs: state.timeoutMs,
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
});

const pushHistory = (history: EditorSnapshot[], snapshot: EditorSnapshot): EditorSnapshot[] => (
    [...history, snapshot].slice(-HISTORY_LIMIT)
);

const withGraphHistory = (
    state: PipelineEditorState,
    patch: Partial<PipelineEditorState>,
): PipelineEditorState => ({
    ...state,
    ...patch,
    historyPast: pushHistory(state.historyPast, createSnapshot(state)),
    historyFuture: [],
    isDirty: true,
});

const restoreSnapshot = (
    state: PipelineEditorState,
    snapshot: EditorSnapshot,
    direction: 'undo' | 'redo',
): PipelineEditorState => {
    const currentSnapshot = createSnapshot(state);
    const nextPast = direction === 'undo' ? state.historyPast.slice(0, -1) : pushHistory(state.historyPast, currentSnapshot);
    const nextFuture = direction === 'undo'
        ? [currentSnapshot, ...state.historyFuture]
        : state.historyFuture.slice(1);

    return {
        ...state,
        ...clone(snapshot),
        selectedNodeId: null,
        selectedEdgeId: null,
        historyPast: nextPast,
        historyFuture: nextFuture,
        isDirty: true,
    };
};

const createInitialState = (): Pick<
    PipelineEditorState,
    | 'pipelineName'
    | 'pipelineDescription'
    | 'timeoutMs'
    | 'nodes'
    | 'edges'
    | 'viewport'
    | 'selectedNodeId'
    | 'selectedEdgeId'
    | 'isExecuting'
    | 'executionTraceId'
    | 'nodeStatuses'
    | 'isDirty'
    | 'lastSavedAt'
    | 'historyPast'
    | 'historyFuture'
    | 'clipboardNode'
> => {
    const graph = buildDefaultGraph();
    return {
        pipelineName: '새 비주얼 파이프라인',
        pipelineDescription: '',
        timeoutMs: 15000,
        nodes: graph.nodes,
        edges: graph.edges,
        viewport: graph.viewport,
        selectedNodeId: null,
        selectedEdgeId: null,
        isExecuting: false,
        executionTraceId: null,
        nodeStatuses: {},
        isDirty: false,
        lastSavedAt: null,
        historyPast: [],
        historyFuture: [],
        clipboardNode: null,
    };
};

export const usePipelineEditor = create<PipelineEditorState>((set, get) => ({
    pipelineId: null,
    ...createInitialState(),
    setMeta: (payload) => set((state) => withGraphHistory(state, { ...payload })),
    setNodes: (nodes) => set((state) => withGraphHistory(state, { nodes })),
    setEdges: (edges) => set((state) => withGraphHistory(state, { edges })),
    setViewport: (viewport) => set((state) => ({ ...state, viewport, isDirty: true })),
    onNodesChange: (changes) => set((state) => {
        const nextNodes = applyNodeChanges(changes, state.nodes);
        const shouldRecordHistory = changes.some((change) => (
            change.type === 'remove' ||
            change.type === 'replace' ||
            (change.type === 'position' && !change.dragging)
        ));

        if (!shouldRecordHistory) {
            return { ...state, nodes: nextNodes, isDirty: true };
        }

        return withGraphHistory(state, { nodes: nextNodes });
    }),
    onEdgesChange: (changes) => set((state) => {
        const nextEdges = applyEdgeChanges(changes, state.edges);
        const shouldRecordHistory = changes.some((change) => change.type === 'remove' || change.type === 'replace');

        if (!shouldRecordHistory) {
            return { ...state, edges: nextEdges, isDirty: true };
        }

        return withGraphHistory(state, { edges: nextEdges });
    }),
    onConnect: (connection) => set((state) => withGraphHistory(state, {
        edges: addEdge({ ...connection, id: `edge_${Date.now()}`, type: 'animated', animated: true }, state.edges),
    })),
    addNode: (type, position) => set((state) => withGraphHistory(state, {
        nodes: [...state.nodes, createEditorNode(type, position, state.nodes)],
    })),
    updateNodeData: (nodeId, data) => set((state) => withGraphHistory(state, {
        nodes: state.nodes.map((node) => (
            node.id === nodeId
                ? { ...node, data: { ...node.data, ...data } as EditorNode['data'] }
                : node
        )),
    })),
    updateNodePosition: (nodeId, position) => set((state) => withGraphHistory(state, {
        nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    })),
    removeNode: (nodeId) => set((state) => {
        const node = state.nodes.find((item) => item.id === nodeId);
        if (!node || node.type === 'start' || node.type === 'end') {
            return state;
        }

        return withGraphHistory(state, {
            nodes: state.nodes.filter((item) => item.id !== nodeId),
            edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        });
    }),
    removeEdge: (edgeId) => set((state) => withGraphHistory(state, {
        edges: state.edges.filter((edge) => edge.id !== edgeId),
        selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
    })),
    removeSelection: () => {
        const state = get();
        if (state.selectedNodeId) {
            state.removeNode(state.selectedNodeId);
            return;
        }
        if (state.selectedEdgeId) {
            state.removeEdge(state.selectedEdgeId);
        }
    },
    selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
    selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),
    copySelectedNode: () => {
        const state = get();
        const node = state.nodes.find((item) => item.id === state.selectedNodeId);
        if (!node || node.type === 'start' || node.type === 'end') {
            return false;
        }

        set({
            clipboardNode: clone({
                type: node.type,
                data: node.data,
                position: node.position,
            }),
        });
        return true;
    },
    pasteClipboardNode: () => {
        const state = get();
        if (!state.clipboardNode) {
            return false;
        }

        const position = state.selectedNodeId
            ? (() => {
                const selectedNode = state.nodes.find((item) => item.id === state.selectedNodeId);
                return {
                    x: (selectedNode?.position.x || state.clipboardNode.position.x) + 48,
                    y: (selectedNode?.position.y || state.clipboardNode.position.y) + 48,
                };
            })()
            : {
                x: state.clipboardNode.position.x + 48,
                y: state.clipboardNode.position.y + 48,
            };

        set((currentState) => {
            const node = createEditorNode(currentState.clipboardNode!.type, position, currentState.nodes);
            node.data = clone(currentState.clipboardNode!.data);
            return withGraphHistory(currentState, {
                nodes: [...currentState.nodes, node],
                selectedNodeId: node.id,
                selectedEdgeId: null,
            });
        });

        return true;
    },
    undo: () => set((state) => {
        const snapshot = state.historyPast[state.historyPast.length - 1];
        if (!snapshot) return state;
        return restoreSnapshot(state, snapshot, 'undo');
    }),
    redo: () => set((state) => {
        const snapshot = state.historyFuture[0];
        if (!snapshot) return state;
        return restoreSnapshot(state, snapshot, 'redo');
    }),
    setExecutionState: (traceId, statuses) => set({ executionTraceId: traceId, nodeStatuses: statuses }),
    updateNodeStatus: (nodeId, status) => set((state) => ({
        nodeStatuses: { ...state.nodeStatuses, [nodeId]: status },
    })),
    setExecuting: (isExecuting) => set({ isExecuting }),
    markSaved: () => set({ isDirty: false, lastSavedAt: new Date().toISOString() }),
    loadImportedGraph: ({ pipelineName, pipelineDescription, timeoutMs, graphJson }) => set((state) => withGraphHistory(state, {
        pipelineName: pipelineName || state.pipelineName,
        pipelineDescription: pipelineDescription ?? state.pipelineDescription,
        timeoutMs: timeoutMs || state.timeoutMs,
        nodes: clone(graphJson.nodes),
        edges: clone(graphJson.edges),
        viewport: clone(graphJson.viewport),
        selectedNodeId: null,
        selectedEdgeId: null,
    })),
    loadPipeline: (pipeline) => set({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        pipelineDescription: pipeline.description || '',
        timeoutMs: pipeline.timeout_ms,
        nodes: clone(pipeline.graph_json.nodes),
        edges: clone(pipeline.graph_json.edges),
        viewport: clone(pipeline.graph_json.viewport),
        selectedNodeId: null,
        selectedEdgeId: null,
        nodeStatuses: {},
        isDirty: false,
        lastSavedAt: pipeline.updated_at,
        historyPast: [],
        historyFuture: [],
    }),
    reset: () => {
        set({
            pipelineId: null,
            ...createInitialState(),
        });
    },
}));
