import type { Connection, Viewport } from '@xyflow/react';

import type {
    EditorEdge,
    EditorNode,
    EndNodeData,
    NodeType,
    ParallelNodeData,
    PipelineGraph,
    PipelineNodeData,
} from './types';

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.9 };

export const NODE_LABELS: Record<NodeType, string> = {
    start: '시작',
    end: '종료',
    llm: 'LLM',
    code: '코드',
    router: '라우터',
    parallel: '병렬',
    merge: '병합',
    ui_event: 'UI 이벤트',
    delay: '지연',
};

export const NODE_DESCRIPTIONS: Record<NodeType, string> = {
    start: '세션 문맥 또는 테스트 입력 JSON이 시작됩니다.',
    end: '세션용 출력 계약을 완성합니다.',
    llm: '모델을 호출해 JSON 또는 텍스트를 생성합니다.',
    code: '파이썬 코드로 데이터를 변환합니다.',
    router: '조건에 따라 다음 분기를 선택합니다.',
    parallel: '여러 브랜치를 동시에 실행합니다.',
    merge: '분기 결과를 하나로 합칩니다.',
    ui_event: '모바일 또는 어드민으로 이벤트를 보냅니다.',
    delay: '다음 단계 전까지 의도적으로 대기합니다.',
};

export const getDefaultNodeData = (type: NodeType): PipelineNodeData => {
    switch (type) {
        case 'start':
            return {
                label: '사용자 입력',
                declared_outputs: [
                    { key: 'input_json', label: '테스트 입력 JSON', path: 'input_json' },
                    { key: 'transcript', label: '사용자 발화', path: 'transcript' },
                    { key: 'history', label: '대화 이력', path: 'history' },
                    { key: 'topic', label: '주제', path: 'topic' },
                    { key: 'scene_context', label: '장면 문맥', path: 'scene_context' },
                    { key: 'participants', label: '참여자 목록', path: 'participants' },
                    { key: 'measured_wpm', label: '실측 WPM', path: 'measured_wpm' },
                    { key: 'response_delay_sec', label: '응답 지연', path: 'response_delay_sec' },
                ],
            };
        case 'end':
            return {
                label: '파이프라인 출력',
                output_mapping: {},
                runtime_bindings: {},
            } satisfies EndNodeData;
        case 'llm':
            return {
                label: 'LLM 노드',
                model: 'gemini-2.5-flash',
                prompt: '역할과 목표를 설명하고 필요한 출력 형식을 정의하세요.',
                temperature: 0,
                retry_count: 2,
                timeout_ms: 10000,
                response_format: 'json',
                output_schema: {
                    type: 'object',
                    properties: {
                        result: { type: 'string' },
                    },
                },
                input_variables: {
                    transcript: '{{start.transcript}}',
                },
                declared_outputs: [],
            };
        case 'code':
            return {
                label: '코드 노드',
                code: [
                    'async def execute(inputs):',
                    '    text = inputs.get("transcript", "")',
                    '    return {"result": {"text": text, "length": len(text)}}',
                ].join('\n'),
                input_variables: { transcript: '{{start.transcript}}' },
                timeout_ms: 5000,
                declared_outputs: [
                    { key: 'result.text', label: '결과 텍스트', path: 'result.text' },
                    { key: 'result.length', label: '길이', path: 'result.length' },
                ],
            };
        case 'router':
            return {
                label: '조건 라우터',
                input_variable: '{{start.measured_wpm}}',
                routes: [
                    {
                        id: 'slow',
                        label: '속도 낮음',
                        condition: { operator: 'lt', value: 90 },
                    },
                    {
                        id: 'normal',
                        label: '일반 속도',
                        condition: { operator: 'gte', value: 90 },
                    },
                ],
                default_route: 'normal',
            };
        case 'parallel':
            return {
                label: '병렬 분석',
                branches: [
                    { id: 'main', label: '메인 흐름', affects_turn_flow: true },
                    { id: 'sidecar', label: '보조 로그', affects_turn_flow: false },
                ],
            } satisfies ParallelNodeData;
        case 'merge':
            return {
                label: '병합 노드',
                merge_strategy: 'all',
                timeout_ms: 12000,
                skip_sidecar_on_timeout: true,
            };
        case 'ui_event':
            return {
                label: 'UI 이벤트',
                event_type: 'pipeline:ui_update',
                payload_template: { message: '{{start.transcript}}' },
                target: 'session',
            };
        case 'delay':
            return {
                label: '지연 노드',
                delay_ms: 1000,
            };
    }
};

export const createEditorNode = (
    type: NodeType,
    position: { x: number; y: number },
    existingNodes: EditorNode[],
): EditorNode => {
    const count = existingNodes.filter((node) => node.type === type).length + 1;
    return {
        id: `${type}_${count}`,
        type,
        position,
        data: getDefaultNodeData(type),
    } as EditorNode;
};

export const buildDefaultGraph = (): PipelineGraph => ({
    nodes: [
        {
            id: 'start_1',
            type: 'start',
            position: { x: 80, y: 220 },
            data: getDefaultNodeData('start'),
        } as EditorNode,
        {
            id: 'end_1',
            type: 'end',
            position: { x: 960, y: 220 },
            data: getDefaultNodeData('end'),
        } as EditorNode,
    ],
    edges: [],
    viewport: DEFAULT_VIEWPORT,
});

export const createEdge = (connection: Connection, existingEdges: EditorEdge[]): EditorEdge => ({
    id: `edge_${existingEdges.length + 1}_${Date.now()}`,
    source: connection.source || '',
    target: connection.target || '',
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    type: 'animated',
    animated: true,
});
