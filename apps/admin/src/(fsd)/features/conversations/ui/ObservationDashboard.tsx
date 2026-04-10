'use client';

/**
 * ObservationDashboard — 세션 관찰 대시보드 탭 전체 UI
 *
 * Layer 1+2 규칙 기반 자동 지표, Layer 3 AI 분석 결과, Reporting LLM 프롬프트 편집기,
 * Excel 다운로드를 모두 포함합니다.
 */

import { useState } from 'react';
import { Eye, Download, Brain, TrendingUp, AlertCircle } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

import {
    useSessionObservation,
    useGenerateObservation,
    useAnalyzeObservation,
    useReportingPrompt,
    exportObservationExcel,
} from '@/(fsd)/features/conversations';
import type { SessionObservation } from '@/(fsd)/features/conversations';

interface ObservationDashboardProps {
    sessionId: string;
}

export function ObservationDashboard({ sessionId }: ObservationDashboardProps) {
    const { data: observation, isLoading: obsLoading } = useSessionObservation(sessionId);
    const generateObs = useGenerateObservation();
    const analyzeObs = useAnalyzeObservation();
    const { data: reportingPrompt } = useReportingPrompt();

    const [excelLoading, setExcelLoading] = useState(false);

    // ── 로딩 / 빈 상태 ──────────────────────────────────────────

    if (obsLoading) {
        return (
            <Card>
                <CardContent className="py-8 text-center animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
                </CardContent>
            </Card>
        );
    }

    if (!observation) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground space-y-3">
                    <Eye className="h-8 w-8 mx-auto opacity-30" />
                    <p>관찰 데이터가 아직 생성되지 않았습니다</p>
                    <p className="text-xs">세션 완료 시 자동 생성되거나, 수동으로 생성할 수 있습니다</p>
                    <Button
                        size="sm"
                        onClick={() => generateObs.mutate(sessionId)}
                        disabled={generateObs.isPending}
                    >
                        {generateObs.isPending ? (
                            <><span className="animate-spin mr-1">⏳</span>생성 중...</>
                        ) : (
                            '관찰 데이터 생성'
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── 상단 툴바: Layer 1+2 재생성 ── */}
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateObs.mutate(sessionId)}
                    disabled={generateObs.isPending}
                    className="text-xs text-muted-foreground"
                >
                    {generateObs.isPending ? '재생성 중...' : '⟳ Layer 1+2 재생성'}
                </Button>
            </div>

            {/* ── 핵심 지표 카드 4개 ── */}
            <MetricCards observation={observation} />

            {/* ── 발화 길이 추이 미니 차트 ── */}
            {observation.layer1.word_count_per_turn && observation.layer1.word_count_per_turn.length > 0 && (
                <UtteranceChart observation={observation} />
            )}

            {/* ── Layer 1+2 상세 메트릭 ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Layer1Card observation={observation} />
                <Layer2Card observation={observation} />
            </div>

            {/* ── AI 분석 영역 (Layer 3) ── */}
            <AiAnalysisCard
                observation={observation}
                sessionId={sessionId}
                analyzeObs={analyzeObs}
            />

            {/* ── AI 분석 설정 인포 (읽기전용, 수정은 목록 페이지 헤더의 모달에서) ── */}
            {reportingPrompt && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>
                        AI 분석 프롬프트:{' '}
                        <span className="font-medium text-foreground">
                            {reportingPrompt.is_default
                                ? '기본 (코드 내장)'
                                : `${reportingPrompt.name} · ${reportingPrompt.llm_model}`}
                        </span>
                    </span>
                    <span className="opacity-60">변경하려면 세션 목록 &gt; AI 분석 설정</span>
                </div>
            )}

            {/* ── Excel 다운로드 ── */}
            <Card>
                <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            전체 관찰 데이터 + 턴별 상세를 Excel로 내보냅니다
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                setExcelLoading(true);
                                try {
                                    await exportObservationExcel(sessionId);
                                } catch (e) {
                                    console.error('Excel export failed:', e);
                                } finally {
                                    setExcelLoading(false);
                                }
                            }}
                            disabled={excelLoading}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            {excelLoading ? '다운로드 중...' : 'Excel 다운로드'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Sub-components
// ============================================================================

function MetricCards({ observation }: { observation: SessionObservation }) {
    const engagementVariant = (level: string | null) => {
        if (level === 'high') return 'default';
        if (level === 'medium') return 'secondary';
        return 'destructive';
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 참여도 */}
            <Card>
                <CardContent className="py-4 text-center">
                    <div className="text-sm text-muted-foreground mb-1">참여도</div>
                    <div className="text-2xl font-bold">
                        {observation.has_layer3 && observation.layer3.engagement_level ? (
                            <Badge
                                variant={engagementVariant(observation.layer3.engagement_level)}
                                className="text-lg px-3 py-1"
                            >
                                {observation.layer3.engagement_level.toUpperCase()}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground text-base">-</span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 상세도 점수 */}
            <Card>
                <CardContent className="py-4 text-center">
                    <div className="text-sm text-muted-foreground mb-1">상세도</div>
                    <div className="text-2xl font-bold">
                        {observation.layer3.elaboration_adequacy?.overall_score ?? '-'}
                        {observation.layer3.elaboration_adequacy?.overall_score != null && (
                            <span className="text-sm font-normal text-muted-foreground">/100</span>
                        )}
                    </div>
                    {observation.layer3.elaboration_adequacy?.trend && (
                        <div className="text-xs mt-1 text-muted-foreground">
                            {observation.layer3.elaboration_adequacy.trend === 'improving' && '⬆ 향상'}
                            {observation.layer3.elaboration_adequacy.trend === 'stable' && '➔ 안정'}
                            {observation.layer3.elaboration_adequacy.trend === 'declining' && '⬇ 하락'}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 최고 레벨 */}
            <Card>
                <CardContent className="py-4 text-center">
                    <div className="text-sm text-muted-foreground mb-1">최고 레벨</div>
                    <div className="text-2xl font-bold">
                        {observation.layer2.max_level_reached != null
                            ? `Lv.${observation.layer2.max_level_reached}`
                            : '-'}
                    </div>
                    {observation.layer2.level_progression && observation.layer2.level_progression.length > 1 && (
                        <div className="text-xs mt-1 text-muted-foreground">
                            {observation.layer2.level_progression[0]} →{' '}
                            {observation.layer2.level_progression[observation.layer2.level_progression.length - 1]}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 교정 횟수 */}
            <Card>
                <CardContent className="py-4 text-center">
                    <div className="text-sm text-muted-foreground mb-1">교정 횟수</div>
                    <div className="text-2xl font-bold">
                        {observation.layer2.correction_count}
                        <span className="text-sm font-normal text-muted-foreground">회</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function UtteranceChart({ observation }: { observation: SessionObservation }) {
    const counts = observation.layer1.word_count_per_turn!;
    const maxWc = Math.max(...counts, 1);

    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    발화 길이 추이
                    {observation.layer1.utterance_length_trend && (
                        <Badge variant="outline" className="text-xs">
                            {observation.layer1.utterance_length_trend === 'improving' && '⬆ 향상'}
                            {observation.layer1.utterance_length_trend === 'stable' && '➔ 안정'}
                            {observation.layer1.utterance_length_trend === 'declining' && '⬇ 하락'}
                            {observation.layer1.utterance_length_trend === 'insufficient_data' && '데이터 부족'}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
                <div className="flex items-end gap-1 h-16">
                    {counts.map((wc, idx) => {
                        const height = (wc / maxWc) * 100;
                        return (
                            <div
                                key={idx}
                                className="flex-1 rounded-t transition-all"
                                style={{
                                    height: `${Math.max(height, 4)}%`,
                                    backgroundColor:
                                        wc <= 3
                                            ? 'hsl(var(--destructive))'
                                            : 'hsl(var(--primary))',
                                    opacity: 0.6 + (idx / (counts.length || 1)) * 0.4,
                                }}
                                title={`Turn ${idx + 1}: ${wc} words`}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>평균: {observation.layer1.avg_user_utterance_length?.toFixed(1)} 단어</span>
                    <span>짧은 답변: {observation.layer1.short_reply_count}회</span>
                </div>
            </CardContent>
        </Card>
    );
}

function Layer1Card({ observation }: { observation: SessionObservation }) {
    const l1 = observation.layer1;
    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base">📊 학습 행동 지표</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <MetricRow
                    label="세션 시간"
                    value={
                        l1.session_duration_sec
                            ? `${Math.floor(l1.session_duration_sec / 60)}분 ${Math.round(l1.session_duration_sec % 60)}초`
                            : '-'
                    }
                />
                <MetricRow
                    label="사용자 턴 / AI 턴"
                    value={`${l1.total_user_turns} / ${l1.total_ai_turns}`}
                />
                <MetricRow
                    label="평균 응답 간격"
                    value={
                        l1.avg_user_response_interval_sec
                            ? `${l1.avg_user_response_interval_sec.toFixed(1)}초`
                            : '-'
                    }
                />
                <MetricRow
                    label="첫 응답 시간"
                    value={
                        l1.first_user_response_time_sec
                            ? `${l1.first_user_response_time_sec.toFixed(1)}초`
                            : '-'
                    }
                />
                <MetricRow label="긴 간격 (>5초)" value={`${l1.long_gap_count}회`} />
                {l1.long_latency_turn_count != null && l1.long_latency_turn_count > 0 && (
                    <MetricRow
                        label="서버 응답 >5초 턴"
                        value={`${l1.long_latency_turn_count}회${
                            l1.long_latency_turn_ratio != null
                                ? ` (${Math.round(l1.long_latency_turn_ratio * 100)}%)`
                                : ''
                        }`}
                    />
                )}
                <div className="flex justify-between">
                    <span className="text-muted-foreground">완료 상태</span>
                    <Badge variant="outline" className="text-xs">
                        {l1.completion_status || '-'}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}


// primary_issue 코드 → 한국어 라벨 매핑
const ISSUE_LABELS: Record<string, string> = {
    INCOMPLETE_EXPRESSION: '표현 미완성',
    MISSING_KEY_CONCEPT: '핵심 개념 누락',
    GRAMMAR_ERROR: '문법 오류',
    FLUENCY_ISSUE: '유창성 부족',
    PRONUNCIATION: '발음 문제',
    VOCABULARY: '어휘 부족',
};

function issueLabel(code: string): string {
    return ISSUE_LABELS[code] ?? code;
}

function Layer2Card({ observation }: { observation: SessionObservation }) {
    const l2 = observation.layer2;
    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Pipeline 분석 요약
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">평균 점수</span>
                    <div className="text-right">
                        <span className="font-medium">
                            {l2.avg_overall_score != null ? l2.avg_overall_score.toFixed(1) : '-'}
                        </span>
                        {/* score_trend: null이면 표시 안 함 (턴 부족으로 계산 불가) */}
                        {l2.score_trend && (
                            <span className="ml-1 text-xs text-muted-foreground">
                                {l2.score_trend === 'improving' && '⬆ 향상'}
                                {l2.score_trend === 'stable' && '➔ 안정'}
                                {l2.score_trend === 'declining' && '⬇ 하락'}
                            </span>
                        )}
                    </div>
                </div>
                <MetricRow
                    label="레벨 업 / 다운"
                    value={`⬆${l2.level_up_count} / ⬇${l2.level_down_count}`}
                />
                {l2.primary_issues && l2.primary_issues.length > 0 && (
                    <div className="pt-2 border-t">
                        <div className="text-muted-foreground mb-1">핵심 이슈 TOP 3</div>
                        <div className="space-y-1">
                            {l2.primary_issues.map((issue, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{idx + 1}.</span>
                                    <Badge variant="outline" className="text-xs">
                                        {issueLabel(issue)}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function AiAnalysisCard({
    observation,
    sessionId,
    analyzeObs,
}: {
    observation: SessionObservation;
    sessionId: string;
    analyzeObs: ReturnType<typeof useAnalyzeObservation>;
}) {
    const l3 = observation.layer3;

    return (
        <Card>
            <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        AI 분석 (Layer 3)
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {observation.reporting_llm_model && (
                            <span className="text-xs text-muted-foreground font-mono">
                                {observation.reporting_llm_model}
                                {observation.reporting_llm_duration_ms &&
                                    ` · ${(observation.reporting_llm_duration_ms / 1000).toFixed(1)}s`}
                            </span>
                        )}
                        <Button
                            size="sm"
                            onClick={() => analyzeObs.mutate(sessionId)}
                            disabled={analyzeObs.isPending}
                        >
                            {analyzeObs.isPending ? (
                                <><span className="animate-spin mr-1">⏳</span>분석 중...</>
                            ) : observation.has_layer3 ? (
                                '재분석'
                            ) : (
                                'AI 분석 실행'
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {!observation.has_layer3 ? (
                    <div className="text-center text-muted-foreground py-6 space-y-1">
                        <Brain className="h-8 w-8 mx-auto opacity-30" />
                        <p>"AI 분석 실행" 버튼을 눌러 학습 행동을 분석하세요</p>
                        <p className="text-xs">Gemini가 전체 대화를 분석합니다 (약 30~60초 소요)</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 학습 행동 요약 */}
                        {l3.learning_behavior_summary && (
                            <div className="p-3 bg-muted rounded-lg">
                                <div className="text-sm font-medium mb-1">📝 학습 행동 요약</div>
                                <p className="text-sm">{l3.learning_behavior_summary}</p>
                            </div>
                        )}

                        {/* 핵심 포인트 / 어려움 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {l3.key_learning_points && l3.key_learning_points.length > 0 && (
                                <div className="p-3 border rounded-lg">
                                    <div className="text-sm font-medium mb-1 text-green-700">
                                        ✅ 핵심 학습 포인트
                                    </div>
                                    <ul className="text-sm space-y-1">
                                        {l3.key_learning_points.map((point, idx) => (
                                            <li key={idx} className="pl-2 border-l-2 border-green-300">
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {l3.struggle_points && l3.struggle_points.length > 0 && (
                                <div className="p-3 border rounded-lg">
                                    <div className="text-sm font-medium mb-1 text-red-700">
                                        ⚠️ 어려움 포인트
                                    </div>
                                    <ul className="text-sm space-y-1">
                                        {l3.struggle_points.map((point, idx) => (
                                            <li key={idx} className="pl-2 border-l-2 border-red-300">
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* 개선 제안 */}
                        {l3.improvement_suggestions && l3.improvement_suggestions.length > 0 && (
                            <div className="p-3 border rounded-lg">
                                <div className="text-sm font-medium mb-1">💡 개선 제안</div>
                                <ul className="text-sm space-y-1">
                                    {l3.improvement_suggestions.map((sug, idx) => (
                                        <li key={idx} className="pl-2 border-l-2 border-blue-300">
                                            {sug}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 상세 분석 — 아코디언 */}
                        <details className="border rounded-lg">
                            <summary className="p-3 cursor-pointer text-sm font-medium hover:bg-muted/50">
                                📊 상세 분석 결과 보기
                            </summary>
                            <div className="p-3 pt-0 space-y-3 text-sm">
                                <div className="grid grid-cols-3 gap-3 pt-3">
                                    <LabelValue label="대화 스타일" value={l3.communication_style} />
                                    <LabelValue label="주제 유지율" value={l3.topic_maintenance_score} />
                                    <LabelValue label="자연스러움" value={l3.natural_conversation_score} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <LabelValue
                                        label="되묻기 횟수"
                                        value={
                                            `${l3.explicit_clarification_analysis?.count ?? 0}회` +
                                            (l3.clarification_success && !l3.clarification_success.no_clarification
                                                ? ` (성공: ${l3.clarification_success.successful}/${l3.clarification_success.total})`
                                                : '')
                                        }
                                    />
                                    <LabelValue
                                        label="대처 시도"
                                        value={`${l3.coping_attempt?.count ?? 0}회`}
                                    />
                                </div>
                                {l3.avoidance_vs_response && (
                                    <div>
                                        <span className="text-muted-foreground">회피 vs 대응</span>
                                        <div className="font-medium flex items-center gap-2">
                                            회피 {l3.avoidance_vs_response.avoidance_count} / 대응{' '}
                                            {l3.avoidance_vs_response.response_count}
                                            <Badge variant="outline" className="text-xs">
                                                {l3.avoidance_vs_response.pattern}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <LabelValue label="반응 시작 품질" value={l3.response_start_quality} />
                                    <LabelValue label="흐름 유지" value={l3.flow_maintenance} />
                                </div>
                            </div>
                        </details>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── 헬퍼 ────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string | number | undefined | null }) {
    return (
        <div className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value ?? '-'}</span>
        </div>
    );
}

function LabelValue({ label, value }: { label: string; value: string | number | undefined | null }) {
    return (
        <div>
            <span className="text-muted-foreground">{label}</span>
            <div className="font-medium">{value ?? '-'}</div>
        </div>
    );
}
