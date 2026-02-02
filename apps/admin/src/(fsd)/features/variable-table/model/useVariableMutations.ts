'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExperimentVariable, ExperimentVariableCreate, ExperimentVariableUpdate } from '@/entities/variable';

// TODO: 백엔드 연동 시 API 호출로 교체
export const useCreateVariable = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ExperimentVariableCreate) => {
            const newVariable: ExperimentVariable = {
                ...data,
                id: `var_${Date.now()}`,
                experiment_id: null,
                traffic_split: data.traffic_split ?? 0.5,
                is_active: data.is_active ?? false,
                created_at: new Date().toISOString(),
                updated_at: null,
            };
            return newVariable;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['variables'] });
        },
    });
};

export const useUpdateVariable = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: ExperimentVariableUpdate }) => {
            return { id, ...data };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['variables'] });
        },
    });
};

export const useToggleVariable = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            return { id, is_active };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['variables'] });
        },
    });
};

export const useDeleteVariable = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            return { id };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['variables'] });
        },
    });
};
