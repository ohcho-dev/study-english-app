'use client';

/**
 * Templates Page - Manage conversation templates
 */

import { useRouter } from 'next/navigation';

import {
    TemplateList,
    useTemplates,
    useDeleteTemplate,
    useDuplicateTemplate,
} from '@/(fsd)/features/conversations';

export default function TemplatesPage() {
    const router = useRouter();
    const { data: templatesData, isLoading } = useTemplates();
    const deleteTemplateMutation = useDeleteTemplate();
    const duplicateTemplateMutation = useDuplicateTemplate();

    const templates = templatesData?.items || [];

    const handleEdit = (id: string) => {
        router.push(`/conversations/templates/${id}/edit`);
    };

    const handleDelete = async (id: string) => {
        if (confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
            await deleteTemplateMutation.mutateAsync(id);
        }
    };

    const handleDuplicate = async (id: string) => {
        await duplicateTemplateMutation.mutateAsync(id);
    };

    const handleCreate = () => {
        router.push('/conversations/templates/new');
    };

    const handleTest = (id: string) => {
        router.push(`/conversations/run0?template=${id}`);
    };

    return (
        <div className="p-6">
            <TemplateList
                templates={templates}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onCreate={handleCreate}
                onTest={handleTest}
            />
        </div>
    );
}

