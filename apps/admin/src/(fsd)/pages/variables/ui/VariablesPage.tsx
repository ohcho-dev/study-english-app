'use client';

import { useState } from 'react';
import {
    VariableTable,
    VariableDialog,
    useVariables,
    useToggleVariable,
    useCreateVariable,
} from '@/features/variable-table';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Plus, RefreshCw, Filter } from 'lucide-react';
import type { ExperimentVariable, LearningTheme } from '@/entities/variable';
import { LEARNING_THEME_LABELS } from '@/entities/variable';

export const VariablesPage = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState<LearningTheme | 'all'>('all');
    const [editingVariable, setEditingVariable] = useState<ExperimentVariable | null>(null);

    const { data: variables, isLoading, refetch, isRefetching } = useVariables();
    const toggleMutation = useToggleVariable();
    const createMutation = useCreateVariable();

    const filteredVariables = variables?.filter((v) =>
        selectedTheme === 'all' ? true : v.learning_theme === selectedTheme
    );

    const handleToggle = (id: string, isActive: boolean) => {
        toggleMutation.mutate({ id, is_active: isActive });
    };

    const handleCreate = (data: {
        variable_key: string;
        learning_theme: LearningTheme;
        category: 'ui' | 'feedback' | 'flow' | 'difficulty' | 'ai' | 'hint' | 'gamification';
        description: string;
        variable_type: 'boolean' | 'number' | 'string' | 'enum' | 'array';
        control_value: string;
        treatment_value: string;
        traffic_split: number;
        is_active: boolean;
    }) => {
        createMutation.mutate(data);
    };

    const handleEdit = (variable: ExperimentVariable) => {
        setEditingVariable(variable);
        setDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            setEditingVariable(null);
        }
    };

    const themeFilters: (LearningTheme | 'all')[] = ['all', 'listening', 'simulation', 'myturn'];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">실험 변수 관리</h1>
                    <p className="text-muted-foreground">
                        A/B 테스트를 위한 Feature Flags를 관리합니다.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isRefetching}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                        새로고침
                    </Button>
                    <Button size="sm" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        변수 추가
                    </Button>
                </div>
            </div>

            {/* 학습 테마 필터 */}
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">학습 테마:</span>
                {themeFilters.map((theme) => (
                    <Badge
                        key={theme}
                        variant={selectedTheme === theme ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSelectedTheme(theme)}
                    >
                        {theme === 'all' ? '전체' : LEARNING_THEME_LABELS[theme]}
                    </Badge>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        실험 변수 목록
                        {filteredVariables && (
                            <Badge variant="secondary" className="font-normal">
                                {filteredVariables.length}개
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            로딩 중...
                        </div>
                    ) : (
                        <VariableTable
                            variables={filteredVariables || []}
                            onToggle={handleToggle}
                            onEdit={handleEdit}
                        />
                    )}
                </CardContent>
            </Card>

            <VariableDialog
                open={dialogOpen}
                onOpenChange={handleDialogClose}
                variable={editingVariable}
                onSubmit={handleCreate}
            />
        </div>
    );
};
