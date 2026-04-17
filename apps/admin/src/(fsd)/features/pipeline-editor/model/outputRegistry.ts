import type { EditorEdge, EditorNode, OutputFieldDescriptor } from './types';

export interface BindingReference {
    expression: string;
    nodeId: string;
    path: string;
}

const REFERENCE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_.]+)\s*\}\}/g;

const getDeclaredOutputs = (node: EditorNode): OutputFieldDescriptor[] => {
    const data = node.data as { declared_outputs?: OutputFieldDescriptor[] };
    return Array.isArray(data.declared_outputs) ? data.declared_outputs : [];
};

const getNodeReferenceName = (node: EditorNode) => (node.type === 'start' ? 'start' : node.id);

export const buildAdjacencyMaps = (nodes: EditorNode[], edges: EditorEdge[]) => {
    const adjacency = new Map<string, Set<string>>();
    const reverseAdjacency = new Map<string, Set<string>>();

    nodes.forEach((node) => {
        adjacency.set(node.id, new Set());
        reverseAdjacency.set(node.id, new Set());
    });

    edges.forEach((edge) => {
        adjacency.get(edge.source)?.add(edge.target);
        reverseAdjacency.get(edge.target)?.add(edge.source);
    });

    return { adjacency, reverseAdjacency };
};

export const collectUpstreamNodeIds = (
    nodes: EditorNode[],
    edges: EditorEdge[],
    nodeId: string,
) => {
    const { reverseAdjacency } = buildAdjacencyMaps(nodes, edges);
    const visited = new Set<string>();
    const stack = [...(reverseAdjacency.get(nodeId) || [])];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        reverseAdjacency.get(current)?.forEach((upstreamId) => {
            if (!visited.has(upstreamId)) {
                stack.push(upstreamId);
            }
        });
    }

    return visited;
};

export const getOutputRegistry = (nodes: EditorNode[]): Record<string, OutputFieldDescriptor[]> => {
    const registry: Record<string, OutputFieldDescriptor[]> = {};
    nodes.forEach((node) => {
        registry[node.id] = getDeclaredOutputs(node);
    });
    return registry;
};

export const getScopedOutputSuggestions = (
    nodes: EditorNode[],
    edges: EditorEdge[],
    nodeId: string,
) => {
    const upstreamNodeIds = collectUpstreamNodeIds(nodes, edges, nodeId);

    return nodes
        .filter((node) => node.id !== nodeId && upstreamNodeIds.has(node.id))
        .flatMap((node) => {
            const referenceName = getNodeReferenceName(node);
            return getDeclaredOutputs(node).map((field) => ({
                ...field,
                path: `${referenceName}.${field.path}`,
                label: `${referenceName}.${field.path}`,
                key: `${referenceName}.${field.key}`,
            }));
        });
};

export const extractBindingReferences = (value: unknown): BindingReference[] => {
    if (typeof value !== 'string') return [];

    const references: BindingReference[] = [];
    const matches = value.matchAll(REFERENCE_PATTERN);
    for (const match of matches) {
        const nodeId = match[1];
        const path = match[2];
        references.push({
            expression: match[0],
            nodeId,
            path,
        });
    }
    return references;
};
