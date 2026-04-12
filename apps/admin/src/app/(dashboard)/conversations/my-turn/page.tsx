'use client';

/**
 * My Turn Page — Virtual Conversation Stage
 * 
 * Mobile-first, full-screen immersive conversation experience.
 * Role-based UI: tester sees simplified settings, admin gets full config.
 */

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Play, ChevronLeft, PhoneOff } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { useAuth } from '@/(fsd)/shared/providers/AuthProvider';
import { useTemplate } from '@/features/conversations/model/useTemplates';
import { useTemplates } from '@/features/conversations/model/useTemplates';
import { createSession, endSession } from '@/features/conversations/api/conversationsApi';
import { ConversationStage } from '@/features/conversations/ui/ConversationStage';
import { SettingsDrawer } from '@/features/conversations/ui/SettingsDrawer';
import type { SessionConfig } from '@/features/conversations/ui/SettingsDrawer';
import type { TemplateListItem } from '@/features/conversations/model/types';
import { cn } from '@/lib/utils';

// ============================================================================
// Scenario Selector (mobile-first card grid)
// ============================================================================

const ScenarioSelector = ({
    onSelect,
    disabled,
}: {
    onSelect: (templateId: string) => void;
    disabled: boolean;
}) => {
    const { data, isLoading } = useTemplates();
    const templates = data?.items || [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                <div className="text-4xl">📝</div>
                <p className="text-sm text-muted-foreground text-center">
                    사용 가능한 시나리오가 없습니다.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
                {templates.map((t: TemplateListItem) => (
                    <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        disabled={disabled}
                        className={cn(
                            'w-full text-left rounded-xl border border-border/30 bg-card/50 p-4',
                            'hover:bg-card hover:border-primary/30 hover:shadow-lg',
                            'transition-all active:scale-[0.98]',
                            'disabled:opacity-50 disabled:pointer-events-none'
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-foreground truncate">
                                    {t.name}
                                </h3>
                                {t.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {t.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                    {t.topic && (
                                        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                            {t.topic}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                        👥 {t.participant_count}명
                                    </span>
                                    {t.difficulty && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {'⭐'.repeat(Math.min(t.difficulty, 5))}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <Play className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// Main Page Content
// ============================================================================

type PageState = 'selecting' | 'configuring' | 'active' | 'ended';

const MyTurnContent = () => {
    const searchParams = useSearchParams();
    const initialTemplateId = searchParams.get('templateId') || undefined;
    const { user } = useAuth();

    const isAdmin = user?.role === 'admin';

    const [pageState, setPageState] = useState<PageState>(initialTemplateId ? 'configuring' : 'selecting');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(initialTemplateId);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ participants: {} });
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userTopic, setUserTopic] = useState('');

    const { data: template, isLoading: isTemplateLoading } = useTemplate(selectedTemplateId);

    // Populate defaults when template loads — read admin-saved model values from DB
    useEffect(() => {
        if (template?.participants) {
            const initialConfig: SessionConfig = { participants: {} };
            template.participants.forEach(p => {
                const cfg = {
                    speaking_rate: p.voice_settings?.speaking_rate || 1.0,
                    difficulty: p.difficulty || 1,
                    voice_id: p.voice_id || undefined,
                    llm_model: p.llm_model || 'gemini-2.5-flash',
                    stt_model: p.stt_model || 'chirp_3',
                    stt_mode: (p.stt_mode as 'sync' | 'streaming') || 'streaming',
                    stt_streaming_display: (p.stt_streaming_display as 'immediate' | 'final') || 'immediate',
                    tts_provider: p.tts_provider || 'google-cloud',
                    tts_model: p.tts_model || undefined,
                };
                console.log(`[SessionConfig Init] ${p.name}: llm=${p.llm_model} stt=${p.stt_model} tts_p=${p.tts_provider} voice=${p.voice_id} diff=${p.difficulty} rate=${p.voice_settings?.speaking_rate}`);
                initialConfig.participants[p.id] = cfg;
            });
            setSessionConfig(initialConfig);
        }
    }, [template]);

    const handleSelectTemplate = (templateId: string) => {
        setSelectedTemplateId(templateId);
        setPageState('configuring');
    };

    const handleBack = () => {
        setSelectedTemplateId(undefined);
        setSessionId(null);
        setError(null);
        setPageState('selecting');
    };

    const handleStartSession = async () => {
        if (!selectedTemplateId) return;
        setIsCreating(true);
        setError(null);

        try {
            const variantData = {
                ...sessionConfig,
                ...(userTopic.trim() ? { user_topic: userTopic.trim() } : {}),
            };
            const variantConfig = JSON.stringify(variantData);
            const session = await createSession({
                template_id: selectedTemplateId,
                device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'pc',
                browser: navigator.userAgent,
                variant: variantConfig,
            });
            setSessionId(session.id);
            setPageState('active');
        } catch (err: any) {
            setError(err.message || 'Failed to create session');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSessionEnd = async () => {
        // Actually end the session on the server first
        if (sessionId) {
            try {
                await endSession(sessionId);
            } catch (err) {
                console.error('Failed to end session:', err);
            }
        }
        setPageState('ended');
    };

    const handleNewSession = () => {
        setSessionId(null);
        setPageState('configuring');
    };

    // ── Selecting state ──
    if (pageState === 'selecting') {
        return (
            <div className="flex flex-col h-full">
                <div className="shrink-0 px-4 py-3 border-b border-border/30">
                    <h1 className="text-lg font-bold">My Turn</h1>
                    <p className="text-xs text-muted-foreground">시나리오를 선택하세요</p>
                </div>
                <ScenarioSelector onSelect={handleSelectTemplate} disabled={false} />
            </div>
        );
    }

    // ── Configuring state ──
    if (pageState === 'configuring') {
        return (
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/30">
                    <button
                        onClick={handleBack}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm font-semibold truncate">
                            {isTemplateLoading ? '로딩 중...' : template?.name || '시나리오'}
                        </h1>
                        <p className="text-[10px] text-muted-foreground">
                            설정을 확인하고 시작하세요
                        </p>
                    </div>
                    {template && (
                        <SettingsDrawer
                            participants={template.participants}
                            config={sessionConfig}
                            onChange={setSessionConfig}
                            disabled={false}
                            isAdmin={isAdmin}
                            templateId={selectedTemplateId}
                        />
                    )}
                </div>

                {/* Template preview */}
                <div className="flex-1 overflow-y-auto px-4 py-6">
                    {isTemplateLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : template ? (
                        <div className="max-w-md mx-auto space-y-6">
                            {/* Scenario info card */}
                            <div className="bg-card/50 rounded-2xl border border-border/30 p-5">
                                <h2 className="text-lg font-bold text-foreground">{template.name}</h2>
                                {template.description && (
                                    <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                                )}
                                {template.topic && (
                                    <div className="mt-3">
                                        <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                            {template.topic}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Participants preview */}
                            <div className="bg-card/50 rounded-2xl border border-border/30 p-5">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                    참여자
                                </h3>
                                <div className="space-y-3">
                                    {template.participants
                                        .sort((a, b) => a.order_index - b.order_index)
                                        .map(p => (
                                            <div key={p.id} className="flex items-start gap-3">
                                                <div className={cn(
                                                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                                                    p.participant_type === 'user'
                                                        ? 'bg-emerald-500/20 text-emerald-400'
                                                        : p.participant_type === 'moderator'
                                                            ? 'bg-violet-500/20 text-violet-400'
                                                            : 'bg-blue-500/20 text-blue-400'
                                                )}>
                                                    {p.participant_type === 'user' ? '나' : p.name[0]}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-medium text-foreground">
                                                        {p.participant_type === 'user' ? 'Me (You)' : p.name}
                                                    </span>
                                                    {p.persona && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                            {p.persona}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Scene Context */}
                            {template.scene_context && (
                                <div className="bg-card/50 rounded-2xl border border-border/30 p-5">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                        🎬 장면 콘텍스트
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {template.scene_context}
                                    </p>
                                </div>
                            )}

                            {/* User Topic Input */}
                            {template.allow_user_topic && (
                                <div className="bg-card/50 rounded-2xl border border-border/30 p-5">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                        💬 대화 주제 설정
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        어떤 주제로 대화를 연습하고 싶은지 입력해주세요
                                    </p>
                                    <input
                                        type="text"
                                        value={userTopic}
                                        onChange={(e) => setUserTopic(e.target.value)}
                                        placeholder="예: Q3 마케팅 예산 협상, 신규 프로젝트 킥오프 미팅"
                                        className={cn(
                                            'w-full px-3 py-2.5 rounded-xl text-sm',
                                            'bg-background border border-border/50',
                                            'placeholder:text-muted-foreground/50',
                                            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                                            'transition-colors',
                                        )}
                                    />
                                </div>
                            )}

                            {error && (
                                <div className="text-sm text-destructive bg-destructive/10 rounded-xl p-3 text-center">
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Start button (bottom fixed) */}
                <div className="shrink-0 px-4 pb-6 pt-3 border-t border-border/30 bg-background">
                    <Button
                        onClick={handleStartSession}
                        disabled={!template || isCreating}
                        className="w-full h-12 rounded-xl gap-2 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                세션 생성 중...
                            </>
                        ) : (
                            <>
                                <Play className="h-5 w-5" />
                                대화 시작
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    // ── Active / Ended state ──
    if ((pageState === 'active' || pageState === 'ended') && sessionId && template) {
        return (
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border/30 bg-card/30 backdrop-blur-sm">
                    <button
                        onClick={pageState === 'ended' ? handleNewSession : undefined}
                        disabled={pageState === 'active'}
                        className={cn(
                            'p-1 rounded-lg transition-colors',
                            pageState === 'ended'
                                ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                : 'text-muted-foreground/30'
                        )}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-sm font-semibold truncate">{template.name}</h1>
                        {template.topic && (
                            <p className="text-[10px] text-muted-foreground">{template.topic}</p>
                        )}
                    </div>

                    {/* Settings during session */}
                    {pageState === 'active' && (
                        <>
                            <SettingsDrawer
                                participants={template.participants}
                                config={sessionConfig}
                                onChange={setSessionConfig}
                                disabled={true}
                                isAdmin={isAdmin}
                                templateId={selectedTemplateId}
                            />
                            <button
                                onClick={handleSessionEnd}
                                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                                <PhoneOff className="h-4 w-4" />
                            </button>
                        </>
                    )}

                    {/* New session button when ended */}
                    {pageState === 'ended' && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleNewSession}
                            className="gap-1 text-xs"
                        >
                            <Play className="h-3 w-3" />
                            다시 시작
                        </Button>
                    )}
                </div>

                {/* Stage */}
                <div className="flex-1 min-h-0">
                    <ConversationStage
                        template={template}
                        sessionId={sessionId}
                        onSessionEnd={handleSessionEnd}
                        isEnded={pageState === 'ended'}
                        userName={user?.username || 'User'}
                        sessionConfig={sessionConfig}
                        showResponseStats={isAdmin}
                    />
                </div>
            </div>
        );
    }

    return null;
};

// ============================================================================
// Page Export
// ============================================================================

const MyTurnPage = () => {
    return (
        <div className="h-[calc(100vh-4rem)] sm:h-[calc(100vh-4rem)] max-w-[600px] mx-auto">
            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
                    </div>
                }
            >
                <MyTurnContent />
            </Suspense>
        </div>
    );
};

export default MyTurnPage;
