'use client';

/**
 * SettingsDrawer Component
 * 
 * Bottom sheet for session configuration.
 * Role-based content:
 * - Tester: speaking rate + difficulty only
 * - Admin: full pipeline model selection (STT/LLM/TTS) per participant
 * 
 * Uses the same model APIs as Run0ConfigPanel (getSTTModels, getLLMModels, getTTSOptions).
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Cpu, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Slider } from '@/shared/ui/slider';
import { Label } from '@/shared/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/shared/ui/sheet';
import type { Participant } from '../model/types';
import { getSTTModels, getLLMModels, getTTSOptions } from '../api/conversationsApi';

/** Per-participant config stored in session variant */
export interface ParticipantConfig {
    speaking_rate?: number;
    difficulty?: number;
    llm_model?: string;
    stt_model?: string;
    stt_mode?: 'sync' | 'streaming';
    stt_streaming_display?: 'immediate' | 'final';
    tts_provider?: string;
    tts_model?: string;
    voice_id?: string;
}

export interface SessionConfig {
    participants: Record<string, ParticipantConfig>;
}

interface SettingsDrawerProps {
    participants: Participant[];
    config: SessionConfig;
    onChange: (config: SessionConfig) => void;
    disabled?: boolean;
    isAdmin?: boolean;
    currentSpeakerId?: string | null;
    templateId?: string;
}

const DifficultyLabel = ({ value }: { value: number }) => {
    const labels: Record<number, { text: string; color: string }> = {
        1: { text: 'Beginner (Lv.1)', color: 'text-green-400' },
        2: { text: 'Elementary (Lv.2)', color: 'text-lime-400' },
        3: { text: 'Intermediate (Lv.3)', color: 'text-yellow-400' },
        4: { text: 'Advanced (Lv.4)', color: 'text-orange-400' },
        5: { text: 'Expert (Lv.5)', color: 'text-red-400' },
    };
    const info = labels[value] || labels[1];
    return <span className={cn('text-xs font-medium', info.color)}>{info.text}</span>;
};

export const SettingsDrawer = ({
    participants,
    config,
    onChange,
    disabled = false,
    isAdmin = false,
    currentSpeakerId,
    templateId,
}: SettingsDrawerProps) => {
    // Admin sees all participants, Tester sees only AI participants
    const displayParticipants = isAdmin
        ? participants
        : participants.filter(p => p.participant_type !== 'user');

    const [expandedParticipant, setExpandedParticipant] = useState<string | null>(
        displayParticipants[0]?.id || null
    );
    const queryClient = useQueryClient();

    // Fetch model options from backend (same as Run0ConfigPanel)
    const { data: sttModels = [] } = useQuery({
        queryKey: ['run0-stt-models'],
        queryFn: getSTTModels,
        staleTime: 5 * 60 * 1000,
        enabled: isAdmin,
    });

    const { data: llmModels = [] } = useQuery({
        queryKey: ['run0-llm-models'],
        queryFn: getLLMModels,
        staleTime: 5 * 60 * 1000,
    });

    const { data: ttsOptions } = useQuery({
        queryKey: ['run0-tts-options'],
        queryFn: getTTSOptions,
        staleTime: 5 * 60 * 1000,
        enabled: isAdmin,
    });

    const handleSave = async () => {
        if (!templateId) return;
        const { saveParticipantModels } = await import('../api/conversationsApi');
        // Save models for all currently displayed participants (which includes 'user' if admin)
        const models = displayParticipants.map(p => {
            const pConfig = getConfig(p.id);
            return {
                participant_id: p.id,
                llm_model: pConfig.llm_model || 'gemini-2.5-flash',
                stt_model: pConfig.stt_model || 'chirp_3',
                stt_mode: pConfig.stt_mode || 'streaming',
                stt_streaming_display: pConfig.stt_streaming_display || 'immediate',
                tts_model: pConfig.tts_model || '',
                tts_provider: pConfig.tts_provider || 'google-cloud',
                voice_id: pConfig.voice_id || p.voice_id || '',
                speaking_rate: pConfig.speaking_rate ?? 1.0,
                difficulty: pConfig.difficulty ?? 1,
            };
        });
        try {
            const result = await saveParticipantModels(templateId, models);
            // Invalidate template cache so saved values load correctly on refresh
            queryClient.invalidateQueries({ queryKey: ['templates', 'detail', templateId] });
            alert(`모델 설정이 저장되었습니다. (${result.count}명 업데이트)`);
        } catch (e) {
            console.error('Save failed:', e);
            alert('저장에 실패했습니다.');
        }
    };

    /** Update one or more fields for a participant — batched to avoid stale-closure bugs */
    const handleChange = (participantId: string, updates: Partial<ParticipantConfig>) => {
        const updated = { ...config };
        updated.participants = { ...updated.participants };
        updated.participants[participantId] = {
            ...(updated.participants[participantId] || {}),
            ...updates,
        };
        onChange(updated);
    };

    const getConfig = (participantId: string): ParticipantConfig => {
        return config.participants[participantId] || {};
    };

    /** Get TTS provider voices */
    const getProviderVoices = (providerId: string) => {
        return ttsOptions?.providers?.find(p => p.id === providerId)?.voices ?? [];
    };

    /** Get Gemini TTS models */
    const getGeminiModels = () => {
        return ttsOptions?.providers?.find(p => p.id === 'gemini')?.models ?? [];
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <button
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    aria-label="설정"
                >
                    <Settings className="h-5 w-5" />
                </button>
            </SheetTrigger>
            <SheetContent
                side="bottom"
                className="max-h-[80vh] rounded-t-2xl sm:max-w-[480px] sm:ml-auto"
                showCloseButton={false}
            >
                <SheetHeader className="pb-2">
                    <SheetTitle className="text-base">세션 설정</SheetTitle>
                </SheetHeader>

                <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar max-h-[60vh] pb-4">
                    {displayParticipants.map((p) => {
                        const pConfig = getConfig(p.id);
                        const isExpanded = expandedParticipant === p.id;
                        const currentTtsProvider = pConfig.tts_provider || 'google-cloud';
                        const voices = getProviderVoices(currentTtsProvider);
                        const geminiModels = getGeminiModels();

                        return (
                            <div
                                key={p.id}
                                className={cn(
                                    'rounded-xl border p-3 space-y-3 transition-colors',
                                    currentSpeakerId === p.id
                                        ? 'border-secondary/50 bg-secondary/5'
                                        : 'border-border/50 bg-card/30'
                                )}
                            >
                                {/* Participant header (clickable to expand) */}
                                <button
                                    className="flex items-center justify-between w-full text-left"
                                    onClick={() => setExpandedParticipant(isExpanded ? null : p.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={cn(
                                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                                                p.participant_type === 'moderator'
                                                    ? 'bg-violet-500'
                                                    : p.participant_type === 'user'
                                                        ? 'bg-gray-500'
                                                        : 'bg-blue-500'
                                            )}
                                        >
                                            {p.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium">
                                            {p.participant_type === 'user' ? `${p.name} (Me)` : p.name}
                                        </span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </button>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="space-y-3 pt-1">
                                        {/* Speaking Rate */}
                                        {p.participant_type !== 'user' && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs text-muted-foreground">🔊 발화 속도</Label>
                                                    <span className="text-xs font-mono text-foreground">
                                                        {(pConfig.speaking_rate || 1.0).toFixed(1)}x
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[pConfig.speaking_rate || 1.0]}
                                                    min={0.5}
                                                    max={2.0}
                                                    step={0.1}
                                                    onValueChange={([v]) => handleChange(p.id, { speaking_rate: v })}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        )}

                                        {/* Difficulty */}
                                        {p.participant_type !== 'user' && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs text-muted-foreground">🎯 난이도</Label>
                                                    <DifficultyLabel value={pConfig.difficulty || 1} />
                                                </div>
                                                <Slider
                                                    value={[pConfig.difficulty || 1]}
                                                    min={1}
                                                    max={5}
                                                    step={1}
                                                    onValueChange={([v]) => handleChange(p.id, { difficulty: v })}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        )}

                                        {/* ── Pipeline Model Selection (Admin only) ── */}
                                        {isAdmin && (
                                            <div className="space-y-3 pt-2 border-t border-border/30">
                                                <h4 className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                                                    <Cpu className="h-3 w-3" />
                                                    파이프라인 모델
                                                </h4>

                                                {/* STT Model */}
                                                {p.participant_type === 'user' && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            STT (음성→텍스트)
                                                        </Label>
                                                        <Select
                                                            value={pConfig.stt_model || 'chirp_3'}
                                                            onValueChange={(v) => handleChange(p.id, { stt_model: v })}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="STT 모델" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {sttModels.map((m) => (
                                                                    <SelectItem key={m.id} value={m.id}>
                                                                        <span>{m.name}</span>
                                                                        {m.description && (
                                                                            <span className="text-[10px] text-muted-foreground ml-1.5">
                                                                                — {m.description}
                                                                            </span>
                                                                        )}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* STT Mode (user participant only) */}
                                                {p.participant_type === 'user' && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            STT 처리 방식
                                                        </Label>
                                                        <Select
                                                            value={pConfig.stt_mode || 'streaming'}
                                                            onValueChange={(v) => handleChange(p.id, { stt_mode: v as 'sync' | 'streaming' })}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="STT 방식" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="streaming">
                                                                    <span>📡 스트리밍</span>
                                                                    <span className="text-[10px] text-muted-foreground ml-1.5">— 음성 인식 즉시 시작 (빠름)</span>
                                                                </SelectItem>
                                                                <SelectItem value="sync">
                                                                    <span>⚡ 동기식</span>
                                                                    <span className="text-[10px] text-muted-foreground ml-1.5">— 녹음 완료 후 일괄 처리</span>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* STT Streaming Display Mode (only when streaming) */}
                                                {p.participant_type === 'user' && (pConfig.stt_mode || 'streaming') === 'streaming' && (
                                                    <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            인식 텍스트 표시 방식
                                                        </Label>
                                                        <Select
                                                            value={pConfig.stt_streaming_display || 'immediate'}
                                                            onValueChange={(v) => handleChange(p.id, { stt_streaming_display: v as 'immediate' | 'final' })}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="표시 방식" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="immediate">
                                                                    <span>🔤 실시간 표시</span>
                                                                    <span className="text-[10px] text-muted-foreground ml-1.5">— 인식 중 텍스트를 즉시 표시</span>
                                                                </SelectItem>
                                                                <SelectItem value="final">
                                                                    <span>✅ 확정 후 표시</span>
                                                                    <span className="text-[10px] text-muted-foreground ml-1.5">— 인식 완료된 최종 텍스트만 표시</span>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* LLM Model */}
                                                {p.participant_type !== 'user' && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            LLM (대화 생성)
                                                        </Label>
                                                        <Select
                                                            value={pConfig.llm_model || 'gemini-2.5-flash'}
                                                            onValueChange={(v) => handleChange(p.id, { llm_model: v })}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="LLM 모델" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {llmModels.map((m) => (
                                                                    <SelectItem key={m.id} value={m.id}>
                                                                        <span>{m.name}</span>
                                                                        {m.description && (
                                                                            <span className="text-[10px] text-muted-foreground ml-1.5">
                                                                                — {m.description}
                                                                            </span>
                                                                        )}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* TTS Provider */}
                                                {p.participant_type !== 'user' && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            TTS (텍스트→음성) — 프로바이더
                                                        </Label>
                                                        <Select
                                                            value={currentTtsProvider}
                                                            onValueChange={(v) => {
                                                                handleChange(p.id, {
                                                                    tts_provider: v,
                                                                    voice_id: v === 'google-cloud' ? 'en-US-Neural2-F' : 'Kore',
                                                                    tts_model: v === 'gemini' ? 'gemini-2.5-flash-preview-tts' : '',
                                                                });
                                                            }}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="TTS 프로바이더" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ttsOptions?.providers?.map((provider) => (
                                                                    <SelectItem key={provider.id} value={provider.id}>
                                                                        <span>{provider.name}</span>
                                                                        <span className="text-[10px] text-muted-foreground ml-1.5">
                                                                            — {provider.description}
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* Gemini TTS Model (conditional) */}
                                                {p.participant_type !== 'user' && currentTtsProvider === 'gemini' && geminiModels.length > 0 && (
                                                    <div className="space-y-1 pl-3 border-l-2 border-primary/20">
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            Gemini TTS 모델
                                                        </Label>
                                                        <Select
                                                            value={pConfig.tts_model || 'gemini-2.5-flash-preview-tts'}
                                                            onValueChange={(v) => handleChange(p.id, { tts_model: v })}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="TTS 모델" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {geminiModels.map((m) => (
                                                                    <SelectItem key={m.id} value={m.id}>
                                                                        {m.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* TTS Voice */}
                                                {p.participant_type !== 'user' && (
                                                    <div className={cn(
                                                        'space-y-1',
                                                        currentTtsProvider === 'gemini' && 'pl-3 border-l-2 border-primary/20'
                                                    )}>
                                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                                            TTS 음성
                                                        </Label>
                                                        <Select
                                                            value={pConfig.voice_id || p.voice_id || 'en-US-Neural2-F'}
                                                            onValueChange={(v) => handleChange(p.id, { voice_id: v })}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue placeholder="음성 선택" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {voices.map((voice) => (
                                                                    <SelectItem key={voice.id} value={voice.id}>
                                                                        <span>
                                                                            {voice.name}
                                                                            {voice.gender && (
                                                                                <span className="text-[10px] text-muted-foreground ml-1">
                                                                                    ({voice.gender === 'FEMALE' ? '여성' : '남성'}
                                                                                    {voice.language ? `, ${voice.language}` : ''})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                {/* Summary */}
                                                <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2 font-mono">
                                                    {p.participant_type === 'user' && (
                                                        <span>STT: {pConfig.stt_model || 'chirp_3'} ({(pConfig.stt_mode || 'streaming') === 'streaming' ? '스트리밍' : '동기식'})</span>
                                                    )}
                                                    {p.participant_type !== 'user' && (
                                                        <span>LLM: {pConfig.llm_model || 'gemini-2.5-flash'}</span>
                                                    )}
                                                    {p.participant_type !== 'user' && (
                                                        <span>
                                                            TTS: {currentTtsProvider === 'gemini'
                                                                ? `Gemini / ${pConfig.voice_id || 'Kore'}`
                                                                : `Google Cloud / ${pConfig.voice_id || p.voice_id || 'default'}`
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Save button (admin only) */}
                    {isAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            disabled={disabled}
                            onClick={handleSave}
                        >
                            <Save className="h-3.5 w-3.5" />
                            모델 설정을 템플릿에 저장
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};
