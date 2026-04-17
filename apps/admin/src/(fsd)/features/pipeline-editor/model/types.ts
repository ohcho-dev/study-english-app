import type { Edge, Node, Viewport } from '@xyflow/react';

export type NodeType =
    | 'start'
    | 'end'
    | 'llm'
    | 'code'
    | 'router'
    | 'parallel'
    | 'merge'
    | 'ui_event'
    | 'delay';

export interface OutputFieldDescriptor {
    key: string;
    label: string;
    path: string;
    description?: string;
}

export interface StartNodeData {
    label: string;
    declared_outputs?: OutputFieldDescriptor[];
}

export interface EndNodeData {
    label: string;
    output_mapping: Record<string, string>;
    runtime_bindings?: Record<string, string>;
}

export interface LLMNodeData {
    label: string;
    model: string;
    prompt: string;
    temperature: number;
    max_output_tokens?: number;
    response_format?: 'text' | 'json';
    output_schema?: Record<string, unknown> | null;
    retry_count: number;
    timeout_ms: number;
    input_variables: Record<string, string>;
    declared_outputs?: OutputFieldDescriptor[];
}

export interface CodeNodeData {
    label: string;
    code: string;
    input_variables: Record<string, string>;
    timeout_ms: number;
    declared_outputs?: OutputFieldDescriptor[];
}

export type RouterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'regex';

export interface RouterRoute {
    id: string;
    label: string;
    condition: {
        operator: RouterOperator;
        value: string | number | boolean | string[];
    };
}

export interface RouterNodeData {
    label: string;
    input_variable: string;
    routes: RouterRoute[];
    default_route: string;
    declared_outputs?: OutputFieldDescriptor[];
}

export interface ParallelBranch {
    id: string;
    label: string;
    affects_turn_flow: boolean;
}

export interface ParallelNodeData {
    label: string;
    branches: ParallelBranch[];
    declared_outputs?: OutputFieldDescriptor[];
}

export interface MergeNodeData {
    label: string;
    merge_strategy: 'all' | 'first' | 'custom';
    custom_merge_expression?: string;
    timeout_ms: number;
    skip_sidecar_on_timeout: boolean;
    declared_outputs?: OutputFieldDescriptor[];
}

export interface UIEventNodeData {
    label: string;
    event_type: string;
    payload_template: Record<string, string>;
    target: 'session' | 'admin';
    declared_outputs?: OutputFieldDescriptor[];
}

export interface DelayNodeData {
    label: string;
    delay_ms: number | string;
    declared_outputs?: OutputFieldDescriptor[];
}

export type PipelineNodeData = Record<string, unknown>;

export type EditorNode = Node<PipelineNodeData, NodeType>;
export type EditorEdge = Edge;

export interface PipelineGraph {
    nodes: EditorNode[];
    edges: EditorEdge[];
    viewport: Viewport;
}

export interface VisualPipeline {
    id: string;
    name: string;
    description: string | null;
    graph_json: PipelineGraph;
    version: number;
    status: 'draft' | 'published' | 'archived' | string;
    timeout_ms: number;
    created_at: string;
    updated_at: string;
}

export interface VisualPipelineListItem {
    id: string;
    name: string;
    description: string | null;
    version: number;
    status: string;
    node_count: number;
    edge_count: number;
    created_at: string;
    updated_at: string;
}

export interface VisualPipelineVersion {
    id: string;
    pipeline_id: string;
    version: number;
    graph_json: PipelineGraph;
    change_reason: string | null;
    timeout_ms: number;
    created_at: string;
}

export interface CreateVisualPipelineRequest {
    name: string;
    description?: string | null;
    graph_json: PipelineGraph;
    timeout_ms?: number;
}

export interface UpdateVisualPipelineRequest {
    name?: string;
    description?: string | null;
    graph_json?: PipelineGraph;
    timeout_ms?: number;
}

export interface ValidateResponse {
    valid: boolean;
    errors: string[];
}

export interface NodeExecutionLog {
    trace_id: string;
    node_id: string;
    node_type: string;
    node_label?: string | null;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | string;
    input_json?: Record<string, unknown> | null;
    output_json?: Record<string, unknown> | null;
    duration_ms?: number | null;
    model_name?: string | null;
    prompt_used?: string | null;
    error_message?: string | null;
    created_at?: string | null;
}

export interface TestRunResponse {
    trace_id: string;
    result: Record<string, unknown>;
    node_logs: NodeExecutionLog[];
    total_duration_ms: number;
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_usd: number;
}

export interface PipelineExecutionTraceSummary {
    trace_id: string;
    session_id?: string | null;
    pipeline_id: string;
    pipeline_version: number;
    turn_index: number;
    node_count: number;
    failure_count: number;
    created_at: string;
}

export interface PipelineExecutionTraceDetail {
    trace_id: string;
    logs: NodeExecutionLog[];
}

export interface TemplatePipelineLink {
    id: string;
    template_id: string;
    pipeline_id: string;
    pipeline_version?: number | null;
    pipeline_name: string;
    pipeline_status: string;
    created_at: string;
    updated_at: string;
}
