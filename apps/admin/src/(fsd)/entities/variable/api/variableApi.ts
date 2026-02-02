import { api } from '@/shared/lib/api';
import type { Variable, VariableUpdate } from '../model/types';

const ENDPOINT = '/api/v1/variables';

export const variableApi = {
    getAll: () => api.get<Variable[]>(ENDPOINT),

    getByTheme: (theme: string) =>
        api.get<Variable[]>(`${ENDPOINT}/theme/${theme}`),

    update: (id: string, data: VariableUpdate) =>
        api.patch<Variable>(`${ENDPOINT}/${id}`, data),
};
