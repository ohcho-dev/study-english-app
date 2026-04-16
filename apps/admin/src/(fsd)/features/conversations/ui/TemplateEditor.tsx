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
// Tabs removed — prompt card switches dynamically based on pipelineMode
import { Textarea } from '@/shared/ui/textarea'; // Assuming Textarea exists, or verify later. Wait, Textarea is usually in standard shadcn. Check `textarea.tsx` or use `textarea` html tag if not found.
import { Label } from '@/shared/ui/label'; // Import Label
import { TemplatePipelineLinkCard } from '@/(fsd)/features/pipeline-editor';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDirectorPromptSpec, getLLMModels, getTemplatePrompts, updateTemplatePrompts, getPromptHistory } from '../api/conversationsApi';
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

import type { PromptHistoryItem } from '../api/conversationsApi';

/** Small inline component to load historical prompts for a module */
const PromptHistoryLoader = ({
    templateId,
    moduleName,
    onLoad,
}: {
    templateId: string;
    moduleName: string;
    onLoad: (prompt: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<PromptHistoryItem[]>([]);

    const fetchHistory = async () => {
        if (open) { setOpen(false); return; }
        setLoading(true);
        try {
            const data = await getPromptHistory(templateId, moduleName);
            setItems(data.items);
            setOpen(true);
        } catch { setItems([]); setOpen(true); }
        setLoading(false);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={fetchHistory}
                className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
                {loading ? '로딩 중...' : '📥 이전 프롬프트 불러오기'}
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-lg max-h-[300px] overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">저장된 이전 프롬프트가 없습니다.</p>
                    ) : (
                        items.map((item, i) => (
                            <button
                                key={i}
                                type="button"
                                className="w-full text-left p-2 rounded hover:bg-accent text-xs border-b last:border-0"
                                onClick={() => { onLoad(item.prompt_used); setOpen(false); }}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-foreground">
                                        {item.model_name || 'unknown'}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {item.used_at ? new Date(item.used_at).toLocaleString('ko-KR') : ''}
                                    </span>
                                </div>
                                <p className="text-muted-foreground truncate">
                                    {item.prompt_used.slice(0, 100)}...
                                </p>
                            </button>
                        ))
                    )}
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-1 p-1"
                    >
                        닫기
                    </button>
                </div>
            )}
        </div>
    );
};

export const TemplateEditor = ({
    template,
    onSave,
    onCancel,
    isLoading = false,
}: TemplateEditorProps) => {
    const { groupedOptions = [] } = useVoiceOptions();
    const isNew = !template;

    // Fetch dynamic LLM models
    const { data: llmModels = [] } = useQuery({
        queryKey: ['llm-models'],
        queryFn: getLLMModels,
        staleTime: 5 * 60 * 1000,
    });

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
    const [directorLlmModel, setDirectorLlmModel] = useState(template?.director_llm_model || 'gemini-1.5-flash-8b');
    // Note: difficulty and estimated_minutes are set in experiment page
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [allowUserTopic, setAllowUserTopic] = useState(template?.allow_user_topic ?? false);
    const [feedbackCardType, setFeedbackCardType] = useState(template?.feedback_card_type || 'default');
    const [energyFlowEnabled, setEnergyFlowEnabled] = useState(template?.energy_flow_enabled ?? false);
    const [participants, setParticipants] = useState<ParticipantCreate[]>(
        template?.participants?.map((p) => ({
            id: p.id,
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

    // v0.2 Pipeline State
    const [pipelineMode, setPipelineMode] = useState<string>('basic');
    const [evaluatorPrompt, setEvaluatorPrompt] = useState('');
    const [plannerPrompt, setPlannerPrompt] = useState('');
    const [conductorPrompt, setConductorPrompt] = useState('');
    const [evaluatorLlmModel, setEvaluatorLlmModel] = useState(template?.evaluator_llm_model || 'gemini-2.0-flash');
    const [plannerLlmModel, setPlannerLlmModel] = useState(template?.planner_llm_model || '');
    const [conductorLlmModel, setConductorLlmModel] = useState(template?.conductor_llm_model || 'gemini-2.0-flash');
    const [levelDefinitions, setLevelDefinitions] = useState(
        template?.level_definitions
            ? JSON.stringify(template.level_definitions, null, 2)
            : '[]'
    );
    const [pipelineSaving, setPipelineSaving] = useState(false);
    const [pipelineSaved, setPipelineSaved] = useState(false);

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

    // Fetch v0.2 Pipeline Prompts
    useEffect(() => {
        if (template?.id) {
            getTemplatePrompts(template.id)
                .then((data) => {
                    setPipelineMode(data.pipeline_mode || 'basic');
                    setEvaluatorPrompt(data.evaluator_prompt || '');
                    setPlannerPrompt(data.planner_prompt || '');
                    setConductorPrompt(data.conductor_prompt || '');
                    if (data.evaluator_llm_model) setEvaluatorLlmModel(data.evaluator_llm_model);
                    if (data.planner_llm_model) setPlannerLlmModel(data.planner_llm_model);
                    if (data.conductor_llm_model) setConductorLlmModel(data.conductor_llm_model);
                    if (data.level_definitions) setLevelDefinitions(JSON.stringify(data.level_definitions, null, 2));
                })
                .catch(() => { /* template may not exist yet */ });
        }
    }, [template?.id]);

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
        console.log("handleSave triggered!");
        try {
            let parsedLevelDefs = undefined;
            if (levelDefinitions && levelDefinitions.trim()) {
                try {
                    parsedLevelDefs = JSON.parse(levelDefinitions);
                } catch (e) {
                    alert('레벨 정의 JSON 형식이 올바르지 않습니다.');
                    return;
                }
            }

            const data: TemplateCreate | TemplateUpdate = {
                name,
                description: description || undefined,
                mode,
                system_prompt: systemPrompt,
                topic: topic || undefined,
                first_speaker: firstSpeaker,
                scene_context: sceneContext || undefined,
                director_system_prompt: directorSystemPrompt || undefined,
                director_llm_model: directorLlmModel || undefined,
                turn_sequence: turnSequence,
                pipeline_mode: pipelineMode || 'basic',
                evaluator_prompt: evaluatorPrompt,
                planner_prompt: plannerPrompt,
                conductor_prompt: conductorPrompt,
                evaluator_llm_model: evaluatorLlmModel || undefined,
                planner_llm_model: plannerLlmModel || undefined,
                conductor_llm_model: conductorLlmModel || undefined,
                level_definitions: parsedLevelDefs ?? null,
                is_active: isActive,
                allow_user_topic: allowUserTopic,
                feedback_card_type: feedbackCardType,
                energy_flow_enabled: energyFlowEnabled,
                participants,
            };

            console.log("Payload to save:", data);
            await onSave(data);
            console.log("onSave completed successfully!");
        } catch (error) {
            console.error("Error inside handleSave:", error);
        }
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

                            {/* Feedback Card Type */}
                            <div>
                                <label className="text-sm font-medium block mb-1.5">
                                    피드백 카드 타입
                                </label>
                                <select
                                    value={feedbackCardType}
                                    onChange={(e) => setFeedbackCardType(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                    <option value="default">Default (기본)</option>
                                    <option value="detailed">Detailed (구조화)</option>
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {feedbackCardType === 'detailed'
                                        ? 'Point, 자연스러운 한국어 등 구조화된 피드백 표시'
                                        : '교정 + 추천 표현을 단순 리스트로 표시'}
                                </p>
                                {/* Preview */}
                                <div className="mt-2 rounded-md border border-border/40 bg-card/40 p-2.5 text-xs space-y-1.5">
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">미리보기</div>
                                    {feedbackCardType === 'detailed' ? (
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-rose-400/80 text-[10px] font-semibold">교정</span>
                                                <div className="pl-3 text-foreground/70">
                                                    <span className="line-through text-rose-400/70">I have go</span>
                                                    <span className="text-muted-foreground/50 mx-1">→</span>
                                                    <span className="text-emerald-400">I have to go</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-violet-400/80 text-[10px] font-semibold">POINT</span>
                                                <div className="ml-3 rounded bg-violet-500/5 border border-violet-500/10 p-2 space-y-1">
                                                    <div className="text-foreground/70">영어에서 의무는 have로 표현합니다</div>
                                                    <div className="rounded bg-background/50 border border-border/30 px-2 py-1 space-y-0.5">
                                                        <div className="text-muted-foreground/60">나는 가야 해</div>
                                                        <div><span className="font-mono text-[10px] text-sky-400/80 w-12 inline-block">Strip</span> <span className="text-foreground/50">나, 가다, 의무</span></div>
                                                        <div><span className="font-mono text-[10px] text-amber-400/80 w-12 inline-block">Shift</span> <span className="text-foreground/50">나 가지다 가다</span></div>
                                                        <div><span className="font-mono text-[10px] text-emerald-400/80 w-12 inline-block">Capture</span> <span className="text-emerald-400 font-medium">I have to go</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-teal-400/80 text-[10px] font-semibold">이런 뜻이에요</span>
                                                <div className="pl-3 space-y-0.5">
                                                    <div><span className="text-muted-foreground/50">-</span> <span className="text-teal-300/90">나는 가야 해</span></div>
                                                    <div><span className="text-muted-foreground/50">-</span> <span className="text-teal-300/90">가야 되는데</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <div>
                                                <span className="text-rose-400/80 text-[10px] font-semibold">교정</span>
                                                <div className="pl-3 text-foreground/70">
                                                    <span className="line-through text-rose-400/70">I have go</span>
                                                    <span className="text-muted-foreground/50 mx-1">→</span>
                                                    <span className="text-emerald-400">I have to go</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-amber-400/80 text-[10px] font-semibold">추천 표현</span>
                                                <div className="pl-3">
                                                    <span className="text-muted-foreground/70">hint text</span>
                                                    <span className="text-muted-foreground/50 mx-1">→</span>
                                                    <span className="text-amber-300">example text</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pipeline Mode Selector */}
                            <div>
                                <label className="text-sm font-medium block mb-1.5">
                                    파이프라인 모드
                                </label>
                                <select
                                    value={pipelineMode}
                                    onChange={(e) => setPipelineMode(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                >
                                    <option value="basic">기본 모드 (시나리오 디렉터)</option>
                                    <option value="v0.2">v0.2 모드 (전문가 파이프라인)</option>
                                    <option value="visual">비주얼 모드 (새 빌더)</option>
                                </select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {pipelineMode === 'visual'
                                        ? '연결된 비주얼 파이프라인이 실제 세션 실행을 담당합니다.'
                                        : pipelineMode === 'v0.2'
                                            ? 'Evaluator→Planner→Conductor 3단계 분석 파이프라인'
                                            : '기존 ScenarioDirector 단일 오케스트레이터'}
                                </p>
                            </div>

                            <TemplatePipelineLinkCard
                                templateId={template?.id}
                                pipelineMode={pipelineMode}
                                onPipelineModeChange={setPipelineMode}
                            />

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

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="allowUserTopic"
                                    checked={allowUserTopic}
                                    onChange={(e) => setAllowUserTopic(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="allowUserTopic" className="text-sm">
                                    사용자 주제 직접 설정 허용
                                </label>
                                <span className="text-[10px] text-muted-foreground">
                                    세션 시작 시 사용자가 원하는 대화 주제를 직접 입력할 수 있습니다
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="energyFlowEnabled"
                                    checked={energyFlowEnabled}
                                    onChange={(e) => setEnergyFlowEnabled(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="energyFlowEnabled" className="text-sm">
                                    에너지 흐름 분석 활성화
                                </label>
                                <span className="text-[10px] text-muted-foreground">
                                    사용자 발화 후 동사 에너지 방향 비교 테이블을 병렬로 생성합니다
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dynamic Prompt Card — changes based on pipeline mode */}
                    {pipelineMode === 'v0.2' ? (
                        /* v0.2 Pipeline Prompts */
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                                    Pipeline v0.2 프롬프트
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Per-module LLM Model Selection */}
                                <div className="grid grid-cols-3 gap-4 rounded-md border p-3 bg-muted/30">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Evaluator LLM</Label>
                                        <select
                                            value={evaluatorLlmModel}
                                            onChange={(e) => setEvaluatorLlmModel(e.target.value)}
                                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
                                        >
                                            {llmModels.map((m) => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Planner LLM</Label>
                                        <select
                                            value={plannerLlmModel}
                                            onChange={(e) => setPlannerLlmModel(e.target.value)}
                                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
                                        >
                                            {llmModels.map((m) => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Conductor LLM</Label>
                                        <select
                                            value={conductorLlmModel}
                                            onChange={(e) => setConductorLlmModel(e.target.value)}
                                            className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm"
                                        >
                                            {llmModels.map((m) => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* --- Evaluator --- */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
                                        Evaluator 프롬프트
                                    </Label>
                                    <textarea
                                        value={evaluatorPrompt}
                                        onChange={(e) => setEvaluatorPrompt(e.target.value)}
                                        placeholder="Evaluator 프롬프트를 입력하세요. (비워두면 프롬프트 없이 동작합니다)"
                                        rows={4}
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        사용자 발화를 분석하여 Slot A/B/C 점수 및 진단을 JSON으로 출력합니다.
                                    </p>
                                    {template?.id && (
                                        <PromptHistoryLoader
                                            templateId={template.id}
                                            moduleName="evaluator"
                                            onLoad={(prompt) => setEvaluatorPrompt(prompt)}
                                        />
                                    )}
                                </div>

                                {/* --- Planner --- */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                                        Planner 프롬프트
                                    </Label>
                                    <textarea
                                        value={plannerPrompt}
                                        onChange={(e) => setPlannerPrompt(e.target.value)}
                                        placeholder="Planner 프롬프트를 입력하세요. (비워두면 프롬프트 없이 동작합니다)"
                                        rows={3}
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Evaluator 진단 결과를 바탕으로 LLM이 최적의 난이도 레벨을 결정합니다. (규칙 기반 fallback 포함)
                                    </p>
                                    {template?.id && (
                                        <PromptHistoryLoader
                                            templateId={template.id}
                                            moduleName="planner"
                                            onLoad={(prompt) => setPlannerPrompt(prompt)}
                                        />
                                    )}
                                </div>

                                {/* --- Conductor --- */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                                        Conductor 프롬프트
                                    </Label>
                                    <textarea
                                        value={conductorPrompt}
                                        onChange={(e) => setConductorPrompt(e.target.value)}
                                        placeholder="Conductor 프롬프트를 입력하세요. (비워두면 프롬프트 없이 동작합니다)"
                                        rows={4}
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Planner 전략을 바탕으로 페르소나별 스크립트를 LLM으로 생성합니다.
                                    </p>
                                    {template?.id && (
                                        <PromptHistoryLoader
                                            templateId={template.id}
                                            moduleName="conductor"
                                            onLoad={(prompt) => setConductorPrompt(prompt)}
                                        />
                                    )}
                                </div>

                                {/* --- Level Definitions --- */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />
                                        레벨 정의 (JSON)
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Planner/Conductor가 사용하는 단계별 레벨 정의입니다. 값을 비워두면 기본 10단계가 자동 적용되고, <code>[]</code>만 입력하면 레벨 지침이 비활성화됩니다.
                                    </p>
                                    <details className="rounded-md border bg-muted/50 p-3 group">
                                        <summary className="flex cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground">
                                            <span>📄 기본 10단계 레벨 정의 보기 (복사하여 수정 가능)</span>
                                            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                                        </summary>
                                        <div className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono p-2 bg-background rounded border max-h-[400px] overflow-y-auto">
                                            {JSON.stringify([
                                                { "level": 1, "name": "기본 SVO", "description": "Simple Subject-Verb-Object sentences", "instruction": "Use only simple SVO sentences. Example: 'I wake up. I eat breakfast. I feel good.'" },
                                                { "level": 2, "name": "시간/장소 추가", "description": "Add time and place expressions", "instruction": "Add time/place to sentences. Example: 'I wake up at 7. I eat breakfast in the kitchen.'" },
                                                { "level": 3, "name": "형용사 추가", "description": "Add adjectives to nouns", "instruction": "Add adjectives to describe nouns. Example: 'I drink hot coffee. I eat a big breakfast.'" },
                                                { "level": 4, "name": "부사 추가", "description": "Add adverbs to verbs", "instruction": "Add adverbs to describe actions. Example: 'I slowly wake up. I carefully make breakfast.'" },
                                                { "level": 5, "name": "접속사 (and/but/so)", "description": "Connect sentences with basic conjunctions", "instruction": "Connect ideas with and/but/so. Example: 'I wake up and stretch. I eat, but I'm still tired.'" },
                                                { "level": 6, "name": "복문 (because/when/if)", "description": "Use subordinate clauses", "instruction": "Use because/when/if clauses. Example: 'When I wake up, I feel tired because I slept late.'" },
                                                { "level": 7, "name": "구동사", "description": "Use phrasal verbs", "instruction": "Use phrasal verbs naturally. Example: 'I get up early. I look forward to breakfast.'" },
                                                { "level": 8, "name": "비유/관용표현", "description": "Use idioms and figurative language", "instruction": "Use idioms and figurative expressions. Example: 'I feel like a million bucks after my morning jog.'" },
                                                { "level": 9, "name": "복합 시제", "description": "Use advanced tenses", "instruction": "Use past perfect, conditionals, etc. Example: 'I had been sleeping until my alarm went off.'" },
                                                { "level": 10, "name": "원어민 수준", "description": "Native-level fluency with mixed structures", "instruction": "Mix all structures freely with natural flow. Vary sentence length, use transitions, show personality." }
                                            ], null, 2)}
                                        </div>
                                    </details>
                                    <textarea
                                        value={levelDefinitions}
                                        onChange={(e) => setLevelDefinitions(e.target.value)}
                                        placeholder={'[\n  {"level": 1, "name": "기본 SVO", "description": "Simple SVO", "instruction": "Use only simple Subject-Verb-Object sentences."},\n  {"level": 2, "name": "시간/장소 추가", "description": "Add time/place", "instruction": "Add time and place details."},\n  ...\n]'}
                                        rows={8}
                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    ) : pipelineMode === 'visual' ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">비주얼 파이프라인 모드</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-muted-foreground">
                                <p>이 템플릿은 기존 단일 프롬프트 대신 비주얼 빌더 그래프를 사용해 세션을 실행합니다.</p>
                                <p>노드별 프롬프트, 코드, 출력 계약, 병렬 브랜치는 위 연결 카드에서 선택한 파이프라인 안에서 관리합니다.</p>
                                <div className="rounded-md border bg-muted/40 p-4">
                                    <p className="font-medium text-foreground">권장 작업 순서</p>
                                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                                        <li>비주얼 파이프라인을 연결하거나 v0.2 자동 변환을 실행합니다.</li>
                                        <li>비주얼 빌더에서 출력 계약과 노드 구성을 검증합니다.</li>
                                        <li>테스트 실행으로 로그와 출력 값을 확인한 뒤 템플릿을 저장합니다.</li>
                                    </ol>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* Basic — Director Prompt */
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">오케스트레이터 (Director) 프롬프트</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                                            <p className="text-[11px] text-muted-foreground">
                                                Task & Output Protocol 항목은 제거되었습니다. Director는 기본 턴 라우팅 역할만 수행합니다.
                                            </p>
                                        </div>
                                    </details>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="director_llm_model">오케스트레이터 모델 (Director LLM)</Label>
                                    <select
                                        id="director_llm_model"
                                        value={directorLlmModel}
                                        onChange={(e) => setDirectorLlmModel(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                    >
                                        {llmModels.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        대화 흐름을 제어하는 오케스트레이터 전용 LLM 모델입니다.
                                    </p>
                                </div>

                                <div className="space-y-2">
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
                                            <code>{"{{user_input}}"}</code> : 사용자 최신 입력
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

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

                {/* Right Column: System Prompt + Participants */}
                <div className="space-y-6">
                    {/* System Prompt */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">시스템 프롬프트 (참여자 공통)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="예: Keep responses to 1-3 sentences.&#10;Use simple English vocabulary suitable for beginners."
                                rows={5}
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                LLM에게 전달되는 범용 지시사항입니다. (예: 응답 길이, 난이도, 대화 스타일)
                            </p>
                        </CardContent>
                    </Card>

                    {/* Participants */}
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
                    </Card >
                </div >

            </div >

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
