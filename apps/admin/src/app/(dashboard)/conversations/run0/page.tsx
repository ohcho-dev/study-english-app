'use client';

/**
 * Experiment Page - Voice Pipeline Testing with Template Selection
 */

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { ChevronDown, Layout } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

import {
    Run0Runner,
    useTemplates,
    useTemplate,
} from '@/(fsd)/features/conversations';

function ExperimentContent() {
    const searchParams = useSearchParams();
    const templateIdFromUrl = searchParams.get('template');

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
        templateIdFromUrl
    );

    const { data: templatesData, isLoading: templatesLoading } = useTemplates(1, 50, true);
    const { data: selectedTemplate } = useTemplate(selectedTemplateId || undefined);

    const templates = templatesData?.items || [];

    return (
        <div className="space-y-6">
            {/* Template Selector */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Layout className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">실험 템플릿</p>
                                <p className="font-medium">
                                    {selectedTemplate?.name || '템플릿을 선택하세요'}
                                </p>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={templatesLoading}>
                                    {templatesLoading ? '로딩 중...' : '템플릿 선택'}
                                    <ChevronDown className="h-4 w-4 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuItem
                                    onClick={() => setSelectedTemplateId(null)}
                                    className={!selectedTemplateId ? 'bg-accent' : ''}
                                >
                                    <span className="text-muted-foreground">
                                        기본 설정 (템플릿 없음)
                                    </span>
                                </DropdownMenuItem>
                                {templates.map((template) => (
                                    <DropdownMenuItem
                                        key={template.id}
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={selectedTemplateId === template.id ? 'bg-accent' : ''}
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium">{template.name}</div>
                                            {template.topic && (
                                                <div className="text-xs text-muted-foreground">
                                                    {template.topic}
                                                </div>
                                            )}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                {templates.length === 0 && !templatesLoading && (
                                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                        활성화된 템플릿이 없습니다
                                    </div>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {selectedTemplate?.description && (
                        <p className="mt-3 text-sm text-muted-foreground border-t pt-3">
                            {selectedTemplate.description}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Run0 Runner */}
            <Run0Runner
                template={selectedTemplate || undefined}
                templateId={selectedTemplateId || undefined}
            />
        </div>
    );
}

export default function ExperimentPage() {
    return (
        <div className="p-6">
            <Suspense fallback={
                <Card>
                    <CardContent className="py-8 text-center">
                        로딩 중...
                    </CardContent>
                </Card>
            }>
                <ExperimentContent />
            </Suspense>
        </div>
    );
}
