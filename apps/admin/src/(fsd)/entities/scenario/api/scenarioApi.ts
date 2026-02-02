import { api } from '@/shared/lib/api';
import type { Scenario, ScenarioCreate, ScenarioStatus } from '../model/types';

const ENDPOINT = '/api/v1/scenarios';

export const scenarioApi = {
    getAll: (status?: ScenarioStatus) => {
        const params = status ? { status } : undefined;
        return api.get<Scenario[]>(ENDPOINT, { params });
    },

    getById: (id: string) => api.get<Scenario>(`${ENDPOINT}/${id}`),

    create: (data: ScenarioCreate) => api.post<Scenario>(ENDPOINT, data),

    update: (id: string, data: Partial<ScenarioCreate>) =>
        api.patch<Scenario>(`${ENDPOINT}/${id}`, data),

    delete: (id: string) => api.delete<void>(`${ENDPOINT}/${id}`),
};
