'use client';

/**
 * TemplateEditor Component - Create/Edit conversation templates
 */

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, X } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'; // Import Tabs
import { Textarea } from '@/shared/ui/textarea'; // Assuming Textarea exists, or verify later. Wait, Textarea is usually in standard shadcn. Check `textarea.tsx` or use `textarea` html tag if not found.
import { Label } from '@/shared/ui/label'; // Import Label
import { useEffect } from 'react';
import { getDirectorPromptSpec } from '../api/conversationsApi';
import { useVoiceOptions } from '../model/useVoiceOptions';

// Voice settings are controlled in experiment page, not template
import type {
    Template,
    TemplateCreate,
    TemplateUpdate,
    ParticipantCreate,
    ParticipantType,
    ConversationMode,
    FirstSpeaker,
    ScenarioStep,
    DirectorPromptSpec,
} from '../model/types';

interface TemplateEditorProps {
    template?: Template;
    onSave: (data: TemplateCreate | TemplateUpdate) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

const PARTICIPANT_TYPES: { value: ParticipantType; label: string; color: string }[] = [
    { value: 'moderator', label: '진행자', color: 'bg-blue-500' },
    { value: 'ai', label: 'AI', color: 'bg-purple-500' },
    { value: 'user', label: '사용자', color: 'bg-green-500' },
];

const MODES: { value: ConversationMode; label: string; description: string }[] = [
    { value: 'turn_based', label: '턴 기반', description: '순서대로 대화 진행' },
    { value: 'free_form', label: '자유 형식', description: '자유롭게 대화' },
];

const FIRST_SPEAKER_OPTIONS: { value: FirstSpeaker; label: string; description: string }[] = [
    { value: 'moderator_first', label: '모더레이터', description: '진행자가 먼저 인사' },
    { value: 'ai_first', label: 'AI', description: 'AI가 먼저 인사' },
    { value: 'user_first', label: '사용자', description: '사용자가 먼저 말하기' },
];

export const TemplateEditor = ({
    template,
    onSave,
    onCancel,
    isLoading = false,
}: TemplateEditorProps) => {
    const { groupedOptions = [] } = useVoiceOptions();
    const isNew = !template;

    // Form state
    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [mode, setMode] = useState<ConversationMode>(template?.mode || 'turn_based');
    const [systemPrompt, setSystemPrompt] = useState(
        template?.system_prompt ||
        `You are a friendly English conversation partner.
You help users practice English through natural conversation.
Keep responses concise (1-3 sentences) and conversational.`
    );
    const [topic, setTopic] = useState(template?.topic || '');
    // My Turn additions
    const [firstSpeaker, setFirstSpeaker] = useState<FirstSpeaker>(template?.first_speaker || 'moderator_first');
    const [sceneContext, setSceneContext] = useState(template?.scene_context || '');
    // Director Settings
    const [directorSystemPrompt, setDirectorSystemPrompt] = useState(template?.director_system_prompt || '');
    // Note: difficulty and estimated_minutes are set in experiment page
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [participants, setParticipants] = useState<ParticipantCreate[]>(
        template?.participants?.map((p) => ({
            participant_type: p.participant_type,
            name: p.name,
            persona: p.persona || undefined,
            // Preserve model settings
            difficulty: p.difficulty ?? undefined,
            llm_model: p.llm_model ?? undefined,
            stt_model: p.stt_model ?? undefined,
            tts_model: p.tts_model ?? undefined,
            tts_provider: p.tts_provider ?? undefined,
            // voice_id is set in experiment page
            order_index: p.order_index,
        })) || [
            { participant_type: 'ai', name: 'AI Tutor', order_index: 0 },
            { participant_type: 'user', name: 'Student', order_index: 1 },
            { participant_type: 'user', name: 'Student', order_index: 1 },
        ]
    );
    const [turnSequence, setTurnSequence] = useState<ScenarioStep[]>(
        template?.turn_sequence || []
    );

    // Director Spec State
    const [directorSpec, setDirectorSpec] = useState<DirectorPromptSpec | null>(null);

    // Fetch Director Spec
    useEffect(() => {
        const fetchSpec = async () => {
            try {
                const response = await getDirectorPromptSpec();
                console.log(response);
                setDirectorSpec(response);
            } catch (error) {
                console.error("Failed to fetch director spec:", error);
            }
        };
        fetchSpec();
    }, []);

    // Add participant
    const addParticipant = () => {
        setParticipants([
            ...participants,
            {
                participant_type: 'ai',
                name: `Participant ${participants.length + 1}`,
                order_index: participants.length,
            },
        ]);
    };

    // Remove participant
    const removeParticipant = (index: number) => {
        setParticipants(
            participants
                .filter((_, i) => i !== index)
                .map((p, i) => ({ ...p, order_index: i }))
        );
    };

    // Move participant up/down
    const moveParticipant = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= participants.length) return;

        const newParticipants = [...participants];
        const temp = newParticipants[index];
        newParticipants[index] = newParticipants[newIndex];
        newParticipants[newIndex] = temp;

        // Update order_index
        setParticipants(newParticipants.map((p, i) => ({ ...p, order_index: i })));
    };

    // Update participant
    const updateParticipant = (index: number, updates: Partial<ParticipantCreate>) => {
        setParticipants(
            participants.map((p, i) => (i === index ? { ...p, ...updates } : p))
        );
    };

    // Handle save
    const handleSave = async () => {
        const data: TemplateCreate | TemplateUpdate = {
            name,
            description: description || undefined,
            mode,
            system_prompt: systemPrompt,
            topic: topic || undefined,
            // My Turn additions
            first_speaker: firstSpeaker,
            scene_context: sceneContext || undefined,
            director_system_prompt: directorSystemPrompt || undefined,
            turn_sequence: turnSequence,
            // difficulty and estimated_minutes are set in experiment page
            is_active: isActive,
            participants,
        };

        await onSave(data);
    };

    // --- Turn Sequence Handlers ---
    const addStep = () => {
        setTurnSequence([
            ...turnSequence,
            { speaker_index: 0, instruction: '' }
        ]);
    };

    const removeStep = (index: number) => {
        setTurnSequence(turnSequence.filter((_, i) => i !== index));
    };

    const updateStep = (index: number, updates: Partial<ScenarioStep>) => {
        setTurnSequence(
            turnSequence.map((step, i) => (i === index ? { ...step, ...updates } : step))
        );
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= turnSequence.length) return;
        const newSeq = [...turnSequence];
        const temp = newSeq[index];
        newSeq[index] = newSeq[newIndex];
        newSeq[newIndex] = temp;
        setTurnSequence(newSeq);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    {isNew ? '새 템플릿 생성' : '템플릿 편집'}
                </h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        <X className="h-4 w-4 mr-2" />
                        취소
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || !name || !systemPrompt}>
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? '저장 중...' : '저장'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Basic Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">기본 정보</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium block mb-1.5">
                                    템플릿 이름 *
                                </label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="예: Daily English Conversation"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium block mb-1.5">
                                    설명
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="템플릿에 대한 간단한 설명..."
                                    rows={2}
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>



                            <div className="flex justify-end gap-2 mt-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1.5">
                                        대화 모드
                                    </label>
                                    <select
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value as ConversationMode)}
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    >
                                        {MODES.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium block mb-1.5">
                                        주제
                                    </label>
                                    <Input
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="예: Travel"
                                    />
                                </div>
                            </div>

                            {/* My Turn: First Speaker Setting */}
                            <div>
                                <label className="text-sm font-medium block mb-1.5">
                                    첫 발화자
                                </label>
                                <select
                                    value={firstSpeaker}
                                    onChange={(e) => setFirstSpeaker(e.target.value as FirstSpeaker)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                    {FIRST_SPEAKER_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} - {opt.description}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    세션 시작 시 누가 먼저 말할지 결정합니다.
                                </p>
                            </div>

                            {/* Note: difficulty and estimated_minutes are set in experiment page */}

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="isActive" className="text-sm">
                                    활성화 (사용 가능)
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* System Prompt & Director Prompt Tabs */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">프롬프트 설정</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="system" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="system">참여자 공통 (System)</TabsTrigger>
                                    <TabsTrigger value="director">오케스트레이터 (Director)</TabsTrigger>
                                </TabsList>

                                <TabsContent value="system" className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label>시스템 프롬프트 *</Label>
                                        <textarea
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                            placeholder="예: Keep responses to 1-3 sentences.&#10;Use simple English vocabulary suitable for beginners."
                                            rows={6}
                                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            LLM에게 전달되는 범용 지시사항입니다. (예: 응답 길이, 난이도, 대화 스타일)
                                        </p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="director" className="space-y-4 pt-4">
                                    <div className="space-y-4">
                                        {/* Immutable Base Prompt Display */}
                                        <div className="rounded-md border bg-muted/50 p-4">
                                            <details className="group">
                                                <summary className="flex cursor-pointer items-center justify-between font-medium text-sm">
                                                    <span>View Base System Instructions (Immutable)</span>
                                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                                </summary>
                                                <div className="mt-4 space-y-4 text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                                                    <div>
                                                        <strong className="text-foreground">Base Prompt:</strong>
                                                        <div className="mt-1 p-2 bg-background rounded border">
                                                            {directorSpec?.base_prompt || "Loading..."}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong className="text-foreground">Task & Output Protocol:</strong>
                                                        <div className="mt-1 p-2 bg-background rounded border">
                                                            {directorSpec?.output_format || "Loading..."}
                                                        </div>
                                                    </div>
                                                </div>
                                            </details>
                                        </div>

                                        <Label htmlFor="director_system_prompt">Additional Instructions (Custom)</Label>
                                        <Textarea
                                            id="director_system_prompt"
                                            value={directorSystemPrompt}
                                            onChange={(e) => setDirectorSystemPrompt(e.target.value)}
                                            placeholder="Enter specific rules (e.g., 'If user speaks Korean, assign to Sarah')..."
                                            className="min-h-[200px] font-mono text-sm"
                                        />
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>These instructions are <strong>appended</strong> to the Base Prompt.</p>
                                            <div className="bg-muted p-2 rounded">
                                                <strong>Injected Variables:</strong>
                                                <br />
                                                <code>{"{{participants}}"}</code> : Participants list & roles
                                                <br />
                                                <code>{"{{script}}"}</code> : Scenario Script (Turn Sequence)
                                                <br />
                                                <code>{"{{history}}"}</code> : Conversation History
                                                <br />
                                                <code>{"{{user_input}}"}</code> : User's latest input
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Scene Context */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">장면 콘텍스트</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                value={sceneContext}
                                onChange={(e) => setSceneContext(e.target.value)}
                                placeholder="예: 친구가 내 집에 놀러와서 거실에서 이야기하는 상황.&#10;화창한 오후, 소파에 새운 장난감을 갖고 있다."
                                rows={5}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                모든 참여자가 공유하는 장면/상황 설명입니다. (참여자 페르소나와 별도)
                            </p>
                        </CardContent>
                    </Card>
                </div>




                {/* Right Column: Participants */}
                <div>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">참여자 설정</CardTitle>
                            <Button variant="outline" size="sm" onClick={addParticipant}>
                                <Plus className="h-4 w-4 mr-1" />
                                추가
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {participants.map((participant, index) => (
                                <div
                                    key={index}
                                    className="p-4 border rounded-lg space-y-3 relative"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <div className="flex flex-col">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => moveParticipant(index, 'up')}
                                                    disabled={index === 0}
                                                >
                                                    <ChevronUp className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => moveParticipant(index, 'down')}
                                                    disabled={index === participants.length - 1}
                                                >
                                                    <ChevronDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <span className="text-xs text-muted-foreground w-4">
                                                {index + 1}
                                            </span>
                                            <Badge
                                                className={
                                                    PARTICIPANT_TYPES.find(
                                                        (t) => t.value === participant.participant_type
                                                    )?.color
                                                }
                                            >
                                                {
                                                    PARTICIPANT_TYPES.find(
                                                        (t) => t.value === participant.participant_type
                                                    )?.label
                                                }
                                            </Badge>
                                        </div>
                                        {participants.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeParticipant(index)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                                이름
                                            </label>
                                            <Input
                                                value={participant.name}
                                                onChange={(e) =>
                                                    updateParticipant(index, { name: e.target.value })
                                                }
                                                placeholder="AI Tutor"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                                타입
                                            </label>
                                            <select
                                                value={participant.participant_type}
                                                onChange={(e) =>
                                                    updateParticipant(index, {
                                                        participant_type: e.target.value as ParticipantType,
                                                    })
                                                }
                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                            >
                                                {PARTICIPANT_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Persona for all participant types */}
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">
                                            페르소나
                                        </label>
                                        <textarea
                                            value={participant.persona || ''}
                                            onChange={(e) =>
                                                updateParticipant(index, {
                                                    persona: e.target.value,
                                                })
                                            }
                                            placeholder={
                                                participant.participant_type === 'ai'
                                                    ? 'AI 캐릭터 설명...'
                                                    : participant.participant_type === 'moderator'
                                                        ? '진행자 역할 설명...'
                                                        : '사용자 역할 설명...'
                                            }
                                            rows={5}
                                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        />
                                    </div>

                                    {/* My Turn Additions: Greeting & Default Voice */}
                                    {/* <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                                첫 인사말 (Greeting)
                                            </label>
                                            <Input
                                                value={participant.greeting_message || ''}
                                                onChange={(e) =>
                                                    updateParticipant(index, { greeting_message: e.target.value })
                                                }
                                                placeholder="Hello! Nice to meet you."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground block mb-1">
                                                기본 목소리 (Default Voice)
                                            </label>
                                            <select
                                                value={participant.voice_id || ''}
                                                onChange={(e) =>
                                                    updateParticipant(index, { voice_id: e.target.value || undefined })
                                                }
                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                            >
                                                <option value="">선택 안함 (기본값)</option>
                                                {groupedOptions.map((group) => (
                                                    <optgroup key={group.label} label={group.label}>
                                                        {group.options.map((v) => (
                                                            <option key={v.value} value={v.value}>
                                                                {v.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                    </div> */}
                                </div>
                            ))}

                            {participants.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    참여자를 추가해주세요
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>

            {/* Turn Sequence Editor (Full Width) */}
            {/* < Card >
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-base">시나리오 스크립트 (선택사항)</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            대화 순서와 지시사항을 미리 정의합니다. 설정하지 않으면 라운드 로빈 방식으로 진행됩니다.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={addStep}>
                        <Plus className="h-4 w-4 mr-1" />
                        스텝 추가
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {turnSequence.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                            스크립트가 없습니다. 라운드 로빈(순차) 방식이 적용됩니다.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {turnSequence.map((step, index) => (
                                <div key={index} className="flex gap-4 p-4 border rounded-lg bg-card items-start">
                                    <div className="flex flex-col gap-1 mt-2">
                                        <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full p-0">
                                            {index + 1}
                                        </Badge>
                                        <div className="flex flex-col">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5"
                                                onClick={() => moveStep(index, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ChevronUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5"
                                                onClick={() => moveStep(index, 'down')}
                                                disabled={index === turnSequence.length - 1}
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-1">
                                            <label className="text-xs text-muted-foreground block mb-1">
                                                발화자
                                            </label>
                                            <select
                                                value={step.speaker_index}
                                                onChange={(e) => updateStep(index, { speaker_index: parseInt(e.target.value) })}
                                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                            >
                                                {participants.map((p, pIdx) => (
                                                    <option key={pIdx} value={pIdx}>
                                                        {p.name} ({p.participant_type})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-xs text-muted-foreground block mb-1">
                                                지시사항 (Instruction)
                                            </label>
                                            <textarea
                                                value={step.instruction || ''}
                                                onChange={(e) => updateStep(index, { instruction: e.target.value })}
                                                placeholder="예: Ask the user about their weekend plans. / Respond with a joke."
                                                rows={2}
                                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive mt-2"
                                        onClick={() => removeStep(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card > */}
        </div >

    );
};

export default TemplateEditor;
