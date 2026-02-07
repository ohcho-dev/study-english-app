'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    createPipeline,
    deletePipeline,
    getPipeline,
    getPipelines,
    updatePipeline,
} from '../api/aiLabApi';
import type { Pipeline, PipelineCreate, PipelineListItem, PipelineUpdate } from './types';

/**
 * Fetch all pipelines
 */
export const usePipelines = () => {
    return useQuery<PipelineListItem[]>({
        queryKey: ['ai-lab', 'pipelines'],
        queryFn: getPipelines,
    });
};

/**
 * Fetch single pipeline with agents
 */
export const usePipeline = (pipelineId: string | null) => {
    return useQuery<Pipeline>({
        queryKey: ['ai-lab', 'pipelines', pipelineId],
        queryFn: () => getPipeline(pipelineId!),
        enabled: !!pipelineId,
    });
};

/**
 * Create a new pipeline
 */
export const useCreatePipeline = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: PipelineCreate) => createPipeline(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-lab', 'pipelines'] });
        },
    });
};

/**
 * Update a pipeline
 */
export const useUpdatePipeline = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: PipelineUpdate }) =>
            updatePipeline(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['ai-lab', 'pipelines'] });
            queryClient.invalidateQueries({ queryKey: ['ai-lab', 'pipelines', id] });
        },
    });
};

/**
 * Delete a pipeline
 */
export const useDeletePipeline = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePipeline(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-lab', 'pipelines'] });
        },
    });
};
