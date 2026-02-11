'use client';

import { useState, useEffect, useRef } from 'react';
import { Paperclip, Send, Loader2, Volume2, XCircle, Mic, Square, Trash2, Play, Check } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

import { uploadFile, getPipeline } from '../api/aiLabApi';
import { useAudioRecorder, formatDuration } from '../model/useAudioRecorder';
import { useVoiceOptions } from '@/features/conversations';
import type {
    Agent,
    AgentModelOverride,
    AttachedFile,
    DataTransferMode,
    ExperimentRunRequest,
    ModelInfo,
    ModelName,
    PipelineListItem,
} from '../model/types';

interface ExperimentRunnerProps {
    pipelines: PipelineListItem[];
    models: ModelInfo[];
    isLoading: boolean;
    onRun: (request: ExperimentRunRequest) => Promise<void>;
    onCancel?: () => void;
    defaultPipelineId?: string;
}

const DATA_TRANSFER_OPTIONS: { value: DataTransferMode; label: string; description: string }[] = [
    { value: 'A', label: 'A: 최종 출력만', description: '이전 에이전트의 마지막 응답만 전달' },
    { value: 'B', label: 'B: 전체 히스토리', description: '누적된 모든 대화 내용 전달' },
    { value: 'C', label: 'C: 원본 입력만 (모델 비교용)', description: '모든 에이전트에 동일한 원본 입력만 전달' },
];

/**
 * Experiment runner component for executing experiments
 */
export const ExperimentRunner = ({
    pipelines,
    models,
    isLoading,
    onRun,
    onCancel,
    defaultPipelineId,
}: ExperimentRunnerProps) => {
    const { groupedOptions = [] } = useVoiceOptions();
    const [pipelineId, setPipelineId] = useState(defaultPipelineId || '');
    const [modelName, setModelName] = useState<ModelName>('gemini-2.5-flash');
    const [dataTransferMode, setDataTransferMode] = useState<DataTransferMode>('A');
    const [userInput, setUserInput] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [generateAudio, setGenerateAudio] = useState(false);
    const [ttsModel, setTtsModel] = useState('gemini-2.5-flash-preview-tts');
    const [ttsVoice, setTtsVoice] = useState('Kore');
    const [includeOriginalInput, setIncludeOriginalInput] = useState(true);

    // Agent-specific model overrides
    const [enableAgentModels, setEnableAgentModels] = useState(false);
    const [pipelineAgents, setPipelineAgents] = useState<Agent[]>([]);
    const [agentModels, setAgentModels] = useState<Record<string, string>>({});

    // Audio recorder
    const recorder = useAudioRecorder();

    // Get selected model info
    const selectedModel = models.find(m => m.id === modelName);
    const supportsAudioInput = selectedModel?.supports_audio_input ?? false;

    // Load pipeline agents when pipeline changes
    useEffect(() => {
        if (!pipelineId) {
            setPipelineAgents([]);
            setAgentModels({});
            return;
        }

        const loadPipeline = async () => {
            try {
                const pipeline = await getPipeline(pipelineId);
                setPipelineAgents(pipeline.agents.sort((a, b) => a.order_index - b.order_index));
            } catch (err) {
                console.error('Failed to load pipeline:', err);
                setPipelineAgents([]);
            }
        };

        loadPipeline();
    }, [pipelineId]);

    // Reference for audio preview
    const previewAudioRef = useRef<HTMLAudioElement>(null);

    // Function to confirm and upload recording
    const confirmRecording = async () => {
        const audioBlob = recorder.audioBlob;
        if (!audioBlob) return;

        setUploading(true);
        try {
            const file = new File(
                [audioBlob],
                `recording_${Date.now()}.webm`,
                { type: audioBlob.type }
            );
            const result = await uploadFile(file);
            setAttachedFiles((prev) => [
                ...prev,
                {
                    type: 'audio' as const,
                    url: result.url,
                    name: `🎤 녹음 (${formatDuration(recorder.duration)})`,
                },
            ]);
            recorder.reset();
        } catch (error) {
            console.error('Recording upload failed:', error);
            alert('녹음 파일 업로드에 실패했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const result = await uploadFile(file);
                setAttachedFiles((prev) => [
                    ...prev,
                    {
                        type: result.type as 'image' | 'video' | 'audio',
                        url: result.url,
                        name: result.name,
                    },
                ]);
            }
        } catch (error) {
            console.error('File upload failed:', error);
            alert('파일 업로드에 실패했습니다.');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate: need either text input OR attached files
        const hasInput = userInput.trim().length > 0;
        const hasFiles = attachedFiles.length > 0;

        if (!pipelineId) {
            alert('파이프라인을 선택해주세요.');
            return;
        }

        if (!hasInput && !hasFiles) {
            alert('텍스트 입력 또는 첨부 파일이 필요합니다.');
            return;
        }

        // Build agent model overrides if enabled
        const agentModelOverrides: AgentModelOverride[] | null = enableAgentModels
            ? pipelineAgents
                .filter(agent => agentModels[agent.id] && agentModels[agent.id] !== modelName)
                .map(agent => ({
                    agent_id: agent.id,
                    model_name: agentModels[agent.id],
                }))
            : null;

        await onRun({
            pipeline_id: pipelineId,
            model_name: modelName,
            data_transfer_mode: dataTransferMode,
            include_original_input: includeOriginalInput,
            user_input: userInput.trim() || '(첨부 파일 분석)',
            attached_files: attachedFiles.length > 0 ? attachedFiles : null,
            generate_audio: generateAudio,
            tts_model: generateAudio ? ttsModel : undefined,
            tts_voice: generateAudio ? ttsVoice : undefined,
            agent_models: agentModelOverrides && agentModelOverrides.length > 0 ? agentModelOverrides : null,
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>실험 설정</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Pipeline Selection */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">파이프라인</label>
                        <select
                            value={pipelineId}
                            onChange={(e) => setPipelineId(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="">파이프라인 선택...</option>
                            {pipelines.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.agent_count}개 에이전트)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Model & Transfer Mode */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">AI 모델</label>
                            <select
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value as ModelName)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {models
                                    .filter((m) => m.category !== 'tts')
                                    .map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))}
                            </select>
                            {/* Model Info Hint */}
                            {(() => {
                                const selectedModel = models.find(m => m.id === modelName);
                                if (selectedModel?.description) {
                                    return (
                                        <div className="mt-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                                            <p>{selectedModel.description}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {selectedModel.supports_audio_input && (
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">🎤 오디오 입력</span>
                                                )}
                                                {selectedModel.supports_audio_output && (
                                                    <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">🔊 TTS</span>
                                                )}
                                                {selectedModel.supports_native_audio && (
                                                    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">🎧 양방향 오디오</span>
                                                )}
                                                {selectedModel.supports_multimodal && (
                                                    <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600">🖼️ 멀티모달</span>
                                                )}
                                            </div>
                                            {selectedModel.use_cases && selectedModel.use_cases.length > 0 && (
                                                <p className="mt-1 text-xs opacity-70">추천: {selectedModel.use_cases.join(', ')}</p>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">데이터 전달 방식</label>
                            <select
                                value={dataTransferMode}
                                onChange={(e) => setDataTransferMode(e.target.value as DataTransferMode)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {DATA_TRANSFER_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>

                            {/* Include Original Input Option - Only for Mode A */}
                            {dataTransferMode === 'A' && (
                                <div className="mt-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="includeOriginalInput"
                                            checked={includeOriginalInput}
                                            onChange={(e) => setIncludeOriginalInput(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <label htmlFor="includeOriginalInput" className="text-sm text-muted-foreground">
                                            에이전트 간 데이터 전달 시 원본 입력 포함
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Mode C Description */}
                            {dataTransferMode === 'C' && (
                                <div className="mt-2 p-2 rounded-md bg-blue-500/10 text-xs text-blue-700 dark:text-blue-300">
                                    <p>🔬 <strong>모델 비교 모드:</strong> 각 에이전트가 동일한 원본 입력을 받아
                                        모델별 성능을 직접 비교할 수 있습니다. 벤치마크 메트릭을 통해
                                        응답 시간, 처리량, 비용 등을 확인하세요.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Agent-specific Model Settings */}
                    {pipelineAgents.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="enableAgentModels"
                                    checked={enableAgentModels}
                                    onChange={(e) => setEnableAgentModels(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="enableAgentModels" className="text-sm font-medium">
                                    에이전트별 모델 설정
                                </label>
                                <span className="text-xs text-muted-foreground">
                                    (각 에이전트에 다른 모델 사용)
                                </span>
                            </div>

                            {enableAgentModels && (
                                <div className="p-3 rounded-md border bg-muted/30 space-y-2">
                                    {pipelineAgents.map((agent, idx) => (
                                        <div key={agent.id} className="flex items-center gap-3">
                                            <span className="text-sm font-medium w-6 text-muted-foreground">
                                                {idx + 1}.
                                            </span>
                                            <span className="text-sm flex-1 truncate" title={agent.role_name}>
                                                {agent.role_name}
                                            </span>
                                            <select
                                                value={agentModels[agent.id] || ''}
                                                onChange={(e) => setAgentModels(prev => ({
                                                    ...prev,
                                                    [agent.id]: e.target.value,
                                                }))}
                                                className="h-8 w-48 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                <option value="">기본 모델 사용</option>
                                                {models.map((m) => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                    {/* User Input */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">입력</label>
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="여기에 지시를 입력하세요..."
                            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                    </div>

                    {/* File Attachments & Recording */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium block">첨부 파일</label>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* File upload button */}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*,video/*,audio/*"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={uploading || recorder.status === 'recording'}
                                />
                                <Button type="button" variant="outline" size="sm" asChild disabled={uploading || recorder.status === 'recording'}>
                                    <span>
                                        {uploading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        ) : (
                                            <Paperclip className="h-4 w-4 mr-1" />
                                        )}
                                        파일 첨부
                                    </span>
                                </Button>
                            </label>

                            {/* Recording button - only show for audio-supported models */}
                            {supportsAudioInput && recorder.isSupported && (
                                <>
                                    {recorder.status === 'idle' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={recorder.startRecording}
                                            disabled={uploading}
                                        >
                                            <Mic className="h-4 w-4 mr-1" />
                                            녹음
                                        </Button>
                                    )}
                                    {recorder.status === 'recording' && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md">
                                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                                <span className="text-sm font-mono text-red-600">
                                                    {formatDuration(recorder.duration)}
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="default"
                                                size="sm"
                                                onClick={recorder.stopRecording}
                                            >
                                                <Square className="h-4 w-4 mr-1" />
                                                완료
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={recorder.cancelRecording}
                                            >
                                                <XCircle className="h-4 w-4 mr-1" />
                                                취소
                                            </Button>
                                        </div>
                                    )}
                                    {recorder.status === 'recorded' && recorder.audioUrl && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md">
                                                <Volume2 className="h-4 w-4 text-primary" />
                                                <span className="text-sm font-mono">
                                                    {formatDuration(recorder.duration)}
                                                </span>
                                            </div>
                                            <audio
                                                ref={previewAudioRef}
                                                src={recorder.audioUrl}
                                                className="h-8 max-w-[200px]"
                                                controls
                                            />
                                            <Button
                                                type="button"
                                                variant="default"
                                                size="sm"
                                                onClick={confirmRecording}
                                                disabled={uploading}
                                            >
                                                {uploading ? (
                                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Check className="h-4 w-4 mr-1" />
                                                )}
                                                확인
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={recorder.reset}
                                                disabled={uploading}
                                            >
                                                <XCircle className="h-4 w-4 mr-1" />
                                                취소
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Recording error */}
                        {recorder.error && (
                            <p className="text-sm text-destructive">{recorder.error}</p>
                        )}

                        {/* Attached files list */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {attachedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-md text-sm"
                                    >
                                        <span>{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Hint text */}
                        {attachedFiles.length === 0 && recorder.status !== 'recording' && (
                            <p className="text-xs text-muted-foreground">
                                이미지, 동영상, 오디오 파일을 첨부하거나
                                {supportsAudioInput && " 직접 녹음"}할 수 있습니다.
                            </p>
                        )}
                    </div>

                    {/* TTS Options - Only show for general models (not TTS models themselves) */}
                    {(() => {
                        const selectedModel = models.find(m => m.id === modelName);
                        // Show TTS option only for general/audio models that can generate text (not TTS-only models)
                        if (selectedModel?.category !== 'tts') {
                            return (
                                <div className="border-t pt-4">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={generateAudio}
                                                onChange={(e) => setGenerateAudio(e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <Volume2 className="h-4 w-4" />
                                            <span className="text-sm font-medium">결과 음성 생성</span>
                                        </label>
                                        {generateAudio && (
                                            <>
                                                <select
                                                    value={ttsModel}
                                                    onChange={(e) => setTtsModel(e.target.value)}
                                                    className="flex h-8 rounded-md border border-input bg-background px-2 text-sm"
                                                >
                                                    <option value="gemini-2.5-flash-preview-tts">Flash TTS (빠름)</option>
                                                    <option value="gemini-2.5-pro-preview-tts">Pro TTS (고품질)</option>
                                                </select>
                                                <select
                                                    value={ttsVoice}
                                                    onChange={(e) => setTtsVoice(e.target.value)}
                                                    className="flex h-8 rounded-md border border-input bg-background px-2 text-sm"
                                                >
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
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Submit / Cancel */}
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isLoading || !pipelineId || !userInput.trim()} className="flex-1">
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    실행 중...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    실행
                                </>
                            )}
                        </Button>
                        {isLoading && onCancel && (
                            <Button type="button" variant="destructive" onClick={onCancel}>
                                <XCircle className="h-4 w-4 mr-2" />
                                취소
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};
