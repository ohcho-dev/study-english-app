/**
 * AI Lab feature types
 */

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent {
    id: string;
    role_name: string;
    prompt: string;
    order_index: number;
    created_at: string;
    updated_at: string;
}

export interface AgentCreate {
    role_name: string;
    prompt: string;
    order_index: number;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface Pipeline {
    id: string;
    name: string;
    description: string | null;
    system_prompt: string;
    agents: Agent[];
    created_at: string;
    updated_at: string;
}

export interface PipelineListItem {
    id: string;
    name: string;
    description: string | null;
    agent_count: number;
    created_at: string;
    updated_at: string;
}

export interface PipelineCreate {
    name: string;
    description?: string | null;
    system_prompt: string;
    agents: AgentCreate[];
}

export interface PipelineUpdate {
    name?: string | null;
    description?: string | null;
    system_prompt?: string | null;
    agents?: AgentCreate[] | null;
}

// ============================================================================
// Experiment Types
// ============================================================================

export type DataTransferMode = 'A' | 'B';
export type ModelName =
    | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
    | 'gemini-2.5-pro' | 'gemini-2.5-flash'
    | 'gemini-2.0-flash'
    | 'gpt-4o' | 'gpt-4-turbo';
export type FileType = 'image' | 'video' | 'audio';

export interface AttachedFile {
    type: FileType;
    url: string;
    name: string;
}

export interface AgentModelOverride {
    agent_id: string;
    model_name: string;
}

export interface ExperimentRunRequest {
    pipeline_id: string;
    model_name: ModelName;
    data_transfer_mode: DataTransferMode;
    include_original_input?: boolean;
    user_input: string;
    attached_files?: AttachedFile[] | null;
    generate_audio?: boolean;
    tts_model?: string;
    tts_voice?: string;
    agent_models?: AgentModelOverride[] | null;
}

export interface StepResult {
    step_index: number;
    agent_role: string;
    output: string;
    input_tokens: number;
    output_tokens: number;
    execution_time_ms: number;
}

export interface ExperimentRunResponse {
    log_id: string;
    steps: StepResult[];
    final_result: string;
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_usd: number;
    execution_time_ms: number;
    audio_url?: string | null;
    audio_base64?: string | null;
}

// ============================================================================
// Log Types
// ============================================================================

export interface ExperimentLogSummary {
    id: string;
    pipeline_id: string | null;
    pipeline_name: string | null;
    model_name: string;
    data_transfer_mode: DataTransferMode;
    include_original_input: boolean;
    generate_audio: boolean;
    total_tokens: number;
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_usd: number;
    execution_time_ms: number;
    created_at: string;
}

export interface ExperimentLogStep {
    id: string;
    step_index: number;
    agent_role: string;
    agent_prompt: string;
    model_name?: string | null;
    input_data: string;
    output_data: string;
    input_tokens: number;
    output_tokens: number;
    execution_time_ms: number;
    created_at: string;
}

export interface ExperimentLogDetail extends Omit<ExperimentLogSummary, 'total_tokens'> {
    user_input: string;
    attached_files: AttachedFile[] | null;
    final_result: string;
    audio_url: string | null;
    audio_base64: string | null;
    steps: ExperimentLogStep[];
}

// ============================================================================
// Model Info
// ============================================================================

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    input_price_per_1m: number;
    output_price_per_1m: number;
    // Capability flags
    supports_multimodal: boolean;
    supports_audio_input?: boolean;
    supports_audio_output?: boolean;
    supports_native_audio?: boolean;
    supports_function_calling?: boolean;
    // Metadata
    category?: 'general' | 'tts' | 'audio' | 'vision';
    description?: string | null;
    use_cases?: string[];
    max_context_tokens?: number | null;
}

// ============================================================================
// Paginated Response
// ============================================================================

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    size: number;
    pages: number;
}
