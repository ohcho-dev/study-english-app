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
        llmModel?: string;
        ttsProvider?: string;
        ttsModel?: string;
        difficulty?: number;
        estimatedMinutes?: number;
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
    if (options.llmModel) {
        formData.append('llm_model', options.llmModel);
    }
    if (options.ttsProvider) {
        formData.append('tts_provider', options.ttsProvider);
    }
    if (options.ttsModel) {
        formData.append('tts_model', options.ttsModel);
    }
    if (options.difficulty) {
        formData.append('difficulty', options.difficulty.toString());
    }
    if (options.estimatedMinutes) {
        formData.append('estimated_minutes', options.estimatedMinutes.toString());
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
