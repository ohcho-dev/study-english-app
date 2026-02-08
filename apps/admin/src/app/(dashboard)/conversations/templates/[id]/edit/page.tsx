'use client';

/**
 * Edit Template Page - Edit an existing conversation template
 */

import { use } from 'react';
import { useRouter } from 'next/navigation';

import {
    TemplateEditor,
    useTemplate,
    useUpdateTemplate,
} from '@/(fsd)/features/conversations';
import type { TemplateUpdate } from '@/(fsd)/features/conversations';
import { Card, CardContent } from '@/shared/ui/card';

interface PageParams {
    id: string;
}

export default function EditTemplatePage({ params }: { params: Promise<PageParams> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: template, isLoading } = useTemplate(id);
    const updateTemplateMutation = useUpdateTemplate();

    const handleSave = async (data: TemplateUpdate) => {
        await updateTemplateMutation.mutateAsync({ id, data });
        router.push('/conversations/templates');
    };

    const handleCancel = () => {
        router.push('/conversations/templates');
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="animate-pulse space-y-4">
                            <div className="h-6 bg-muted rounded w-1/3 mx-auto" />
                            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!template) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="text-4xl mb-4">❌</div>
                        <h3 className="text-lg font-medium mb-2">템플릿을 찾을 수 없습니다</h3>
                        <button
                            onClick={() => router.push('/conversations/templates')}
                            className="text-primary hover:underline"
                        >
                            목록으로 돌아가기
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            <TemplateEditor
                template={template}
                onSave={handleSave}
                onCancel={handleCancel}
                isLoading={updateTemplateMutation.isPending}
            />
        </div>
    );
}
