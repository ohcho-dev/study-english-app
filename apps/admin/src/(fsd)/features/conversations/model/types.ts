/**
 * Conversation Scenario Validation - Type Definitions
 */

// ============================================================================
// Enums
// ============================================================================

export type ConversationMode = 'turn_based' | 'free_form';
export type ParticipantType = 'moderator' | 'ai' | 'user';
export type SessionStatus = 'active' | 'waiting_user' | 'paused' | 'completed' | 'error';
export type TurnType = 'system' | 'moderator' | 'ai' | 'user';
export type FirstSpeaker = 'moderator_first' | 'ai_first' | 'user_first';

// ============================================================================
// Voice Settings
// ============================================================================

export interface VoiceSettings {
    speaking_rate?: number;
    pitch?: number;
    volume_gain_db?: number;
}

export interface VoiceInfo {
    id: string;
    name: string;
    gender: 'MALE' | 'FEMALE';
    language: string;
    type: 'WaveNet' | 'Neural2' | 'Polyglot';
}

// ============================================================================
// Participant
// ============================================================================

export interface Participant {
    id: string;
    template_id: string;
    participant_type: ParticipantType;
    name: string;
    persona: string | null;
    voice_id: string | null;
    voice_settings: VoiceSettings | null;
    order_index: number;
    // My Turn additions
    difficulty: number | null;
    greeting_message: string | null;
    avatar_url: string | null;
    // Model selection (admin-saved)
    llm_model: string | null;
    stt_model: string | null;
    stt_mode: string | null;
    stt_streaming_display: string | null;
    tts_model: string | null;
    tts_provider: string | null;
    created_at: string;
    updated_at: string;
}

export interface ParticipantCreate {
    id?: string;
    participant_type: ParticipantType;
    name: string;
    persona?: string;
    voice_id?: string;
    voice_settings?: VoiceSettings;
    order_index: number;
    // My Turn additions
    difficulty?: number;
    greeting_message?: string;
    avatar_url?: string;
    // Model selection (admin-saved defaults)
    llm_model?: string;
    stt_model?: string;
    stt_mode?: string;
    stt_streaming_display?: string;
    tts_model?: string;
    tts_provider?: string;
}

export interface ScenarioStep {
    speaker_index: number;
    instruction?: string;
}

// ============================================================================
// Template
// ============================================================================

export interface Template {
    id: string;
    name: string;
    description: string | null;
    mode: ConversationMode;
    system_prompt: string;
    greeting_message: string | null;
    topic: string | null;
    difficulty: number | null;
    estimated_minutes: number | null;
    is_active: boolean;
    // My Turn additions
    first_speaker: FirstSpeaker;
    scene_context: string | null;
    // Director Settings
    director_system_prompt: string | null;
    director_llm_model?: string | null;
    turn_sequence: ScenarioStep[] | null;
    participants: Participant[];
    // v0.2 Pipeline
    evaluator_llm_model?: string | null;
    planner_llm_model?: string | null;
    conductor_llm_model?: string | null;
    level_definitions?: Array<{ level: number; name: string; description: string; instruction: string }> | null;
    created_at: string;
    updated_at: string;
}

export interface TemplateListItem {
    id: string;
    name: string;
    description: string | null;
    mode: ConversationMode;
    topic: string | null;
    difficulty: number | null;
    participant_count: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TemplateCreate {
    name: string;
    description?: string;
    mode?: ConversationMode;
    system_prompt: string;
    greeting_message?: string;
    topic?: string;
    difficulty?: number;
    estimated_minutes?: number;
    is_active?: boolean;
    // My Turn additions
    first_speaker?: FirstSpeaker;
    scene_context?: string;
    // Director Settings
    director_system_prompt?: string;
    turn_sequence?: ScenarioStep[];
    participants?: ParticipantCreate[];
    director_llm_model?: string;
    // v0.2 Pipeline
    pipeline_mode?: string;
    evaluator_prompt?: string;
    planner_prompt?: string;
    conductor_prompt?: string;
    evaluator_llm_model?: string;
    planner_llm_model?: string;
    conductor_llm_model?: string;
    level_definitions?: Array<{ level: number; name: string; description: string; instruction: string }>;
}

export interface TemplateUpdate {
    name?: string;
    description?: string;
    mode?: ConversationMode;
    system_prompt?: string;
    greeting_message?: string;
    topic?: string;
    difficulty?: number;
    estimated_minutes?: number;
    is_active?: boolean;
    // My Turn additions
    first_speaker?: FirstSpeaker;
    scene_context?: string;
    // Director Settings
    director_system_prompt?: string;
    turn_sequence?: ScenarioStep[];
    participants?: ParticipantCreate[];
    director_llm_model?: string;
    // v0.2 Pipeline
    pipeline_mode?: string;
    evaluator_prompt?: string;
    planner_prompt?: string;
    conductor_prompt?: string;
    evaluator_llm_model?: string;
    planner_llm_model?: string;
    conductor_llm_model?: string;
    level_definitions?: Array<{ level: number; name: string; description: string; instruction: string }>;
}

// ============================================================================
// Session
// ============================================================================

export interface Session {
    id: string;
    template_id: string | null;
    template_name: string | null;
    status: SessionStatus;
    current_turn_index: number;
    current_speaker_id: string | null;
    started_at: string;
    ended_at: string | null;
    device_type: string | null;
    browser: string | null;
    experiment_type: string | null;
    variant: string | null;
    difficulty: number | null;
    estimated_minutes: number | null;
    error_message: string | null;
    // My Turn additions
    user_name: string | null;
    current_speaker_type: string | null;
    created_at: string;
    updated_at: string;
}

export interface SessionListItem {
    id: string;
    template_id: string | null;
    template_name: string | null;
    status: SessionStatus;
    turn_count: number;
    started_at: string;
    ended_at: string | null;
    device_type: string | null;
    experiment_type: string | null;
    variant: Record<string, unknown> | null;
    // Latency metrics (averages in ms)
    e2e_avg_ms: number | null;
    asr_avg_ms: number | null;
    network_transit_avg_ms: number | null;
    llm_avg_ms: number | null;
    tts_avg_ms: number | null;
    client_load_avg_ms: number | null;
}

export interface SessionCreate {
    template_id: string;
    device_type?: string;
    browser?: string;
    variant?: string;
    difficulty?: number;
    estimated_minutes?: number;
    // My Turn additions
    user_name?: string;
}

// ============================================================================
// Turn
// ============================================================================

export interface Turn {
    id: string;
    session_id: string;
    turn_index: number;
    turn_type: TurnType;
    speaker_name: string | null;
    content_text: string | null;
    audio_url: string | null;
    audio_duration_ms: number | null;
    t0_user_end: number | null;
    t1_asr_final: number | null;
    t1_5_llm_start: number | null;
    t2_llm_final: number | null;
    t2_5_tts_ready: number | null;
    t3_audio_play_start: number | null;
    // Computed latencies (ms)
    asr_latency_ms: number | null;
    network_transit_ms: number | null;
    llm_latency_ms: number | null;
    tts_latency_ms: number | null;
    client_load_ms: number | null;
    e2e_latency_ms: number | null;
    // Metadata
    model_name: string | null;
    stt_provider: string | null;
    stt_model: string | null;
    tts_provider: string | null;
    tts_voice: string | null;
    // Accuracy
    reference_text: string | null;
    wer: number | null;
    cer: number | null;
    created_at: string;
}

// ============================================================================
// RUN0 Voice Processing
// ============================================================================

export interface Run0VoiceResponse {
    session_id: string;
    turn_id: string;
    transcript: string;
    reply_text: string;
    audio_url: string | null;
    audio_base64: string | null;
    t1_asr_final: number;
    t2_llm_final: number;
    t2_5_tts_ready: number;
    asr_latency_ms: number;
    network_transit_ms: number;
    llm_latency_ms: number;
    tts_latency_ms: number;
    server_total_ms: number;
    // Phase 1: accuracy metrics
    stt_confidence?: number;
    recognition_api?: 'v1' | 'v2';
    // WER/CER accuracy
    reference_text?: string;
    wer?: number;
    cer?: number;
}

export interface Run0LogRequest {
    session_id: string;
    turn_id: string;
    t3_audio_play_start: number;
}

export interface Run0LogResponse {
    success: boolean;
    e2e_latency_ms: number;
}

// My Turn - Greeting Response
export interface GreetingResponse {
    greeting_text: string | null;
    audio_url: string | null;
    audio_base64: string | null;
    speaker_name: string | null;
    speaker_type: ParticipantType | null;
    audio_duration_ms: number | null;
}

export interface DirectorPromptSpec {
    base_prompt: string;
    output_format: string;
}

// ============================================================================
// Metrics
// ============================================================================

export interface SessionMetrics {
    id: string;
    session_id: string;
    e2e_avg_ms: number | null;
    e2e_p50_ms: number | null;
    e2e_p95_ms: number | null;
    asr_avg_ms: number | null;
    network_transit_avg_ms: number | null;
    llm_avg_ms: number | null;
    tts_avg_ms: number | null;
    client_load_avg_ms: number | null;
    total_turns: number;
    user_turns: number;
    asr_retry_count: number;
    error_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_usd: number;
    created_at: string;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    size: number;
    pages: number;
}
