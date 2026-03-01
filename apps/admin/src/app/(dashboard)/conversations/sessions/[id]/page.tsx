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
    const [activeTab, setActiveTab] = useState('metrics');

    const { data: session, isLoading: sessionLoading } = useSession(id);
    const { data: turnsData, isLoading: turnsLoading } = useSessionTurns(id);
    const { data: metrics, isLoading: metricsLoading } = useSessionMetrics(id);

    // API returns Turn[] directly, not { items: Turn[] }
    const turns = turnsData || [];

    // Filter out warmup turns for display
    let displayTurns = turns;
    if (session?.experiment_type === 'run0' && session?.variant) {
        try {
            const variantData = typeof session.variant === 'string'
                ? JSON.parse(session.variant)
                : session.variant;

            let warmupIterations = 0;
            if (variantData?.pipeline_config?.warmup_iterations !== undefined) {
                warmupIterations = variantData.pipeline_config.warmup_iterations;
            } else if (variantData?.warmup_iterations !== undefined) {
                warmupIterations = variantData.warmup_iterations;
            }

            if (warmupIterations > 0) {
                let userTurnsSeen = 0;
                let startIndex = 0;
                for (let i = 0; i < turns.length; i++) {
                    if (turns[i].turn_type === 'user') {
                        userTurnsSeen++;
                        if (userTurnsSeen > warmupIterations) {
                            startIndex = i;
                            break;
                        }
                    }
                }
                if (userTurnsSeen <= warmupIterations && userTurnsSeen > 0) {
                    displayTurns = [];
                } else if (startIndex > 0) {
                    displayTurns = turns.slice(startIndex);
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    // Determine STT mode from session variant (for dynamic labels)
    const sttMode = (() => {
        try {
            if (!session?.variant) return 'sync';
            const v = typeof session.variant === 'string' ? JSON.parse(session.variant) : session.variant;
            return v?.pipeline_config?.stt_mode || 'sync';
        } catch { return 'sync'; }
    })();
    const isStreamingSTT = sttMode === 'streaming';

    // Format timestamp
    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ko-KR');
    };

    // Format duration
    const formatDuration = (ms?: number | null) => {
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
                        <div className="font-medium text-xl">{displayTurns.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <BarChart3 className="h-4 w-4" />
                            평균 E2E
                        </div>
                        <div className="font-medium text-xl">
                            {formatDuration(metrics?.e2e_avg_ms)}
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
                    ) : displayTurns.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                대화 내용이 없습니다
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="py-4 space-y-4">
                                {displayTurns.map((turn: Turn) => (
                                    <div
                                        key={turn.id}
                                        className={`flex gap-3 ${turn.turn_type === 'user'
                                            ? 'flex-row-reverse'
                                            : ''
                                            }`}
                                    >
                                        <div
                                            className={`max-w-[70%] p-3 rounded-lg ${turn.turn_type === 'user'
                                                ? 'bg-primary/10'
                                                : 'bg-muted'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium">
                                                    {turn.speaker_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatTime(turn.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-sm">{turn.content_text}</p>
                                            {turn.audio_url && (
                                                <audio
                                                    src={turn.audio_url}
                                                    controls
                                                    className="mt-2 w-full h-8"
                                                />
                                            )}
                                            {/* Latency Metrics Display logic */}
                                            {session?.experiment_type === 'run0' ? (
                                                /* Latency Lab (run0): Show everything on the User's turn for E2E perspective */
                                                (turn.asr_latency_ms || turn.llm_latency_ms || turn.tts_latency_ms) && (
                                                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                                                        {turn.asr_latency_ms && <span>STT: {turn.asr_latency_ms}ms</span>}
                                                        {turn.llm_latency_ms && <span>LLM: {turn.llm_latency_ms}ms</span>}
                                                        {turn.tts_latency_ms && <span>TTS: {turn.tts_latency_ms}ms</span>}
                                                    </div>
                                                )
                                            ) : (
                                                /* My Turn (regular): Separate User (STT, E2E) and AI (LLM, TTS) */
                                                <>
                                                    {turn.turn_type === 'user' && (turn.asr_latency_ms || turn.e2e_latency_ms || turn.stt_model) && (
                                                        <div className="flex gap-2 mt-2 text-xs text-muted-foreground items-center">
                                                            {turn.stt_model && <span className="font-mono bg-muted/50 px-1 rounded truncate max-w-[200px]">{turn.stt_model}</span>}
                                                            {turn.asr_latency_ms && <span>STT: {turn.asr_latency_ms}ms</span>}
                                                            {turn.e2e_latency_ms && <span className="font-semibold text-primary/80">E2E: {Math.round(turn.e2e_latency_ms)}ms</span>}
                                                        </div>
                                                    )}
                                                    {turn.turn_type !== 'user' && (turn.llm_latency_ms || turn.tts_latency_ms || turn.model_name || turn.tts_voice || turn.tts_provider) && (
                                                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground items-center">
                                                            {turn.model_name && <span className="font-mono bg-muted/50 px-1 rounded truncate max-w-[200px]" title="LLM Model">{turn.model_name}</span>}
                                                            {turn.llm_latency_ms && <span>LLM: {turn.llm_latency_ms}ms</span>}
                                                            {(turn.tts_provider || turn.tts_voice) && (
                                                                <span className="font-mono bg-muted/50 px-1 rounded truncate max-w-[200px]" title="TTS Config">
                                                                    {turn.tts_provider === 'gemini' ? 'Gemini' : turn.tts_provider === 'google-cloud' ? 'Google' : turn.tts_provider || 'TTS'}{turn.tts_voice ? ` / ${turn.tts_voice}` : ''}
                                                                </span>
                                                            )}
                                                            {turn.tts_latency_ms && <span>TTS: {turn.tts_latency_ms}ms</span>}
                                                        </div>
                                                    )}
                                                </>
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
                            {/* Pipeline Config (for Run0 sessions) */}
                            {session.variant && (() => {
                                try {
                                    const variantData = typeof session.variant === 'string'
                                        ? JSON.parse(session.variant)
                                        : session.variant;
                                    if (variantData?.experiment_type === 'run0' && variantData?.pipeline_config) {
                                        const cfg = variantData.pipeline_config;
                                        return (
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="text-base">🧪 파이프라인 설정</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-muted-foreground">STT 모델</span>
                                                            <div className="font-mono font-medium">{cfg.stt_model || '-'}</div>
                                                            {cfg.stt_mode && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {cfg.stt_mode === 'streaming' ? '스트리밍' : '동기식'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">LLM 모델</span>
                                                            <div className="font-mono font-medium">{cfg.llm_model || '-'}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">TTS 프로바이더</span>
                                                            <div className="font-mono font-medium">{cfg.tts_provider || '-'}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">TTS 모델</span>
                                                            <div className="font-mono font-medium">{cfg.tts_model || cfg.tts_voice || '-'}</div>
                                                            {cfg.tts_mode && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {cfg.tts_mode === 'streaming' ? '스트리밍' : '동기식'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">TTS 음성</span>
                                                            <div className="font-mono font-medium">{cfg.tts_voice || '-'}</div>
                                                        </div>
                                                        {cfg.system_prompt && (
                                                            <div className="col-span-full">
                                                                <span className="text-muted-foreground">시스템 프롬프트</span>
                                                                <div className="font-mono text-xs mt-1 p-2 bg-muted rounded">
                                                                    {cfg.system_prompt}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    }
                                    return null;
                                } catch {
                                    return null;
                                }
                            })()}

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
                                                {formatDuration(metrics.e2e_avg_ms)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                E2E P50
                                            </div>
                                            <div className="text-2xl font-bold">
                                                {formatDuration(metrics.e2e_p50_ms)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                E2E P95
                                            </div>
                                            <div className="text-2xl font-bold">
                                                {formatDuration(metrics.e2e_p95_ms)}
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
                                    <div className="grid grid-cols-4 gap-4 text-center">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                STT 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.asr_avg_ms)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{isStreamingSTT ? 'stop→final' : 't0→t1'}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                LLM 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.llm_avg_ms)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">t1→t2</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                TTS 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.tts_avg_ms)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">t2→t2.5</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                Client Load 평균
                                            </div>
                                            <div className="text-xl font-bold">
                                                {formatDuration(metrics.client_load_avg_ms)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">t2.5→t3</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Per-Turn Latency Table */}
                            {displayTurns.filter((t: Turn) => t.turn_type === 'user' && t.t0_user_end).length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">턴별 레이턴시</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b text-muted-foreground">
                                                        <th className="text-left py-2 px-3">#</th>
                                                        <th className="text-left py-2 px-3">STT 모델</th>
                                                        <th className="text-right py-2 px-3">STT ({isStreamingSTT ? 'stop→final' : 't0→t1'})</th>
                                                        <th className="text-right py-2 px-3">LLM (t1→t2)</th>
                                                        <th className="text-right py-2 px-3">TTS (t2→t2.5)</th>
                                                        <th className="text-right py-2 px-3">Client (t2.5→t3)</th>
                                                        <th className="text-right py-2 px-3 font-bold">E2E (t0→t3)</th>
                                                        <th className="text-right py-2 px-3">WER</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayTurns
                                                        .filter((t: Turn) => t.turn_type === 'user' && t.t0_user_end)
                                                        .map((turn: Turn, idx: number) => (
                                                            <tr key={turn.id} className="border-b last:border-0 hover:bg-muted/50">
                                                                <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                                                                <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
                                                                    {turn.stt_model || '-'}
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-mono">
                                                                    {formatDuration(turn.asr_latency_ms)}
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-mono">
                                                                    {formatDuration(turn.llm_latency_ms)}
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-mono">
                                                                    {formatDuration(turn.tts_latency_ms)}
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-mono">
                                                                    {formatDuration(turn.client_load_ms)}
                                                                </td>
                                                                <td className="text-right py-2 px-3 font-mono font-bold">
                                                                    {formatDuration(turn.e2e_latency_ms)}
                                                                </td>
                                                                <td className={`text-right py-2 px-3 font-mono ${turn.wer !== null && turn.wer !== undefined ? (Math.max(0, 1 - turn.wer) * 100 >= 90 ? 'text-green-600' : Math.max(0, 1 - turn.wer) * 100 >= 70 ? 'text-yellow-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                                                                    {turn.wer !== null && turn.wer !== undefined ? `${(Math.max(0, Math.min(100, (1 - turn.wer) * 100))).toFixed(1)}%` : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

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
