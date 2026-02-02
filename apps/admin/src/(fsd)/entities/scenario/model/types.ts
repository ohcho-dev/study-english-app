// Scenario entity types
export interface Scenario {
    id: string;
    title: string;
    description: string | null;
    type: ScenarioType;
    status: ScenarioStatus;
    difficulty_level: number;
    estimated_minutes: number;
    created_at: string;
    updated_at: string | null;
}

export type ScenarioType = 'listening' | 'simulation' | 'roleplay';
export type ScenarioStatus = 'draft' | 'testing' | 'published' | 'archived';

export interface ScenarioStep {
    id: string;
    scenario_id: string;
    step_order: number;
    step_type: StepType;
    content: Record<string, unknown>;
    created_at: string;
}

export type StepType = 'dialogue' | 'quiz' | 'audio' | 'instruction';

export interface ScenarioCreate {
    title: string;
    description?: string;
    type: ScenarioType;
    difficulty_level?: number;
    estimated_minutes?: number;
}
