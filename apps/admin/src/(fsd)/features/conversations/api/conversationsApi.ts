/**
 * Conversations API client
 */

import { api } from '@/shared/lib';

import type {
    GreetingResponse,
    PaginatedResponse,
    Run0LogRequest,
    Run0LogResponse,
    Run0VoiceResponse,
    Session,
    SessionCreate,
    SessionListItem,
    SessionMetrics,
    Template,
    TemplateCreate,
    TemplateListItem,
    TemplateUpdate,
    Turn,
    VoiceInfo,
    DirectorPromptSpec,
} from '../model/types';

const CONVERSATIONS_BASE = '/api/v1/conversations';

// ============================================================================
// Template API
// ============================================================================

export const getTemplates = async (
    page = 1,
    size = 20,
    activeOnly = true
): Promise<PaginatedResponse<TemplateListItem>> => {
    return api.get<PaginatedResponse<TemplateListItem>>(`${CONVERSATIONS_BASE}/templates`, {
        params: {
            page: page.toString(),
            size: size.toString(),
            active_only: activeOnly.toString(),
        },
    });
};

export const getTemplate = async (id: string): Promise<Template> => {
    return api.get<Template>(`${CONVERSATIONS_BASE}/templates/${id}`);
};

export const createTemplate = async (data: TemplateCreate): Promise<Template> => {
    return api.post<Template>(`${CONVERSATIONS_BASE}/templates`, data);
};

export const updateTemplate = async (
    id: string,
    data: TemplateUpdate
): Promise<Template> => {
    return api.patch<Template>(`${CONVERSATIONS_BASE}/templates/${id}`, data);
};

export const deleteTemplate = async (id: string): Promise<void> => {
    await api.delete(`${CONVERSATIONS_BASE}/templates/${id}`);
};

export const duplicateTemplate = async (
    id: string,
    newName: string
): Promise<Template> => {
    return api.post<Template>(`${CONVERSATIONS_BASE}/templates/${id}/duplicate`, null, {
        params: { new_name: newName },
    });
};

// ============================================================================
// Session API
// ============================================================================

export const getSessions = async (
    page = 1,
    size = 20,
    templateId?: string,
    status?: string
): Promise<PaginatedResponse<SessionListItem>> => {
    const params: Record<string, string> = {
        page: page.toString(),
        size: size.toString(),
    };
    if (templateId) params.template_id = templateId;
    if (status) params.status = status;

    return api.get<PaginatedResponse<SessionListItem>>(`${CONVERSATIONS_BASE}/sessions`, {
        params,
    });
};

export const getSession = async (id: string): Promise<Session> => {
    return api.get<Session>(`${CONVERSATIONS_BASE}/sessions/${id}`);
};

export const createSession = async (data: SessionCreate): Promise<Session> => {
    return api.post<Session>(`${CONVERSATIONS_BASE}/sessions`, data);
};

export const endSession = async (
    id: string,
    status: 'completed' | 'error' | 'paused' = 'completed',
    errorMessage?: string
): Promise<Session> => {
    const params: Record<string, string> = { status };
    if (errorMessage) params.error_message = errorMessage;

    return api.post<Session>(`${CONVERSATIONS_BASE}/sessions/${id}/end`, null, { params });
};

export const exportSessions = async (sessionIds: string[]): Promise<void> => {
    // We need to use raw fetch here because api.post expects JSON response,
    // but we are getting a blob (Excel file).
    const response = await fetch(`${API_BASE_URL}${CONVERSATIONS_BASE}/sessions/export`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(sessionIds),
    });

    if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
    }

    // Handle Blob download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export const getSessionTurns = async (sessionId: string): Promise<Turn[]> => {
    return api.get<Turn[]>(`${CONVERSATIONS_BASE}/sessions/${sessionId}/turns`);
};

export const getSessionMetrics = async (sessionId: string): Promise<SessionMetrics> => {
    return api.get<SessionMetrics>(`${CONVERSATIONS_BASE}/sessions/${sessionId}/metrics`);
};

/**
 * Generate and fetch greeting audio for a session's first speaker
 */
export const generateGreeting = async (
    sessionId: string,
    options?: {
        voiceId?: string;
        customGreeting?: string;
    }
): Promise<GreetingResponse> => {
    const params = new URLSearchParams();
    if (options?.voiceId) params.append('voice_id', options.voiceId);
    if (options?.customGreeting) params.append('custom_greeting', options.customGreeting);

    const queryString = params.toString();
    const url = `${CONVERSATIONS_BASE}/sessions/${sessionId}/greeting${queryString ? `?${queryString}` : ''}`;
    return api.post<GreetingResponse>(url, null);
};

// ============================================================================
// RUN0 Voice API
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const processVoice = async (
    audioBlob: Blob,
    t0UserEnd: number,
    options: {
        sessionId?: string;
        templateId?: string;
        voiceId?: string;
        systemPrompt?: string;
        sttModel?: string;
        sttMode?: string;
        llmModel?: string;
        ttsProvider?: string;
        ttsModel?: string;
        ttsMode?: string;
        referenceText?: string;
        difficulty?: number;
        estimatedMinutes?: number;
        warmupIterations?: number;
    }
): Promise<Run0VoiceResponse> => {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.webm');
    formData.append('t0_user_end', t0UserEnd.toString());

    if (options.sessionId) {
        formData.append('session_id', options.sessionId);
    }
    if (options.templateId) {
        formData.append('template_id', options.templateId);
    }
    if (options.voiceId) {
        formData.append('voice_id', options.voiceId);
    }
    if (options.systemPrompt) {
        formData.append('system_prompt', options.systemPrompt);
    }
    if (options.sttModel) {
        formData.append('stt_model', options.sttModel);
    }
    if (options.sttMode) {
        formData.append('stt_mode', options.sttMode);
    }
    if (options.llmModel) {
        formData.append('llm_model', options.llmModel);
    }
    if (options.ttsProvider) {
        formData.append('tts_provider', options.ttsProvider);
    }
    if (options.ttsModel) {
        formData.append('tts_model', options.ttsModel);
    }
    if (options.ttsMode) {
        formData.append('tts_mode', options.ttsMode);
    }
    if (options.referenceText) {
        formData.append('reference_text', options.referenceText);
    }
    if (options.difficulty) {
        formData.append('difficulty', options.difficulty.toString());
    }
    if (options.estimatedMinutes) {
        formData.append('estimated_minutes', options.estimatedMinutes.toString());
    }
    if (options.warmupIterations !== undefined) {
        formData.append('warmup_iterations', options.warmupIterations.toString());
    }

    const response = await fetch(`${API_BASE_URL}${CONVERSATIONS_BASE}/run0/voice`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Request failed: ${response.status}`);
    }

    return response.json();
};

/**
 * Process pre-transcribed text through LLM → TTS pipeline.
 * Used in streaming STT mode where transcript is already available.
 */
export const processText = async (
    transcript: string,
    t0UserEnd: number,
    t1AsrFinal: number,
    options: {
        sessionId?: string;
        voiceId?: string;
        systemPrompt?: string;
        sttModel?: string;
        sttMode?: string;
        llmModel?: string;
        ttsProvider?: string;
        ttsModel?: string;
        ttsMode?: string;
        referenceText?: string;
        warmupIterations?: number;
        sttConfidence?: number;
        sttLatencyMs?: number;
        serverFinalTimestampMs?: number;
    }
): Promise<Run0VoiceResponse> => {
    const formData = new FormData();
    formData.append('transcript', transcript);
    formData.append('t0_user_end', t0UserEnd.toString());
    formData.append('t1_asr_final', t1AsrFinal.toString());

    if (options.sessionId) formData.append('session_id', options.sessionId);
    if (options.voiceId) formData.append('voice_id', options.voiceId);
    if (options.systemPrompt) formData.append('system_prompt', options.systemPrompt);
    if (options.sttModel) formData.append('stt_model', options.sttModel);
    if (options.sttMode) formData.append('stt_mode', options.sttMode || 'streaming');
    if (options.llmModel) formData.append('llm_model', options.llmModel);
    if (options.ttsProvider) formData.append('tts_provider', options.ttsProvider);
    if (options.ttsModel) formData.append('tts_model', options.ttsModel);
    if (options.ttsMode) formData.append('tts_mode', options.ttsMode);
    if (options.referenceText) formData.append('reference_text', options.referenceText);
    if (options.warmupIterations !== undefined) {
        formData.append('warmup_iterations', options.warmupIterations.toString());
    }
    if (options.sttConfidence !== undefined) {
        formData.append('stt_confidence', options.sttConfidence.toString());
    }
    if (options.sttLatencyMs !== undefined) {
        formData.append('stt_latency_ms', options.sttLatencyMs.toString());
    }
    if (options.serverFinalTimestampMs !== undefined) {
        formData.append('server_final_timestamp_ms', options.serverFinalTimestampMs.toString());
    }

    const response = await fetch(`${API_BASE_URL}${CONVERSATIONS_BASE}/run0/text`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Request failed: ${response.status}`);
    }

    return response.json();
};

export const logClientTimestamp = async (
    request: Run0LogRequest
): Promise<Run0LogResponse> => {
    return api.post<Run0LogResponse>(`${CONVERSATIONS_BASE}/run0/log`, request);
};

export const getTestPhrases = async (): Promise<string[]> => {
    return api.get<string[]>(`${CONVERSATIONS_BASE}/run0/test-phrases`);
};

// ============================================================================
// Voice Configuration API
// ============================================================================

export const getAvailableVoices = async (): Promise<VoiceInfo[]> => {
    return api.get<VoiceInfo[]>(`${CONVERSATIONS_BASE}/voices`);
};

// ============================================================================
// Director API
// ============================================================================

export const getDirectorPromptSpec = async (): Promise<DirectorPromptSpec> => {
    return api.get<DirectorPromptSpec>(`${CONVERSATIONS_BASE}/director-prompt-spec`);
};

// ============================================================================
// RUN0 Model Options API
// ============================================================================

export interface ModelOption {
    id: string;
    name: string;
    description?: string;
    provider?: string;
    category?: string;
    gender?: string;
    language?: string;
    type?: string;
}

export interface TTSProvider {
    id: string;
    name: string;
    description: string;
    voices: ModelOption[];
    models?: ModelOption[];
}

export interface TTSOptionsResponse {
    providers: TTSProvider[];
}

export const getSTTModels = async (): Promise<ModelOption[]> => {
    return api.get<ModelOption[]>(`${CONVERSATIONS_BASE}/run0/models/stt`);
};

export const getLLMModels = async (): Promise<ModelOption[]> => {
    return api.get<ModelOption[]>(`${CONVERSATIONS_BASE}/run0/models/llm`);
};

export const getTTSOptions = async (): Promise<TTSOptionsResponse> => {
    return api.get<TTSOptionsResponse>(`${CONVERSATIONS_BASE}/run0/models/tts`);
};

// ============================================================================
// My Turn Stage API (Phase 2-4)
// ============================================================================

/** Save per-participant model settings to template (admin only) */
export const saveParticipantModels = async (
    templateId: string,
    models: Array<{
        participant_id: string;
        llm_model?: string;
        stt_model?: string;
        stt_mode?: string;
        stt_streaming_display?: string;
        tts_model?: string;
        tts_provider?: string;
        voice_id?: string;
        speaking_rate?: number;
        difficulty?: number;
    }>
): Promise<{ updated: string[]; count: number }> => {
    return api.put<{ updated: string[]; count: number }>(
        `${CONVERSATIONS_BASE}/templates/${templateId}/participant-models`,
        models
    );
};

/** Send text input instead of audio (text mode) */
export const sendTextInput = async (
    sessionId: string,
    text: string,
    t0UserEnd?: number,
    t1ServerFinal?: number,
): Promise<{ transcript: string; next_turn: number }> => {
    const formData = new FormData();
    formData.append('text', text);
    if (t0UserEnd) formData.append('t0_user_end', t0UserEnd.toString());
    if (t1ServerFinal) formData.append('t1_server_final', t1ServerFinal.toString());

    const response = await fetch(
        `${API_BASE_URL}${CONVERSATIONS_BASE}/sessions/${sessionId}/text`,
        { method: 'POST', body: formData }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Request failed: ${response.status}`);
    }

    return response.json();
};
