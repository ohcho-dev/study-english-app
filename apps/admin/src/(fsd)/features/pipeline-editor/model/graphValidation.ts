import type { EditorEdge, EditorNode } from './types';

export interface GraphWarning {
    id: string;
    level: 'warning' | 'error';
    message: string;
    nodeId?: string;
}

const REQUIRED_END_OUTPUT_KEYS = [
    'feedback_text',
    'feedback_instruction',
    'level',
    'level_instruction',
    'corrections',
    'better_expressions',
    'speaker_scripts',
    'user_emotion',
    'question_progress',
    'energy_flow',
    'engine_trace',
];

const getNodeLabel = (node: EditorNode | undefined) => {
    if (!node) return '알 수 없는 노드';
    const label = typeof node.data?.label === 'string' ? node.data.label : null;
    return label || node.id;
};

const buildAdjacency = (nodes: EditorNode[], edges: EditorEdge[]) => {
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

const collectReachable = (startIds: string[], adjacency: Map<string, Set<string>>) => {
    const visited = new Set<string>();
    const stack = [...startIds];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        adjacency.get(current)?.forEach((target) => {
            if (!visited.has(target)) {
                stack.push(target);
            }
        });
    }

    return visited;
};

const hasCycle = (nodes: EditorNode[], adjacency: Map<string, Set<string>>, reverseAdjacency: Map<string, Set<string>>) => {
    const indegree = new Map<string, number>();
    nodes.forEach((node) => indegree.set(node.id, reverseAdjacency.get(node.id)?.size || 0));

    const queue = nodes
        .filter((node) => (indegree.get(node.id) || 0) === 0)
        .map((node) => node.id);

    let visitedCount = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        visitedCount += 1;
        adjacency.get(current)?.forEach((target) => {
            const nextIndegree = (indegree.get(target) || 0) - 1;
            indegree.set(target, nextIndegree);
            if (nextIndegree === 0) {
                queue.push(target);
            }
        });
    }

    return visitedCount !== nodes.length;
};

export const getGraphWarnings = (nodes: EditorNode[], edges: EditorEdge[]): GraphWarning[] => {
    const warnings: GraphWarning[] = [];
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const startNodes = nodes.filter((node) => node.type === 'start');
    const endNodes = nodes.filter((node) => node.type === 'end');

    if (startNodes.length !== 1) {
        warnings.push({
            id: 'start-node-count',
            level: 'error',
            message: `시작 노드는 정확히 1개여야 합니다. 현재 ${startNodes.length}개입니다.`,
        });
    }

    if (endNodes.length !== 1) {
        warnings.push({
            id: 'end-node-count',
            level: 'error',
            message: `종료 노드는 정확히 1개여야 합니다. 현재 ${endNodes.length}개입니다.`,
        });
    }

    edges.forEach((edge) => {
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
            warnings.push({
                id: `broken-edge-${edge.id}`,
                level: 'error',
                message: '존재하지 않는 노드를 가리키는 엣지가 있습니다.',
            });
        }
    });

    const { adjacency, reverseAdjacency } = buildAdjacency(nodes, edges);

    if (nodes.length > 0 && hasCycle(nodes, adjacency, reverseAdjacency)) {
        warnings.push({
            id: 'cycle-detected',
            level: 'error',
            message: '사이클이 감지되었습니다. 실행 가능한 DAG 구조로 수정하세요.',
        });
    }

    const reachableFromStart = collectReachable(startNodes.map((node) => node.id), adjacency);
    const reachableToEnd = collectReachable(endNodes.map((node) => node.id), reverseAdjacency);

    nodes.forEach((node) => {
        const incomingCount = reverseAdjacency.get(node.id)?.size || 0;
        const outgoingCount = adjacency.get(node.id)?.size || 0;

        if (node.type !== 'start' && incomingCount === 0) {
            warnings.push({
                id: `no-input-${node.id}`,
                level: 'warning',
                nodeId: node.id,
                message: `${getNodeLabel(node)} 노드로 들어오는 엣지가 없습니다.`,
            });
        }

        if (node.type !== 'end' && outgoingCount === 0) {
            warnings.push({
                id: `no-output-${node.id}`,
                level: 'warning',
                nodeId: node.id,
                message: `${getNodeLabel(node)} 노드에서 이어지는 엣지가 없습니다.`,
            });
        }

        if (startNodes.length > 0 && !reachableFromStart.has(node.id)) {
            warnings.push({
                id: `unreachable-${node.id}`,
                level: 'warning',
                nodeId: node.id,
                message: `${getNodeLabel(node)} 노드는 시작 노드에서 도달할 수 없습니다.`,
            });
        }

        if (endNodes.length > 0 && !reachableToEnd.has(node.id)) {
            warnings.push({
                id: `cannot-end-${node.id}`,
                level: 'warning',
                nodeId: node.id,
                message: `${getNodeLabel(node)} 노드에서 종료 노드까지 이어지지 않습니다.`,
            });
        }

        switch (node.type) {
            case 'llm': {
                const model = typeof node.data?.model === 'string' ? node.data.model.trim() : '';
                const prompt = typeof node.data?.prompt === 'string' ? node.data.prompt.trim() : '';
                const responseFormat = node.data?.response_format;
                const outputSchema = node.data?.output_schema;

                if (!model) {
                    warnings.push({
                        id: `llm-model-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드에 모델이 지정되지 않았습니다.`,
                    });
                }
                if (!prompt) {
                    warnings.push({
                        id: `llm-prompt-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드에 프롬프트가 비어 있습니다.`,
                    });
                }
                if (responseFormat === 'json' && !outputSchema) {
                    warnings.push({
                        id: `llm-schema-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드는 JSON 응답 형식인데 출력 스키마가 없습니다.`,
                    });
                }
                break;
            }
            case 'code': {
                const code = typeof node.data?.code === 'string' ? node.data.code.trim() : '';
                if (!code) {
                    warnings.push({
                        id: `code-source-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드에 실행 코드가 없습니다.`,
                    });
                }
                break;
            }
            case 'router': {
                const inputVariable = typeof node.data?.input_variable === 'string' ? node.data.input_variable.trim() : '';
                const routes = Array.isArray(node.data?.routes) ? node.data.routes : [];
                const defaultRoute = typeof node.data?.default_route === 'string' ? node.data.default_route : '';

                if (!inputVariable) {
                    warnings.push({
                        id: `router-input-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드에 비교 대상 변수가 지정되지 않았습니다.`,
                    });
                }
                if (routes.length === 0) {
                    warnings.push({
                        id: `router-routes-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드에 라우트가 없습니다.`,
                    });
                }
                if (defaultRoute && !routes.some((route) => route.id === defaultRoute)) {
                    warnings.push({
                        id: `router-default-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 기본 라우트가 현재 라우트 목록에 없습니다.`,
                    });
                }
                break;
            }
            case 'parallel': {
                const branches = Array.isArray(node.data?.branches) ? node.data.branches : [];
                if (branches.length === 0) {
                    warnings.push({
                        id: `parallel-branches-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드에 병렬 브랜치가 없습니다.`,
                    });
                }
                break;
            }
            case 'merge': {
                const strategy = node.data?.merge_strategy;
                const customExpression = typeof node.data?.custom_merge_expression === 'string'
                    ? node.data.custom_merge_expression.trim()
                    : '';

                if (strategy === 'custom' && !customExpression) {
                    warnings.push({
                        id: `merge-expression-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드는 커스텀 병합 식이 필요합니다.`,
                    });
                }
                break;
            }
            case 'ui_event': {
                const eventType = typeof node.data?.event_type === 'string' ? node.data.event_type.trim() : '';
                if (!eventType) {
                    warnings.push({
                        id: `ui-event-type-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 이벤트 타입이 비어 있습니다.`,
                    });
                }
                break;
            }
            case 'delay': {
                const delayMs = node.data?.delay_ms;
                if (delayMs === null || delayMs === undefined || delayMs === '') {
                    warnings.push({
                        id: `delay-ms-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 지연 시간이 비어 있습니다.`,
                    });
                }
                break;
            }
            case 'end': {
                const mapping = node.data?.output_mapping && typeof node.data.output_mapping === 'object'
                    ? node.data.output_mapping as Record<string, unknown>
                    : {};

                const missingKeys = REQUIRED_END_OUTPUT_KEYS.filter((key) => !mapping[key]);
                if (missingKeys.length > 0) {
                    warnings.push({
                        id: `end-contract-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 출력 계약이 일부 비어 있습니다: ${missingKeys.join(', ')}`,
                    });
                }
                break;
            }
            default:
                break;
        }
    });

    return warnings;
};
