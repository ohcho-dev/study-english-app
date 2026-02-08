'use client';

/**
 * Experiment Page - Voice Pipeline Testing with Template Selection
 * 
 * Template info (read-only): mode, topic, system prompt, greeting, participants
 * Experiment settings (editable): difficulty, time, voice per participant
 */

import { useSearchParams } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import { ChevronDown, Layout, Users, MessageSquare, Settings, Volume2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

import {
    Run0Runner,
    useTemplates,
    useTemplate,
    useVoices,
} from '@/(fsd)/features/conversations';

interface ParticipantVoiceSetting {
    participantName: string;
    participantType: string;
    voiceId: string;
}

function ExperimentContent() {
    const searchParams = useSearchParams();
    const templateIdFromUrl = searchParams.get('template');

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
        templateIdFromUrl
    );

    // Experiment settings (editable)
    const [difficulty, setDifficulty] = useState(3);
    const [estimatedMinutes, setEstimatedMinutes] = useState(5);
    const [participantVoices, setParticipantVoices] = useState<ParticipantVoiceSetting[]>([]);

    const { data: templatesData, isLoading: templatesLoading } = useTemplates(1, 50, true);
    const { data: selectedTemplate } = useTemplate(selectedTemplateId || undefined);
    const { data: voices = [] } = useVoices();

    const templates = templatesData?.items || [];

    // Initialize participant voices when template changes
    useEffect(() => {
        if (selectedTemplate?.participants) {
            setParticipantVoices(
                selectedTemplate.participants
                    .filter((p) => p.participant_type === 'ai')
                    .map((p) => ({
                        participantName: p.name,
                        participantType: p.participant_type,
                        voiceId: p.voice_id || '',
                    }))
            );
        } else {
            setParticipantVoices([]);
        }
    }, [selectedTemplate]);

    const updateParticipantVoice = (name: string, voiceId: string) => {
        setParticipantVoices((prev) =>
            prev.map((p) => (p.participantName === name ? { ...p, voiceId } : p))
        );
    };

    return (
        <div className="space-y-6">
            {/* Template Selector */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Layout className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">실험 템플릿</p>
                                <p className="font-medium">
                                    {selectedTemplate?.name || '템플릿을 선택하세요'}
                                </p>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={templatesLoading}>
                                    {templatesLoading ? '로딩 중...' : '템플릿 선택'}
                                    <ChevronDown className="h-4 w-4 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <DropdownMenuItem
                                    onClick={() => setSelectedTemplateId(null)}
                                    className={!selectedTemplateId ? 'bg-accent' : ''}
                                >
                                    <span className="text-muted-foreground">
                                        기본 설정 (템플릿 없음)
                                    </span>
                                </DropdownMenuItem>
                                {templates.map((template) => (
                                    <DropdownMenuItem
                                        key={template.id}
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={selectedTemplateId === template.id ? 'bg-accent' : ''}
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium">{template.name}</div>
                                            {template.topic && (
                                                <div className="text-xs text-muted-foreground">
                                                    {template.topic}
                                                </div>
                                            )}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                {templates.length === 0 && !templatesLoading && (
                                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                        활성화된 템플릿이 없습니다
                                    </div>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            {/* Template Info (Read-only) + Experiment Settings (Editable) */}
            {selectedTemplate && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Template Info (Read-only) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                시나리오 정보
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Badge variant="outline">
                                    {selectedTemplate.mode === 'turn_based' ? '턴 기반' : '자유 형식'}
                                </Badge>
                                {selectedTemplate.topic && (
                                    <Badge variant="secondary">{selectedTemplate.topic}</Badge>
                                )}
                            </div>

                            {selectedTemplate.description && (
                                <p className="text-sm text-muted-foreground">
                                    {selectedTemplate.description}
                                </p>
                            )}

                            <div>
                                <p className="text-xs text-muted-foreground mb-1">시스템 프롬프트</p>
                                <div className="text-sm bg-muted/50 p-3 rounded-md font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                                    {selectedTemplate.system_prompt}
                                </div>
                            </div>

                            {selectedTemplate.greeting_message && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">인사 메시지</p>
                                    <div className="text-sm bg-muted/50 p-3 rounded-md">
                                        &ldquo;{selectedTemplate.greeting_message}&rdquo;
                                    </div>
                                </div>
                            )}

                            {/* Participants */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    참여자
                                </p>
                                <div className="space-y-2">
                                    {selectedTemplate.participants?.map((p, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded"
                                        >
                                            <Badge
                                                className={
                                                    p.participant_type === 'ai'
                                                        ? 'bg-purple-500'
                                                        : p.participant_type === 'moderator'
                                                            ? 'bg-blue-500'
                                                            : 'bg-green-500'
                                                }
                                            >
                                                {p.participant_type === 'ai'
                                                    ? 'AI'
                                                    : p.participant_type === 'moderator'
                                                        ? '진행자'
                                                        : '사용자'}
                                            </Badge>
                                            <span className="font-medium">{p.name}</span>
                                            {p.persona && (
                                                <span className="text-muted-foreground text-xs truncate">
                                                    - {p.persona}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right: Experiment Settings (Editable) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                실험 설정
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">
                                        난이도 (1-5)
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">
                                        예상 시간 (분)
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={estimatedMinutes}
                                        onChange={(e) =>
                                            setEstimatedMinutes(parseInt(e.target.value) || 1)
                                        }
                                    />
                                </div>
                            </div>

                            {/* Voice Settings for AI Participants */}
                            {participantVoices.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium mb-2 flex items-center gap-1">
                                        <Volume2 className="h-4 w-4" />
                                        AI 음성 설정
                                    </p>
                                    <div className="space-y-3">
                                        {participantVoices.map((pv) => (
                                            <div key={pv.participantName}>
                                                <label className="text-xs text-muted-foreground block mb-1">
                                                    {pv.participantName}
                                                </label>
                                                <select
                                                    value={pv.voiceId}
                                                    onChange={(e) =>
                                                        updateParticipantVoice(pv.participantName, e.target.value)
                                                    }
                                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                                >
                                                    <option value="">기본 음성</option>
                                                    {voices.map((v) => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.name} ({v.gender})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Run0 Runner */}
            <Run0Runner
                template={selectedTemplate || undefined}
                templateId={selectedTemplateId || undefined}
                experimentSettings={{
                    difficulty,
                    estimatedMinutes,
                    participantVoices,
                }}
            />
        </div>
    );
}

export default function ExperimentPage() {
    return (
        <div className="p-6">
            <Suspense
                fallback={
                    <Card>
                        <CardContent className="py-8 text-center">로딩 중...</CardContent>
                    </Card>
                }
            >
                <ExperimentContent />
            </Suspense>
        </div>
    );
}
