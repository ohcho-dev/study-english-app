'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from './api';

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    input_price_per_1m: number;
    output_price_per_1m: number;
    supports_multimodal: boolean;
    supports_audio_input?: boolean;
    supports_audio_output?: boolean;
    supports_native_audio?: boolean;
    supports_function_calling?: boolean;
    category?: 'general' | 'tts' | 'audio' | 'vision';
    description?: string | null;
    use_cases?: string[];
    max_context_tokens?: number | null;
}

const fetchModels = async (): Promise<ModelInfo[]> => {
    return api.get<ModelInfo[]>('/api/v1/ai-lab/models');
};

/**
 * 사용 가능한 LLM 모델 목록을 서버에서 가져오는 공유 훅.
 * features/ai-lab 과 features/pipeline-editor 모두에서 사용 가능.
 */
export const useModels = (options?: { categoryFilter?: ModelInfo['category'] }) => {
    const query = useQuery<ModelInfo[]>({
        queryKey: ['shared', 'models'],
        queryFn: fetchModels,
        staleTime: 5 * 60 * 1000, // 5분 캐시
    });

    const models = query.data ?? [];
    const filtered = options?.categoryFilter
        ? models.filter((m) => m.category === options.categoryFilter)
        : models;

    return { ...query, models: filtered };
};

/** general 카테고리(LLM용) 모델만 반환 */
export const useLLMModels = () => useModels({ categoryFilter: 'general' });
