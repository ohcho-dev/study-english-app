'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    convertTemplateV02,
    createVisualPipeline,
    deleteTemplatePipelineLink,
    deleteVisualPipeline,
    duplicateVisualPipeline,
    getPipelineExecutionLogs,
    getPipelineExecutionTrace,
    getTemplatePipelineLink,
    getVisualPipeline,
    getVisualPipelines,
    getVisualPipelineVersions,
    publishVisualPipeline,
    setTemplatePipelineLink,
    testRunVisualPipeline,
    updateVisualPipeline,
    validateVisualPipeline,
} from '../api/pipelineEditorApi';
import type {
    CreateVisualPipelineRequest,
    UpdateVisualPipelineRequest,
    VisualPipeline,
} from './types';

export const visualPipelineKeys = {
    all: ['visual-pipelines'] as const,
    list: (status?: string) => [...visualPipelineKeys.all, 'list', status || 'all'] as const,
    detail: (id: string) => [...visualPipelineKeys.all, 'detail', id] as const,
    versions: (id: string) => [...visualPipelineKeys.all, 'versions', id] as const,
    logs: (params?: Record<string, string>) => [...visualPipelineKeys.all, 'logs', params || {}] as const,
    trace: (traceId: string) => [...visualPipelineKeys.all, 'trace', traceId] as const,
    templateLink: (templateId: string) => [...visualPipelineKeys.all, 'template-link', templateId] as const,
};

export const useVisualPipelines = (status?: string) => useQuery({
    queryKey: visualPipelineKeys.list(status),
    queryFn: () => getVisualPipelines(status),
});

export const useVisualPipeline = (id?: string) => useQuery({
    queryKey: visualPipelineKeys.detail(id || ''),
    queryFn: () => getVisualPipeline(id!),
    enabled: !!id,
});

export const useVisualPipelineVersions = (id?: string) => useQuery({
    queryKey: visualPipelineKeys.versions(id || ''),
    queryFn: () => getVisualPipelineVersions(id!),
    enabled: !!id,
});

export const usePipelineExecutionLogs = (params?: Record<string, string>) => useQuery({
    queryKey: visualPipelineKeys.logs(params),
    queryFn: () => getPipelineExecutionLogs(params),
});

export const usePipelineExecutionTrace = (traceId?: string) => useQuery({
    queryKey: visualPipelineKeys.trace(traceId || ''),
    queryFn: () => getPipelineExecutionTrace(traceId!),
    enabled: !!traceId,
});

export const useTemplatePipelineLink = (templateId?: string) => useQuery({
    queryKey: visualPipelineKeys.templateLink(templateId || ''),
    queryFn: () => getTemplatePipelineLink(templateId!),
    enabled: !!templateId,
});

export const useCreateVisualPipeline = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateVisualPipelineRequest) => createVisualPipeline(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.all });
        },
    });
};

export const useUpdateVisualPipeline = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateVisualPipelineRequest }) =>
            updateVisualPipeline(id, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.all });
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.detail(variables.id) });
        },
    });
};

export const useDeleteVisualPipeline = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteVisualPipeline(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: visualPipelineKeys.all }),
    });
};

export const usePublishVisualPipeline = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, changeReason }: { id: string; changeReason?: string }) =>
            publishVisualPipeline(id, changeReason),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.versions(variables.id) });
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.all });
        },
    });
};

export const useDuplicateVisualPipeline = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => duplicateVisualPipeline(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: visualPipelineKeys.all }),
    });
};

export const useValidateVisualPipeline = () => useMutation({
    mutationFn: ({ id, graphJson }: { id: string; graphJson: VisualPipeline['graph_json'] }) =>
        validateVisualPipeline(id, graphJson),
});

export const useTestRunVisualPipeline = () => useMutation({
    mutationFn: ({ id, transcript, sessionContext }: { id: string; transcript: string; sessionContext?: Record<string, unknown> }) =>
        testRunVisualPipeline(id, {
            transcript,
            session_context: sessionContext,
        }),
});

export const useSetTemplatePipelineLink = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ templateId, pipelineId, pipelineVersion }: { templateId: string; pipelineId: string; pipelineVersion?: number | null }) =>
            setTemplatePipelineLink(templateId, {
                pipeline_id: pipelineId,
                pipeline_version: pipelineVersion,
            }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.templateLink(variables.templateId) });
        },
    });
};

export const useDeleteTemplatePipelineLink = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (templateId: string) => deleteTemplatePipelineLink(templateId),
        onSuccess: (_, templateId) => {
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.templateLink(templateId) });
        },
    });
};

export const useConvertTemplateV02 = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (templateId: string) => convertTemplateV02(templateId),
        onSuccess: (_, templateId) => {
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.templateLink(templateId) });
            queryClient.invalidateQueries({ queryKey: visualPipelineKeys.all });
        },
    });
};
