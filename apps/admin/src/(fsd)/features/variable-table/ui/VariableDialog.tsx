'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';
import type {
    ExperimentVariable,
    LearningTheme,
    VariableCategory,
} from '@/entities/variable';

const variableSchema = z.object({
    variable_key: z.string().min(1, '변수 키를 입력해주세요'),
    learning_theme: z.enum(['listening', 'simulation', 'myturn', 'all']),
    category: z.enum(['ui', 'feedback', 'flow', 'difficulty', 'ai', 'hint', 'gamification']),
    description: z.string().min(1, '설명을 입력해주세요'),
    variable_type: z.enum(['boolean', 'number', 'string', 'enum', 'array']),
    control_value: z.string().min(1, 'Control 값을 입력해주세요'),
    treatment_value: z.string().min(1, 'Treatment 값을 입력해주세요'),
    traffic_split: z.number().min(0).max(1),
    is_active: z.boolean(),
});

type VariableFormData = z.infer<typeof variableSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variable?: ExperimentVariable | null;
    onSubmit: (data: VariableFormData) => void;
}

const THEME_OPTIONS: { value: LearningTheme; label: string }[] = [
    { value: 'listening', label: '🎧 듣기 전용' },
    { value: 'simulation', label: '🎬 시뮬레이션' },
    { value: 'myturn', label: '🎭 상황극 큐' },
    { value: 'all', label: '🌐 전체' },
];

const CATEGORY_OPTIONS: { value: VariableCategory; label: string }[] = [
    { value: 'ui', label: 'UI' },
    { value: 'feedback', label: '피드백' },
    { value: 'flow', label: '플로우' },
    { value: 'difficulty', label: '난이도' },
    { value: 'ai', label: 'AI' },
    { value: 'hint', label: '힌트' },
    { value: 'gamification', label: '게임화' },
];

const TYPE_OPTIONS = [
    { value: 'boolean', label: 'Boolean' },
    { value: 'number', label: 'Number' },
    { value: 'string', label: 'String' },
    { value: 'enum', label: 'Enum' },
    { value: 'array', label: 'Array' },
];

export const VariableDialog = ({ open, onOpenChange, variable, onSubmit }: Props) => {
    const isEdit = !!variable;

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        watch,
        setValue,
    } = useForm<VariableFormData>({
        resolver: zodResolver(variableSchema),
        defaultValues: variable
            ? {
                variable_key: variable.variable_key,
                learning_theme: variable.learning_theme,
                category: variable.category,
                description: variable.description,
                variable_type: variable.variable_type,
                control_value: variable.control_value,
                treatment_value: variable.treatment_value,
                traffic_split: variable.traffic_split,
                is_active: variable.is_active,
            }
            : {
                variable_key: '',
                learning_theme: 'simulation',
                category: 'ui',
                description: '',
                variable_type: 'boolean',
                control_value: '',
                treatment_value: '',
                traffic_split: 0.5,
                is_active: false,
            },
    });

    const isActive = watch('is_active');

    const handleFormSubmit = (data: VariableFormData) => {
        onSubmit(data);
        reset();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? '변수 수정' : '새 실험 변수 추가'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">변수 키</label>
                            <Input
                                {...register('variable_key')}
                                placeholder="sim_feedback_timing"
                                className="font-mono"
                            />
                            {errors.variable_key && (
                                <p className="text-sm text-destructive">{errors.variable_key.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">설명</label>
                            <Input {...register('description')} placeholder="피드백 시점 설정" />
                            {errors.description && (
                                <p className="text-sm text-destructive">{errors.description.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">학습 테마</label>
                            <select
                                {...register('learning_theme')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {THEME_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">카테고리</label>
                            <select
                                {...register('category')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">타입</label>
                            <select
                                {...register('variable_type')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Control 값 (대조군)</label>
                            <Input
                                {...register('control_value')}
                                placeholder="false"
                                className="font-mono"
                            />
                            {errors.control_value && (
                                <p className="text-sm text-destructive">{errors.control_value.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Treatment 값 (실험군)</label>
                            <Input
                                {...register('treatment_value')}
                                placeholder="true"
                                className="font-mono"
                            />
                            {errors.treatment_value && (
                                <p className="text-sm text-destructive">{errors.treatment_value.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">트래픽 분배 (0.0 ~ 1.0)</label>
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="1"
                                {...register('traffic_split', { valueAsNumber: true })}
                                placeholder="0.5"
                            />
                        </div>
                        <div className="flex items-center justify-between py-6">
                            <label className="text-sm font-medium">실험 활성화</label>
                            <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => setValue('is_active', checked)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            취소
                        </Button>
                        <Button type="submit">{isEdit ? '수정' : '추가'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
