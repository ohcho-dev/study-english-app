'use client';

/**
 * New Template Page - Create a new conversation template
 */

import { useRouter } from 'next/navigation';

import {
    TemplateEditor,
    useCreateTemplate,
} from '@/(fsd)/features/conversations';
import type { TemplateCreate } from '@/(fsd)/features/conversations';

export default function NewTemplatePage() {
    const router = useRouter();
    const createTemplateMutation = useCreateTemplate();

    const handleSave = async (data: TemplateCreate) => {
        await createTemplateMutation.mutateAsync(data);
        router.push('/conversations/templates');
    };

    const handleCancel = () => {
        router.push('/conversations/templates');
    };

    return (
        <div className="p-6">
            <TemplateEditor
                onSave={handleSave}
                onCancel={handleCancel}
                isLoading={createTemplateMutation.isPending}
            />
        </div>
    );
}
