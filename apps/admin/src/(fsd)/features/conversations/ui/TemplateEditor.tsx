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

import { useVoices } from '../model/useRun0';
import type {
    Template,
    TemplateCreate,
    TemplateUpdate,
    ParticipantCreate,
    ParticipantType,
    ConversationMode,
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

export const TemplateEditor = ({
    template,
    onSave,
    onCancel,
    isLoading = false,
}: TemplateEditorProps) => {
    const isNew = !template;
    const { data: voices = [] } = useVoices();

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
    const [greetingMessage, setGreetingMessage] = useState(template?.greeting_message || '');
    const [topic, setTopic] = useState(template?.topic || '');
    const [difficulty, setDifficulty] = useState(template?.difficulty || 3);
    const [estimatedMinutes, setEstimatedMinutes] = useState(template?.estimated_minutes || 5);
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [participants, setParticipants] = useState<ParticipantCreate[]>(
        template?.participants?.map((p) => ({
            participant_type: p.participant_type,
            name: p.name,
            persona: p.persona || undefined,
            voice_id: p.voice_id || undefined,
            order_index: p.order_index,
        })) || [
            { participant_type: 'ai', name: 'AI Tutor', order_index: 0 },
            { participant_type: 'user', name: 'Student', order_index: 1 },
        ]
    );

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
            greeting_message: greetingMessage || undefined,
            topic: topic || undefined,
            difficulty,
            estimated_minutes: estimatedMinutes,
            is_active: isActive,
            participants,
        };

        await onSave(data);
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

                            <div className="grid grid-cols-2 gap-4">
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

                    {/* System Prompt */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">시스템 프롬프트 *</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="AI의 역할과 행동 지침..."
                                rows={6}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                            />
                        </CardContent>
                    </Card>

                    {/* Greeting Message */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">인사 메시지</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                value={greetingMessage}
                                onChange={(e) => setGreetingMessage(e.target.value)}
                                placeholder="대화 시작 시 AI가 먼저 하는 인사..."
                                rows={2}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
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

                                    {participant.participant_type === 'ai' && (
                                        <>
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
                                                    placeholder="AI 캐릭터 설명..."
                                                    rows={2}
                                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs text-muted-foreground block mb-1">
                                                    TTS 음성
                                                </label>
                                                <select
                                                    value={participant.voice_id || ''}
                                                    onChange={(e) =>
                                                        updateParticipant(index, {
                                                            voice_id: e.target.value || undefined,
                                                        })
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
                                        </>
                                    )}
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
        </div>
    );
};

export default TemplateEditor;
