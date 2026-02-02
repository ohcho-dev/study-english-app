'use client';

import { useQuery } from '@tanstack/react-query';
import type { ExperimentVariable, LearningTheme } from '@/entities/variable';

// research-cms.md 기반 실제 실험 변수 mock 데이터
const mockVariables: ExperimentVariable[] = [
    // 🎧 듣기 전용 (Listening Mode)
    {
        id: 'var_001',
        experiment_id: null,
        variable_key: 'listening_subtitle_visible',
        learning_theme: 'listening',
        category: 'ui',
        description: '자막 표시 여부',
        variable_type: 'boolean',
        control_value: 'true',
        treatment_value: 'false',
        traffic_split: 0.5,
        is_active: true,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: null,
    },
    {
        id: 'var_002',
        experiment_id: 'exp_001',
        variable_key: 'listening_speed_multiplier',
        learning_theme: 'listening',
        category: 'difficulty',
        description: '재생 속도 배율',
        variable_type: 'number',
        control_value: '1.0',
        treatment_value: '0.8',
        traffic_split: 0.5,
        is_active: true,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: null,
    },
    // 🎬 시뮬레이션 (Simulation Mode)
    {
        id: 'var_003',
        experiment_id: 'exp_002',
        variable_key: 'sim_feedback_timing',
        learning_theme: 'simulation',
        category: 'feedback',
        description: '피드백 시점 (실시간 vs 턴 종료 후)',
        variable_type: 'enum',
        control_value: '"delayed"',
        treatment_value: '"realtime"',
        traffic_split: 0.5,
        is_active: true,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: null,
    },
    {
        id: 'var_004',
        experiment_id: null,
        variable_key: 'sim_thinking_buffer_seconds',
        learning_theme: 'simulation',
        category: 'flow',
        description: '사고 시간 버퍼 (초)',
        variable_type: 'number',
        control_value: '5',
        treatment_value: '10',
        traffic_split: 0.5,
        is_active: false,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: null,
    },
    // 🎭 상황극 큐 (MyTurn)
    {
        id: 'var_005',
        experiment_id: null,
        variable_key: 'myturn_repeat_count',
        learning_theme: 'myturn',
        category: 'flow',
        description: '반복 횟수',
        variable_type: 'number',
        control_value: '2',
        treatment_value: '3',
        traffic_split: 0.5,
        is_active: true,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: null,
    },
    {
        id: 'var_006',
        experiment_id: null,
        variable_key: 'myturn_hidden_mission',
        learning_theme: 'myturn',
        category: 'gamification',
        description: '히든 미션 존재 여부',
        variable_type: 'boolean',
        control_value: 'false',
        treatment_value: 'true',
        traffic_split: 0.5,
        is_active: false,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: null,
    },
];

export const useVariables = () => {
    return useQuery<ExperimentVariable[]>({
        queryKey: ['variables'],
        queryFn: async () => mockVariables,
    });
};

export const useVariablesByTheme = (theme: LearningTheme) => {
    return useQuery<ExperimentVariable[]>({
        queryKey: ['variables', 'theme', theme],
        queryFn: async () => mockVariables.filter(v =>
            theme === 'all' ? true : v.learning_theme === theme
        ),
        enabled: !!theme,
    });
};
