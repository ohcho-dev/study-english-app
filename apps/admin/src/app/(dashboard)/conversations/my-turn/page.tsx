'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Play, PhoneOff, Wifi, WifiOff } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { MyTurnRunner, TemplateSelector, SessionSettings } from '@/features/conversations';
import type { SessionConfig } from '@/features/conversations/ui/SessionSettings';
import { useTemplate } from '@/features/conversations/model/useTemplates';
import { createSession } from '@/features/conversations/api/conversationsApi';

function MyTurnContent() {
    const searchParams = useSearchParams();
    const initialTemplateId = searchParams.get('templateId') || undefined;

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(initialTemplateId);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionEnded, setSessionEnded] = useState(false);
    const [sessionConfig, setSessionConfig] = useState<SessionConfig>({ participants: {} });
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Current speaker state (shared between runner and settings)
    const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);

    const { data: template, isLoading: isTemplateLoading } = useTemplate(selectedTemplateId);

    // Reset session when template changes
    useEffect(() => {
        setSessionId(null);
        setSessionEnded(false);
        setError(null);
        setCurrentSpeakerId(null);
        setSessionConfig({ participants: {} });
    }, [selectedTemplateId]);

    // Populate defaults when template loads
    useEffect(() => {
        if (template?.participants) {
            const initialConfig: SessionConfig = { participants: {} };
            template.participants.forEach(p => {
                initialConfig.participants[p.id] = {
                    speaking_rate: p.voice_settings?.speaking_rate || 1.0,
                    difficulty: 1,
                    voice_id: p.voice_id || undefined,
                    llm_model: "gemini-2.5-flash"
                };
            });
            setSessionConfig(initialConfig);
        }
    }, [template]);

    const handleStartSession = async () => {
        if (!selectedTemplateId) return;

        setIsCreating(true);
        setError(null);
        // Clear old session when starting new one
        setSessionId(null);
        setSessionEnded(false);

        try {
            const variantConfig = JSON.stringify(sessionConfig);
            const session = await createSession({
                template_id: selectedTemplateId,
                device_type: 'pc',
                browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                variant: variantConfig,
            });
            setSessionId(session.id);
        } catch (err: any) {
            console.error('Failed to create session:', err);
            setError(err.message || 'Failed to create session');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSessionEnd = () => {
        // Don't clear sessionId — keep chat visible until new session starts
        setSessionEnded(true);
        setCurrentSpeakerId(null);
    };

    const isActive = !!sessionId && !sessionEnded;

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* ── Header Bar ── */}
            <div className="flex items-center justify-between border-b border-border px-1 py-3 shrink-0">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold">My Turn Conversation</h1>
                        <p className="text-xs text-muted-foreground">실시간 다자간 대화 학습</p>
                    </div>
                    <div className="w-56">
                        <TemplateSelector
                            value={selectedTemplateId}
                            onChange={setSelectedTemplateId}
                            disabled={isActive || isCreating}
                        />
                    </div>
                    {isTemplateLoading && (
                        <Loader2 className="animate-spin h-4 w-4 text-muted-foreground" />
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {error && (
                        <Badge variant="destructive" className="text-xs">{error}</Badge>
                    )}
                    {!isActive ? (
                        <Button
                            onClick={handleStartSession}
                            disabled={!selectedTemplateId || isCreating || !template}
                            className="gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    세션 생성 중...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    Start Session
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button variant="destructive" onClick={handleSessionEnd} className="gap-2">
                            <PhoneOff className="h-4 w-4" />
                            종료
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Main Content: 2-column layout ── */}
            <div className="flex flex-1 min-h-0 gap-4 pt-4">
                {/* LEFT: Participant Settings (always visible) */}
                <div className="w-80 shrink-0 flex flex-col min-h-0">
                    {template ? (
                        <SessionSettings
                            participants={template.participants}
                            config={sessionConfig}
                            onChange={setSessionConfig}
                            disabled={isActive}
                            currentSpeakerId={currentSpeakerId}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg bg-card/50">
                            <p className="text-sm text-muted-foreground">
                                템플릿을 선택하세요
                            </p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Chat Panel */}
                <div className="flex-1 min-h-0 flex flex-col">
                    {sessionId && template ? (
                        <MyTurnRunner
                            template={template}
                            sessionId={sessionId}
                            onSessionEnd={handleSessionEnd}
                            onStatusChange={(isRunning) => console.log('Session status:', isRunning)}
                            onSpeakerChange={setCurrentSpeakerId}
                            isEnded={sessionEnded}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-card/50">
                            <div className="text-center space-y-2">
                                <div className="text-4xl">💬</div>
                                <p className="text-muted-foreground text-sm">
                                    {template
                                        ? 'Start Session을 클릭하여 대화를 시작하세요'
                                        : '왼쪽에서 템플릿을 선택하세요'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MyTurnPage() {
    return (
        <div className="px-6 py-4 h-full">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>}>
                <MyTurnContent />
            </Suspense>
        </div>
    );
}
