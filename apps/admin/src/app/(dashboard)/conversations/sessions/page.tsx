'use client';

/**
 * Sessions Page - View conversation session history
 */

import { useRouter } from 'next/navigation';

import {
    SessionList,
    useSessions,
} from '@/(fsd)/features/conversations';

export default function SessionsPage() {
    const router = useRouter();
    const { data: sessionsData, isLoading } = useSessions();

    const sessions = sessionsData?.items || [];

    const handleView = (id: string) => {
        router.push(`/conversations/sessions/${id}`);
    };

    const handleViewMetrics = (id: string) => {
        router.push(`/conversations/sessions/${id}?tab=metrics`);
    };

    return (
        <div className="p-6">
            <SessionList
                sessions={sessions}
                isLoading={isLoading}
                onView={handleView}
                onViewMetrics={handleViewMetrics}
            />
        </div>
    );
}
