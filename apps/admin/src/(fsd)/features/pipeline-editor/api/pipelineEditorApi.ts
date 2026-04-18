import { api } from '@/shared/lib';

import type {
    CreateVisualPipelineRequest,
    PipelineExecutionTraceDetail,
    PipelineExecutionTraceSummary,
    TemplatePipelineLink,
    TestRunResponse,
    UpdateVisualPipelineRequest,
    ValidateResponse,
    VisualPipeline,
    VisualPipelineListItem,
    VisualPipelineVersion,
} from '../model/types';

const VISUAL_PIPELINES_BASE = '/api/v1/visual-pipelines';

export const getVisualPipelines = async (status?: string): Promise<VisualPipelineListItem[]> => {
    const params = status ? { status } : undefined;
    return api.get<VisualPipelineListItem[]>(VISUAL_PIPELINES_BASE, { params });
};

export const getVisualPipeline = async (id: string): Promise<VisualPipeline> => {
    return api.get<VisualPipeline>(`${VISUAL_PIPELINES_BASE}/${id}`);
};

export const createVisualPipeline = async (
    data: CreateVisualPipelineRequest,
): Promise<VisualPipeline> => {
    return api.post<VisualPipeline>(VISUAL_PIPELINES_BASE, data);
};

export const updateVisualPipeline = async (
    id: string,
    data: UpdateVisualPipelineRequest,
): Promise<VisualPipeline> => {
    return api.put<VisualPipeline>(`${VISUAL_PIPELINES_BASE}/${id}`, data);
};

export const deleteVisualPipeline = async (id: string): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`${VISUAL_PIPELINES_BASE}/${id}`) as Promise<{ message: string }>;
};

export const publishVisualPipeline = async (
    id: string,
    changeReason?: string,
): Promise<VisualPipelineVersion> => {
    return api.post<VisualPipelineVersion>(`${VISUAL_PIPELINES_BASE}/${id}/publish`, {
        change_reason: changeReason || null,
    });
};

export const getVisualPipelineVersions = async (id: string): Promise<VisualPipelineVersion[]> => {
    return api.get<VisualPipelineVersion[]>(`${VISUAL_PIPELINES_BASE}/${id}/versions`);
};

export const duplicateVisualPipeline = async (id: string): Promise<VisualPipeline> => {
    return api.post<VisualPipeline>(`${VISUAL_PIPELINES_BASE}/${id}/duplicate`, null);
};

export const validateVisualPipeline = async (
    id: string,
    graphJson: VisualPipeline['graph_json'],
): Promise<ValidateResponse> => {
    return api.post<ValidateResponse>(`${VISUAL_PIPELINES_BASE}/${id}/validate`, {
        graph_json: graphJson,
    });
};

export const testRunVisualPipeline = async (
    id: string,
    payload: {
        transcript?: string;
        input_json?: Record<string, unknown> | Array<Record<string, unknown>>;
        session_context?: Record<string, unknown>;
    },
): Promise<TestRunResponse> => {
    return api.post<TestRunResponse>(`${VISUAL_PIPELINES_BASE}/${id}/test-run`, payload);
};

export const getPipelineExecutionLogs = async (
    params?: Record<string, string>,
): Promise<{
    items: PipelineExecutionTraceSummary[];
    total: number;
    page: number;
    size: number;
    pages: number;
}> => {
    return api.get(`${VISUAL_PIPELINES_BASE}/execution-logs`, { params });
};

export const getPipelineExecutionTrace = async (
    traceId: string,
): Promise<PipelineExecutionTraceDetail> => {
    return api.get<PipelineExecutionTraceDetail>(`${VISUAL_PIPELINES_BASE}/execution-logs/${traceId}`);
};

export const getTemplatePipelineLink = async (
    templateId: string,
): Promise<TemplatePipelineLink | null> => {
    return api.get<TemplatePipelineLink | null>(`${VISUAL_PIPELINES_BASE}/templates/${templateId}/link`);
};

export const setTemplatePipelineLink = async (
    templateId: string,
    payload: {
        pipeline_id: string;
        pipeline_version?: number | null;
        overrides?: Record<string, unknown> | null;
    },
): Promise<TemplatePipelineLink> => {
    return api.put<TemplatePipelineLink>(`${VISUAL_PIPELINES_BASE}/templates/${templateId}/link`, payload);
};

export const deleteTemplatePipelineLink = async (
    templateId: string,
): Promise<{ message: string }> => {
    return api.delete<{ message: string }>(`${VISUAL_PIPELINES_BASE}/templates/${templateId}/link`) as Promise<{ message: string }>;
};

export const convertTemplateV02 = async (templateId: string): Promise<TemplatePipelineLink> => {
    return api.post<TemplatePipelineLink>(`${VISUAL_PIPELINES_BASE}/templates/${templateId}/convert-v02`, null);
};
