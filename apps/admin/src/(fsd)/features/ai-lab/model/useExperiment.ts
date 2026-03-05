'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
    getExperimentLogDetail,
    getExperimentLogs,
    getModels,
    runExperiment,
} from '../api/aiLabApi';
import type {
    ExperimentLogDetail,
    ExperimentLogSummary,
    ExperimentRunRequest,
    ExperimentRunResponse,
    ModelInfo,
    PaginatedResponse,
} from './types';

/**
 * Fetch available AI models
 */
export const useModels = () => {
    return useQuery<ModelInfo[]>({
        queryKey: ['ai-lab', 'models'],
        queryFn: getModels,
    });
};

/**
 * Run an experiment
 */
export const useRunExperiment = () => {
    const queryClient = useQueryClient();

    return useMutation<ExperimentRunResponse, Error, ExperimentRunRequest>({
        mutationFn: runExperiment,
        onSuccess: () => {
            // Invalidate logs to show the new experiment
            queryClient.invalidateQueries({ queryKey: ['ai-lab', 'logs'] });
        },
    });
};

/**
 * Fetch experiment logs with pagination
 */
export const useLogs = (
    page = 1,
    size = 30,
    pipelineId?: string
) => {
    return useQuery<PaginatedResponse<ExperimentLogSummary>>({
        queryKey: ['ai-lab', 'logs', { page, size, pipelineId }],
        queryFn: () => getExperimentLogs(page, size, pipelineId),
    });
};

/**
 * Fetch single experiment log detail
 */
export const useLogDetail = (logId: string | null) => {
    return useQuery<ExperimentLogDetail>({
        queryKey: ['ai-lab', 'logs', logId],
        queryFn: () => getExperimentLogDetail(logId!),
        enabled: !!logId,
    });
};

/**
 * Hook for managing experiment state with cancel support
 */
export const useExperimentState = () => {
    const [result, setResult] = useState<ExperimentRunResponse | null>(null);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const runMutation = useRunExperiment();

    const run = async (request: ExperimentRunRequest) => {
        // Create new abort controller for this request
        const controller = new AbortController();
        setAbortController(controller);

        try {
            const response = await runMutation.mutateAsync(request);
            setResult(response);
            return response;
        } finally {
            setAbortController(null);
        }
    };

    const cancel = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
        }
        runMutation.reset();
    };

    const clear = () => {
        setResult(null);
    };

    return {
        result,
        run,
        cancel,
        clear,
        isLoading: runMutation.isPending,
        error: runMutation.error,
    };
};
