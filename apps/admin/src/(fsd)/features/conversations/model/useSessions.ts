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
    getSessionObservation,
    generateSessionObservation,
    analyzeSessionObservation,
    getReportingPrompt,
    updateReportingPrompt,
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
    size = 30,
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

// ============================================================================
// Session Observation hooks
// ============================================================================

/** 세션 관찰 데이터 조회 (Layer 1+2+3) */
export const useSessionObservation = (sessionId: string | undefined) => {
    return useQuery({
        queryKey: ['session-observation', sessionId!],
        queryFn: () => getSessionObservation(sessionId!),
        enabled: !!sessionId,
        retry: false, // 404는 정상 (아직 생성 안 됨)
    });
};

/** 관찰 데이터 수동 생성/재생성 (Layer 1+2) */
export const useGenerateObservation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (sessionId: string) => generateSessionObservation(sessionId),
        onSuccess: (_, sessionId) => {
            queryClient.invalidateQueries({ queryKey: ['session-observation', sessionId] });
        },
    });
};

/** AI 분석 실행 (Layer 3) — 수동 트리거 */
export const useAnalyzeObservation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (sessionId: string) => analyzeSessionObservation(sessionId),
        onSuccess: (_, sessionId) => {
            queryClient.invalidateQueries({ queryKey: ['session-observation', sessionId] });
        },
    });
};

// ============================================================================
// Reporting LLM Prompt hooks
// ============================================================================

/** Reporting LLM 프롬프트 조회 */
export const useReportingPrompt = () => {
    return useQuery({
        queryKey: ['reporting-prompt'],
        queryFn: () => getReportingPrompt(),
    });
};

/** Reporting LLM 프롬프트 업데이트 */
export const useUpdateReportingPrompt = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            name?: string;
            system_prompt: string;
            llm_model?: string;
            temperature?: string;
        }) => updateReportingPrompt(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reporting-prompt'] });
        },
    });
};
