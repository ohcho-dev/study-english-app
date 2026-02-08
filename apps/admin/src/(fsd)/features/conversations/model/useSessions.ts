/**
 * Session hooks - React Query hooks for session management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
    createSession,
    endSession,
    getSession,
    getSessions,
    getSessionMetrics,
    getSessionTurns,
} from '../api/conversationsApi';
import type { SessionCreate } from './types';

// Query keys
export const sessionKeys = {
    all: ['sessions'] as const,
    lists: () => [...sessionKeys.all, 'list'] as const,
    list: (page: number, size: number, templateId?: string, status?: string) =>
        [...sessionKeys.lists(), { page, size, templateId, status }] as const,
    details: () => [...sessionKeys.all, 'detail'] as const,
    detail: (id: string) => [...sessionKeys.details(), id] as const,
    turns: (sessionId: string) => [...sessionKeys.all, 'turns', sessionId] as const,
    metrics: (sessionId: string) => [...sessionKeys.all, 'metrics', sessionId] as const,
};

/**
 * Hook to fetch paginated sessions
 */
export const useSessions = (
    page = 1,
    size = 20,
    templateId?: string,
    status?: string
) => {
    return useQuery({
        queryKey: sessionKeys.list(page, size, templateId, status),
        queryFn: () => getSessions(page, size, templateId, status),
    });
};

/**
 * Hook to fetch a single session
 */
export const useSession = (id: string | undefined) => {
    return useQuery({
        queryKey: sessionKeys.detail(id!),
        queryFn: () => getSession(id!),
        enabled: !!id,
    });
};

/**
 * Hook to fetch session turns
 */
export const useSessionTurns = (sessionId: string | undefined) => {
    return useQuery({
        queryKey: sessionKeys.turns(sessionId!),
        queryFn: () => getSessionTurns(sessionId!),
        enabled: !!sessionId,
        refetchInterval: 2000, // Poll for updates during active session
    });
};

/**
 * Hook to fetch session metrics
 */
export const useSessionMetrics = (sessionId: string | undefined) => {
    return useQuery({
        queryKey: sessionKeys.metrics(sessionId!),
        queryFn: () => getSessionMetrics(sessionId!),
        enabled: !!sessionId,
    });
};

/**
 * Hook to create a new session
 */
export const useCreateSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SessionCreate) => createSession(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
        },
    });
};

/**
 * Hook to end a session
 */
export const useEndSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            status,
            errorMessage,
        }: {
            id: string;
            status?: 'completed' | 'error' | 'paused';
            errorMessage?: string;
        }) => endSession(id, status, errorMessage),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
            queryClient.invalidateQueries({ queryKey: sessionKeys.detail(id) });
        },
    });
};
