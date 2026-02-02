import { api } from '@/shared/lib/api';
import type { ExperimentVariable, ExperimentVariableUpdate } from '../model/types';

const ENDPOINT = '/api/v1/variables';

export const variableApi = {
    getAll: () => api.get<ExperimentVariable[]>(ENDPOINT),

    getByTheme: (theme: string) =>
        api.get<ExperimentVariable[]>(`${ENDPOINT}/theme/${theme}`),

    update: (id: string, data: ExperimentVariableUpdate) =>
        api.patch<ExperimentVariable>(`${ENDPOINT}/${id}`, data),
};

