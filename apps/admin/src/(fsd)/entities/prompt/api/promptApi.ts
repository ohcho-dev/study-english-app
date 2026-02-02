import { api } from '@/shared/lib/api';
import type { Prompt, PromptCreate } from '../model/types';

const ENDPOINT = '/api/v1/prompts';

export const promptApi = {
    getAll: () => api.get<Prompt[]>(ENDPOINT),

    getById: (id: string) => api.get<Prompt>(`${ENDPOINT}/${id}`),

    create: (data: PromptCreate) => api.post<Prompt>(ENDPOINT, data),

    update: (id: string, data: Partial<PromptCreate>) =>
        api.patch<Prompt>(`${ENDPOINT}/${id}`, data),

    test: (data: { prompt_id: string; test_input: string }) =>
        api.post<{ response: string }>(`${ENDPOINT}/test`, data),
};
