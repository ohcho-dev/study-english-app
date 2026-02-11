'use client';

/**
 * SessionList Component - Display and manage conversation sessions
 */

import { useState } from 'react';
import { Search, Eye, Clock, CheckCircle, AlertCircle, Loader2, BarChart3 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';

import type { SessionListItem, SessionStatus } from '../model/types';

interface SessionListProps {
    sessions: SessionListItem[];
    isLoading?: boolean;
    onView: (id: string) => void;
    onViewMetrics?: (id: string) => void;
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; icon: typeof Clock }> = {
    active: { label: '진행 중', color: 'bg-green-500', icon: Loader2 },
    waiting_user: { label: '사용자 대기', color: 'bg-yellow-500', icon: Clock },
    paused: { label: '일시정지', color: 'bg-gray-500', icon: Clock },
    completed: { label: '완료', color: 'bg-blue-500', icon: CheckCircle },
    error: { label: '오류', color: 'bg-red-500', icon: AlertCircle },
};

export const SessionList = ({
    sessions,
    isLoading = false,
    onView,
    onViewMetrics,
}: SessionListProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Filter sessions
    const filteredSessions = sessions.filter((session) => {
        const matchesSearch =
            session.template_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            session.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '-';
        if (seconds < 60) return `${Math.round(seconds)}초`;
        const minutes = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${minutes}분 ${secs}초`;
    };

    // Format latency in ms
    const formatLatency = (ms?: number | null) => {
        if (ms === undefined || ms === null) return '-';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">세션 기록</h1>
                <p className="text-muted-foreground">
                    대화 세션 기록과 메트릭을 확인합니다
                </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="템플릿 또는 세션 ID 검색..."
                        className="pl-9"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                    <option value="all">모든 상태</option>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                        <option key={value} value={value}>
                            {config.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Sessions Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="py-8">
                        <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>로딩 중...</span>
                        </div>
                    </CardContent>
                </Card>
            ) : filteredSessions.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="text-lg font-medium mb-2">세션이 없습니다</h3>
                        <p className="text-sm text-muted-foreground">
                            {searchQuery
                                ? '검색 결과가 없습니다'
                                : 'RUN0 테스트를 실행하면 세션이 여기에 표시됩니다'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full whitespace-nowrap">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left py-3 px-4 text-sm font-medium">
                                            상태
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">
                                            템플릿
                                        </th>
                                        <th className="text-left py-3 px-3 text-sm font-medium">
                                            STT
                                        </th>
                                        <th className="text-left py-3 px-3 text-sm font-medium">
                                            LLM
                                        </th>
                                        <th className="text-left py-3 px-3 text-sm font-medium">
                                            TTS
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">
                                            시작 시간
                                        </th>
                                        <th className="text-center py-3 px-3 text-sm font-medium">
                                            턴 수
                                        </th>
                                        <th className="text-right py-3 px-3 text-sm font-medium text-blue-400">
                                            E2E avg
                                        </th>
                                        <th className="text-right py-3 px-3 text-sm font-medium">
                                            STT avg
                                        </th>
                                        <th className="text-right py-3 px-3 text-sm font-medium">
                                            LLM avg
                                        </th>
                                        <th className="text-right py-3 px-3 text-sm font-medium">
                                            TTS avg
                                        </th>
                                        <th className="text-right py-3 px-3 text-sm font-medium">
                                            Client avg
                                        </th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">
                                            진행 시간
                                        </th>
                                        <th className="text-right py-3 px-4 text-sm font-medium">
                                            액션
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSessions.map((session) => {
                                        const statusConfig = STATUS_CONFIG[session.status];
                                        const StatusIcon = statusConfig.icon;
                                        const cfg = session.variant?.pipeline_config as Record<string, string> | undefined;

                                        return (
                                            <tr
                                                key={session.id}
                                                className="border-b hover:bg-muted/30 transition-colors"
                                            >
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant="outline"
                                                        className="gap-1.5"
                                                    >
                                                        <StatusIcon
                                                            className={`h-3 w-3 ${session.status === 'active'
                                                                ? 'animate-spin'
                                                                : ''
                                                                }`}
                                                        />
                                                        {statusConfig.label}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium">
                                                        {session.template_name || '템플릿 없음'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        {session.id.slice(0, 8)}...
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-xs font-mono text-muted-foreground">
                                                    {cfg?.stt_model || '-'}
                                                </td>
                                                <td className="py-3 px-3 text-xs font-mono text-muted-foreground">
                                                    {cfg?.llm_model || '-'}
                                                </td>
                                                <td className="py-3 px-3 text-xs font-mono text-muted-foreground">
                                                    {cfg?.tts_model
                                                        ? `${cfg.tts_provider}/${cfg.tts_model}`
                                                        : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {formatDate(session.started_at)}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-center">
                                                    {session.turn_count}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right font-bold text-blue-400">
                                                    {formatLatency(session.e2e_avg_ms)}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right font-mono">
                                                    {formatLatency(session.asr_avg_ms)}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right font-mono">
                                                    {formatLatency(session.llm_avg_ms)}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right font-mono">
                                                    {formatLatency(session.tts_avg_ms)}
                                                </td>
                                                <td className="py-3 px-3 text-sm text-right font-mono">
                                                    {formatLatency(session.client_load_avg_ms)}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {session.ended_at
                                                        ? formatDuration(
                                                            (new Date(session.ended_at).getTime() -
                                                                new Date(session.started_at).getTime()) /
                                                            1000
                                                        )
                                                        : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onView(session.id)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {onViewMetrics && session.status === 'completed' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => onViewMetrics(session.id)}
                                                            >
                                                                <BarChart3 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary */}
            {!isLoading && filteredSessions.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>총 {filteredSessions.length}개의 세션</span>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <span
                                className={`h-2 w-2 rounded-full ${STATUS_CONFIG.completed.color}`}
                            />
                            완료: {filteredSessions.filter((s) => s.status === 'completed').length}
                        </span>
                        <span className="flex items-center gap-1">
                            <span
                                className={`h-2 w-2 rounded-full ${STATUS_CONFIG.active.color}`}
                            />
                            진행 중: {filteredSessions.filter((s) => s.status === 'active').length}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionList;
