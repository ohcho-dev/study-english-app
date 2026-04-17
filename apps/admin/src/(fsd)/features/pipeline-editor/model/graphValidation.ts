import { buildAdjacencyMaps, collectUpstreamNodeIds, extractBindingReferences, getOutputRegistry } from './outputRegistry';
import type { EditorEdge, EditorNode } from './types';

export interface GraphWarning {
    id: string;
    level: 'warning' | 'error';
    message: string;
    nodeId?: string;
}

const getNodeLabel = (node: EditorNode | undefined) => {
    if (!node) return '알 수 없는 노드';
    const label = typeof node.data?.label === 'string' ? node.data.label : null;
    return label || node.id;
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
    const registry = getOutputRegistry(nodes);

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

    const { adjacency, reverseAdjacency } = buildAdjacencyMaps(nodes, edges);

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
        const upstreamNodeIds = collectUpstreamNodeIds(nodes, edges, node.id);
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
                const runtimeBindings = node.data?.runtime_bindings && typeof node.data.runtime_bindings === 'object'
                    ? node.data.runtime_bindings as Record<string, unknown>
                    : {};

                if (Object.keys(mapping).length === 0) {
                    warnings.push({
                        id: `end-contract-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 출력 매핑이 비어 있습니다.`,
                    });
                }

                if (Object.keys(runtimeBindings).length === 0) {
                    warnings.push({
                        id: `end-runtime-bindings-${node.id}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 세션 런타임 바인딩이 비어 있습니다.`,
                    });
                }

                Object.entries(runtimeBindings).forEach(([slot, target]) => {
                    if (typeof target !== 'string' || !target.trim()) {
                        warnings.push({
                            id: `end-runtime-binding-empty-${node.id}-${slot}`,
                            level: 'warning',
                            nodeId: node.id,
                            message: `${getNodeLabel(node)} 노드의 런타임 바인딩 ${slot} 값이 비어 있습니다.`,
                        });
                        return;
                    }

                    if (target.includes('{{')) {
                        warnings.push({
                            id: `end-runtime-binding-template-${node.id}-${slot}`,
                            level: 'warning',
                            nodeId: node.id,
                            message: `${getNodeLabel(node)} 노드의 런타임 바인딩 ${slot} 은 템플릿 식이 아니라 출력 키 경로여야 합니다.`,
                        });
                        return;
                    }

                    const topLevelKey = target.trim().split('.')[0];
                    if (topLevelKey && !(topLevelKey in mapping)) {
                        warnings.push({
                            id: `end-runtime-binding-missing-${node.id}-${slot}-${topLevelKey}`,
                            level: 'warning',
                            nodeId: node.id,
                            message: `${getNodeLabel(node)} 노드의 런타임 바인딩 ${slot} 이 존재하지 않는 출력 ${topLevelKey} 을 참조합니다.`,
                        });
                    }
                });
                break;
            }
            default:
                break;
        }

        const bindings = collectNodeBindings(node);
        bindings.forEach(({ label, value }) => {
            const references = extractBindingReferences(value);
            references.forEach((reference) => {
                const referencedNodeId = reference.nodeId === 'start'
                    ? startNodes[0]?.id
                    : reference.nodeId;

                if (!referencedNodeId || !nodeMap.has(referencedNodeId)) {
                    warnings.push({
                        id: `binding-missing-${node.id}-${label}-${reference.nodeId}-${reference.path}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 ${label}에서 존재하지 않는 출력 ${reference.expression} 을 참조합니다.`,
                    });
                    return;
                }

                if (!upstreamNodeIds.has(referencedNodeId)) {
                    warnings.push({
                        id: `binding-downstream-${node.id}-${label}-${reference.nodeId}-${reference.path}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 ${label}에서 upstream 이 아닌 출력 ${reference.expression} 을 참조합니다.`,
                    });
                    return;
                }

                const declaredPaths = new Set((registry[referencedNodeId] || []).map((field) => field.path));
                if (declaredPaths.size > 0 && !declaredPaths.has(reference.path)) {
                    warnings.push({
                        id: `binding-unregistered-${node.id}-${label}-${reference.nodeId}-${reference.path}`,
                        level: 'warning',
                        nodeId: node.id,
                        message: `${getNodeLabel(node)} 노드의 ${label}에서 등록되지 않은 출력 ${reference.expression} 을 참조합니다.`,
                    });
                }
            });
        });
    });

    return warnings;
};

const collectNodeBindings = (node: EditorNode): Array<{ label: string; value: unknown }> => {
    switch (node.type) {
        case 'llm':
        case 'code':
            return Object.entries((node.data?.input_variables as Record<string, unknown>) || {}).map(([key, value]) => ({
                label: `입력 변수 ${key}`,
                value,
            }));
        case 'router':
            return [{ label: '입력 변수', value: node.data?.input_variable }];
        case 'merge':
            return [{ label: '커스텀 병합 식', value: node.data?.custom_merge_expression }];
        case 'ui_event':
            return Object.entries((node.data?.payload_template as Record<string, unknown>) || {}).map(([key, value]) => ({
                label: `이벤트 페이로드 ${key}`,
                value,
            }));
        case 'delay':
            return [{ label: '지연 시간', value: node.data?.delay_ms }];
        case 'end':
            return Object.entries((node.data?.output_mapping as Record<string, unknown>) || {}).map(([key, value]) => ({
                label: `출력 매핑 ${key}`,
                value,
            }));
        default:
            return [];
    }
};
