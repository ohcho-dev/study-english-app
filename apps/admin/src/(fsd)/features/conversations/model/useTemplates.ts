/**
 * Template hooks - React Query hooks for template management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    createTemplate,
    deleteTemplate,
    duplicateTemplate,
    getTemplate,
    getTemplates,
    updateTemplate,
} from '../api/conversationsApi';
import type { TemplateCreate, TemplateUpdate } from './types';

// Query keys
export const templateKeys = {
    all: ['templates'] as const,
    lists: () => [...templateKeys.all, 'list'] as const,
    list: (page: number, size: number, activeOnly: boolean) =>
        [...templateKeys.lists(), { page, size, activeOnly }] as const,
    details: () => [...templateKeys.all, 'detail'] as const,
    detail: (id: string) => [...templateKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated templates
 */
export const useTemplates = (page = 1, size = 20, activeOnly = true) => {
    return useQuery({
        queryKey: templateKeys.list(page, size, activeOnly),
        queryFn: () => getTemplates(page, size, activeOnly),
    });
};

/**
 * Hook to fetch a single template with participants
 */
export const useTemplate = (id: string | undefined) => {
    return useQuery({
        queryKey: templateKeys.detail(id!),
        queryFn: () => getTemplate(id!),
        enabled: !!id,
    });
};

/**
 * Hook to create a new template
 */
export const useCreateTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TemplateCreate) => createTemplate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        },
    });
};

/**
 * Hook to update a template
 */
export const useUpdateTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: TemplateUpdate }) =>
            updateTemplate(id, data),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
            queryClient.invalidateQueries({ queryKey: templateKeys.detail(id) });
        },
    });
};

/**
 * Hook to delete a template
 */
export const useDeleteTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        },
    });
};

/**
 * Hook to duplicate a template
 */
export const useDuplicateTemplate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, newName }: { id: string; newName: string }) =>
            duplicateTemplate(id, newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        },
    });
};
