'use client';

/**
 * Session Detail Page - View conversation session details and metrics
 */

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, MessageSquare, BarChart3, Volume2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

import {
    useSession,
    useSessionTurns,
    useSessionMetrics,
} from '@/(fsd)/features/conversations';
import type { Turn, SessionStatus } from '@/(fsd)/features/conversations';

interface PageParams {
    id: string;
}

const STATUS_LABELS: Record<SessionStatus, string> = {
    active: '진행 중',
    waiting_user: '사용자 대기',
    paused: '일시정지',
    completed: '완료',
    error: '오류',
};

export default function SessionDetailPage({ params }: { params: Promise<PageParams> }) {
    const { id } = use(params);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('conversation');

    const { data: session, isLoading: sessionLoading } = useSession(id);
    const { data: turnsData, isLoading: turnsLoading } = useSessionTurns(id);
    const { data: metrics, isLoading: metricsLoading } = useSessionMetrics(id);

    const turns = turnsData?.items || [];

    // Format timestamp
    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ko-KR');
    };

    // Format duration
    const formatDuration = (ms?: number) => {
        if (!ms) return '-';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    if (sessionLoading) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="py-12 text-center animate-pulse">
                        <div className="h-6 bg-muted rounded w-1/3 mx-auto mb-4" />
                        <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="text-4xl mb-4">❌</div>
                        <h3 className="text-lg font-medium mb-2">세션을 찾을 수 없습니다</h3>
                        <button
                            onClick={() => router.push('/conversations/sessions')}
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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">세션 상세</h1>
                    <p className="text-sm text-muted-foreground font-mono">{session.id}</p>
                </div>
                <Badge
                    variant={session.status === 'completed' ? 'default' : 'secondary'}
                >
                    {STATUS_LABELS[session.status]}
                </Badge>
            </div>

            {/* Session Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            시작 시간
                        </div>
                        <div className="font-medium">{formatTime(session.started_at)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="h-4 w-4" />
                            종료 시간
                        </div>
                        <div className="font-medium">
                            {session.ended_at ? formatTime(session.ended_at) : '-'}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MessageSquare className="h-4 w-4" />
                            총 턴 수
                        </div>
                        <div className="font-medium text-xl">{turns.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <BarChart3 className="h-4 w-4" />
                            평균 E2E
                        </div>
                        <div className="font-medium text-xl">
                            {formatDuration(metrics?.avg_e2e_latency_ms)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="conversation">대화 내용</TabsTrigger>
                    <TabsTrigger value="metrics">메트릭</TabsTrigger>
                </TabsList>

                {/* Conversation Tab */}
                <TabsContent value="conversation" className="space-y-4">
                    {turnsLoading ? (
                        <Card>
                            <CardContent className="py-8 text-center animate-pulse">
                                <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
                            </CardContent>
                        </Card>
                    ) : turns.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                대화 내용이 없습니다
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="py-4 space-y-4">
                                {turns.map((turn: Turn) => (
                                    <div
                                        key={turn.id}
                                        className={`flex gap-3 ${turn.turn_type === 'user_speech'
                                                ? 'flex-row-reverse'
                                                : ''
                                            }`}
                                    >
                                        <div
                                            className={`max-w-[70%] p-3 rounded-lg ${turn.turn_type === 'user_speech'
                                                    ? 'bg-primary/10'
                                                    : 'bg-muted'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium">
                                                    {turn.speaker_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatTime(turn.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-sm">{turn.content}</p>
                                            {turn.audio_url && (
                                                <audio
                                                    src={turn.audio_url}
                                                    controls
                                                    className="mt-2 w-full h-8"
                                                />
                                            )}
                                            {(turn.asr_latency_ms ||
                                                turn.llm_latency_ms ||
                                                turn.tts_latency_ms) && (
                                                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                                                        {turn.asr_latency_ms && (
                                                            <span>STT: {turn.asr_latency_ms}ms</span>
                                                        )}
                                                        {turn.llm_latency_ms && (
                                                            <span>LLM: {turn.llm_latency_ms}ms</span>
                                                        )}
                                                        {turn.tts_latency_ms && (
                                                            <span>TTS: {turn.tts_latency_ms}ms</span>
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics" className="space-y-4">
                    {metricsLoading ? (
                        <Card>
                            <CardContent className="py-8 text-center animate-pulse">
                                <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
                            </CardContent>
                        </Card>
                    ) : !metrics ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                메트릭 데이터가 없습니다
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Latency Metrics */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">레이턴시 메트릭</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                E2E 평균
                                            </div>
                                            <div className="text-2xl font-bold">
                                                {formatDuration(metrics.avg_e2e_latency_ms)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                E2E P50
                                            </div>
                                            <div className="text-2xl font-bold">
                                                {formatDuration(metrics.p50_e2e_latency_ms)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                E2E P95
                                            </div>
                                            <div className="text-2xl font-bold">
                                                {formatDuration(metrics.p95_e2e_latency_ms)}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Component Latencies */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">컴포넌트별 레이턴시</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                STT 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.avg_asr_latency_ms)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                LLM 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.avg_llm_latency_ms)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                TTS 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.avg_tts_latency_ms)}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Token Usage */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">토큰 사용량</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                총 입력 토큰
                                            </div>
                                            <div className="text-xl font-bold">
                                                {metrics.total_input_tokens?.toLocaleString() || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                총 출력 토큰
                                            </div>
                                            <div className="text-xl font-bold">
                                                {metrics.total_output_tokens?.toLocaleString() || '-'}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
