/**
 * AI Lab API client
 */

import { api } from '@/shared/lib';

import type {
    ExperimentLogDetail,
    ExperimentLogSummary,
    ExperimentRunRequest,
    ExperimentRunResponse,
    ModelInfo,
    PaginatedResponse,
    Pipeline,
    PipelineCreate,
    PipelineListItem,
    PipelineUpdate,
} from '../model/types';

const AI_LAB_BASE = '/api/v1/ai-lab';

// ============================================================================
// Pipeline API
// ============================================================================

export const getPipelines = async (): Promise<PipelineListItem[]> => {
    return api.get<PipelineListItem[]>(`${AI_LAB_BASE}/pipelines`);
};

export const getPipeline = async (id: string): Promise<Pipeline> => {
    return api.get<Pipeline>(`${AI_LAB_BASE}/pipelines/${id}`);
};

export const createPipeline = async (data: PipelineCreate): Promise<Pipeline> => {
    return api.post<Pipeline>(`${AI_LAB_BASE}/pipelines`, data);
};

export const updatePipeline = async (
    id: string,
    data: PipelineUpdate
): Promise<Pipeline> => {
    return api.put<Pipeline>(`${AI_LAB_BASE}/pipelines/${id}`, data);
};

export const deletePipeline = async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`${AI_LAB_BASE}/pipelines/${id}`);
};

// ============================================================================
// Experiment API
// ============================================================================

export const runExperiment = async (
    data: ExperimentRunRequest
): Promise<ExperimentRunResponse> => {
    return api.post<ExperimentRunResponse>(`${AI_LAB_BASE}/experiments/run`, data);
};

// ============================================================================
// Log API
// ============================================================================

export const getExperimentLogs = async (
    page = 1,
    size = 20,
    pipelineId?: string
): Promise<PaginatedResponse<ExperimentLogSummary>> => {
    const params: Record<string, string> = {
        page: page.toString(),
        size: size.toString(),
    };
    if (pipelineId) {
        params.pipeline_id = pipelineId;
    }
    return api.get<PaginatedResponse<ExperimentLogSummary>>(
        `${AI_LAB_BASE}/experiments/logs`,
        { params }
    );
};

export const getExperimentLogDetail = async (
    id: string
): Promise<ExperimentLogDetail> => {
    return api.get<ExperimentLogDetail>(`${AI_LAB_BASE}/experiments/logs/${id}`);
};

// ============================================================================
// Model API
// ============================================================================

export const getModels = async (): Promise<ModelInfo[]> => {
    return api.get<ModelInfo[]>(`${AI_LAB_BASE}/models`);
};

// ============================================================================
// Upload API
// ============================================================================

export const uploadFile = async (
    file: File
): Promise<{ url: string; type: string; name: string; size_bytes: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${AI_LAB_BASE}/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
};
