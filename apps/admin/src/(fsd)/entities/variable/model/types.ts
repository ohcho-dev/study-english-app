// 학습 테마 (Learning Theme)
export type LearningTheme = 'listening' | 'simulation' | 'myturn' | 'all';

export const LEARNING_THEME_LABELS: Record<LearningTheme, string> = {
    listening: '🎧 듣기 전용',
    simulation: '🎬 시뮬레이션',
    myturn: '🎭 상황극 큐',
    all: '🌐 전체',
};

// 변수 카테고리
export type VariableCategory = 'ui' | 'feedback' | 'flow' | 'difficulty' | 'ai' | 'hint' | 'gamification';

export const VARIABLE_CATEGORY_LABELS: Record<VariableCategory, string> = {
    ui: 'UI',
    feedback: '피드백',
    flow: '플로우',
    difficulty: '난이도',
    ai: 'AI',
    hint: '힌트',
    gamification: '게임화',
};

// 실험 변수 (Experiment Variable)
export interface ExperimentVariable {
    id: string;
    experiment_id: string | null;
    variable_key: string;
    learning_theme: LearningTheme;
    category: VariableCategory;
    description: string;
    variable_type: 'boolean' | 'number' | 'string' | 'enum' | 'array';
    control_value: string; // JSON stringified
    treatment_value: string; // JSON stringified
    traffic_split: number; // 0.0 ~ 1.0
    is_active: boolean;
    created_at: string;
    updated_at: string | null;
}

export interface ExperimentVariableCreate {
    variable_key: string;
    learning_theme: LearningTheme;
    category: VariableCategory;
    description: string;
    variable_type: 'boolean' | 'number' | 'string' | 'enum' | 'array';
    control_value: string;
    treatment_value: string;
    traffic_split?: number;
    is_active?: boolean;
}

export interface ExperimentVariableUpdate {
    variable_key?: string;
    learning_theme?: LearningTheme;
    category?: VariableCategory;
    description?: string;
    variable_type?: 'boolean' | 'number' | 'string' | 'enum' | 'array';
    control_value?: string;
    treatment_value?: string;
    traffic_split?: number;
    is_active?: boolean;
}
