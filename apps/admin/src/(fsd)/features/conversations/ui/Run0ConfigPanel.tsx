'use client';

/**
 * Run0ConfigPanel Component - Latency Lab experiment settings
 * 
 * Vertical layout with STT/LLM/TTS model selection,
 * TTS provider cascade (Google Cloud → voice / Gemini → model → voice),
 * system prompt, test parameters, and latency targets.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, ChevronDown, ChevronUp, Target, Beaker, Cpu } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/select';

import type { Run0Config } from '../model/useRun0';
import { getSTTModels, getLLMModels, getTTSOptions } from '../api/conversationsApi';

interface Run0ConfigPanelProps {
    config: Run0Config;
    onConfigChange: (updates: Partial<Run0Config>) => void;
    defaultCollapsed?: boolean;
    disabled?: boolean;
}

export const Run0ConfigPanel = ({
    config,
    onConfigChange,
    defaultCollapsed = false,
    disabled = false,
}: Run0ConfigPanelProps) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    // Fetch model options from backend
    const { data: sttModels = [] } = useQuery({
        queryKey: ['run0-stt-models'],
        queryFn: getSTTModels,
        staleTime: 5 * 60 * 1000,
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
    });

    // Get current TTS provider data
    const currentProvider = useMemo(() => {
        return ttsOptions?.providers?.find((p) => p.id === config.ttsProvider);
    }, [ttsOptions, config.ttsProvider]);

    // Get voices for current provider
    const currentVoices = useMemo(() => {
        return currentProvider?.voices ?? [];
    }, [currentProvider]);

    // Get models for Gemini TTS
    const geminiModels = useMemo(() => {
        return currentProvider?.models ?? [];
    }, [currentProvider]);

    return (
        <Card>
            <CardHeader
                className="cursor-pointer flex flex-row items-center justify-between py-3"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    실험 설정
                </CardTitle>
                <Button variant="ghost" size="sm">
                    {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronUp className="h-4 w-4" />
                    )}
                </Button>
            </CardHeader>

            {!isCollapsed && (
                <CardContent className="space-y-6">
                    {/* Pipeline Model Selection - Vertical Layout */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <Cpu className="h-4 w-4" />
                            파이프라인 모델
                        </h3>

                        {/* STT Model */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                STT (음성→텍스트)
                            </label>
                            <Select
                                value={config.sttModel}
                                onValueChange={(value) =>
                                    onConfigChange({ sttModel: value })
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger className="w-full text-sm">
                                    <SelectValue placeholder="STT 모델 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sttModels.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            <span>{model.name}</span>
                                            {model.description && (
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    — {model.description}
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* LLM Model */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                LLM (대화 생성)
                            </label>
                            <Select
                                value={config.llmModel}
                                onValueChange={(value) =>
                                    onConfigChange({ llmModel: value })
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger className="w-full text-sm">
                                    <SelectValue placeholder="LLM 모델 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {llmModels.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            <span>{model.name}</span>
                                            {model.description && (
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    — {model.description}
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* TTS Provider */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                TTS (텍스트→음성) — 프로바이더
                            </label>
                            <Select
                                value={config.ttsProvider}
                                onValueChange={(value) => {
                                    // Reset voice when changing provider
                                    const provider = ttsOptions?.providers?.find((p) => p.id === value);
                                    const defaultVoice = value === 'google-cloud'
                                        ? 'en-US-Neural2-F'
                                        : 'Kore';
                                    const defaultModel = value === 'gemini'
                                        ? 'gemini-2.5-flash-preview-tts'
                                        : '';
                                    onConfigChange({
                                        ttsProvider: value,
                                        voiceId: defaultVoice,
                                        ttsModel: defaultModel,
                                    });
                                }}
                                disabled={disabled}
                            >
                                <SelectTrigger className="w-full text-sm">
                                    <SelectValue placeholder="TTS 프로바이더 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ttsOptions?.providers?.map((provider) => (
                                        <SelectItem key={provider.id} value={provider.id}>
                                            <span>{provider.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">
                                                — {provider.description}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Gemini TTS Model (only when provider is gemini) */}
                        {config.ttsProvider === 'gemini' && geminiModels.length > 0 && (
                            <div className="space-y-1.5 pl-4 border-l-2 border-primary/20">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Gemini TTS 모델
                                </label>
                                <Select
                                    value={config.ttsModel}
                                    onValueChange={(value) =>
                                        onConfigChange({ ttsModel: value })
                                    }
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="w-full text-sm">
                                        <SelectValue placeholder="TTS 모델 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {geminiModels.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                <span>{model.name}</span>
                                                {model.description && (
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        — {model.description}
                                                    </span>
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* TTS Voice */}
                        <div className={`space-y-1.5 ${config.ttsProvider === 'gemini' ? 'pl-4 border-l-2 border-primary/20' : ''}`}>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {config.ttsProvider === 'gemini' ? 'Gemini 음성' : 'TTS 음성'}
                            </label>
                            <Select
                                value={config.voiceId}
                                onValueChange={(value) =>
                                    onConfigChange({ voiceId: value })
                                }
                                disabled={disabled}
                            >
                                <SelectTrigger className="w-full text-sm">
                                    <SelectValue placeholder="음성 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentVoices.map((voice) => (
                                        <SelectItem key={voice.id} value={voice.id}>
                                            <span>
                                                {voice.name}
                                                {voice.gender && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        ({voice.gender === 'FEMALE' ? '여성' : '남성'}
                                                        {voice.language ? `, ${voice.language}` : ''}
                                                        {voice.description ? ` · ${voice.description}` : ''})
                                                    </span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Current selection summary */}
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 font-mono">
                            <span>STT: {config.sttModel}</span>
                            <span>LLM: {config.llmModel}</span>
                            <span>TTS: {config.ttsProvider === 'gemini' ? `Gemini (${config.ttsModel}) / ${config.voiceId}` : `Google Cloud / ${config.voiceId}`}</span>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium block">
                            시스템 프롬프트
                        </label>
                        <textarea
                            value={config.systemPrompt}
                            onChange={(e) =>
                                onConfigChange({ systemPrompt: e.target.value })
                            }
                            rows={4}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 font-mono"
                            placeholder="AI의 역할과 응답 스타일을 정의하세요..."
                            disabled={disabled}
                        />
                        <p className="text-xs text-muted-foreground">
                            레이턴시 테스트 시 AI가 사용할 시스템 프롬프트를 입력하세요.
                        </p>
                    </div>

                    {/* Basic Settings */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <Beaker className="h-4 w-4" />
                            테스트 설정
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1.5">
                                    Warmup 횟수
                                </label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={config.warmupIterations}
                                    onChange={(e) =>
                                        onConfigChange({
                                            warmupIterations: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    disabled={disabled}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    결과에 포함되지 않는 준비 횟수
                                </p>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground block mb-1.5">
                                    테스트 횟수
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={config.testIterations}
                                    onChange={(e) =>
                                        onConfigChange({
                                            testIterations: parseInt(e.target.value) || 1,
                                        })
                                    }
                                    disabled={disabled}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    메트릭 계산에 사용되는 실제 테스트 횟수
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Latency Targets */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            레이턴시 목표
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-muted-foreground block mb-1.5">
                                    목표 E2E 레이턴시 (ms)
                                </label>
                                <Input
                                    type="number"
                                    min={500}
                                    max={10000}
                                    step={100}
                                    value={config.targetLatencyMs}
                                    onChange={(e) =>
                                        onConfigChange({
                                            targetLatencyMs: parseInt(e.target.value) || 3000,
                                        })
                                    }
                                    disabled={disabled}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Green zone 기준 (통과)
                                </p>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground block mb-1.5">
                                    최대 허용 레이턴시 (ms)
                                </label>
                                <Input
                                    type="number"
                                    min={1000}
                                    max={15000}
                                    step={100}
                                    value={config.maxLatencyMs}
                                    onChange={(e) =>
                                        onConfigChange({
                                            maxLatencyMs: parseInt(e.target.value) || 5000,
                                        })
                                    }
                                    disabled={disabled}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Red zone 기준 (실패)
                                </p>
                            </div>
                        </div>

                        {/* Visual Latency Guide */}
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="h-3 w-3 rounded bg-green-500" />
                                <span>&lt; {config.targetLatencyMs}ms</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="h-3 w-3 rounded bg-yellow-500" />
                                <span>
                                    {config.targetLatencyMs}-{config.maxLatencyMs}ms
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="h-3 w-3 rounded bg-red-500" />
                                <span>&gt; {config.maxLatencyMs}ms</span>
                            </div>
                        </div>
                    </div>

                    {/* Toggle Settings */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">자동 재생</label>
                                <p className="text-xs text-muted-foreground">
                                    응답 오디오 자동 재생
                                </p>
                            </div>
                            <Switch
                                checked={config.autoPlayAudio}
                                onCheckedChange={(checked) =>
                                    onConfigChange({ autoPlayAudio: checked })
                                }
                                disabled={disabled}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">실시간 메트릭</label>
                                <p className="text-xs text-muted-foreground">
                                    각 턴마다 레이턴시 표시
                                </p>
                            </div>
                            <Switch
                                checked={config.showMetrics}
                                onCheckedChange={(checked) =>
                                    onConfigChange({ showMetrics: checked })
                                }
                                disabled={disabled}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">타임스탬프 로깅</label>
                                <p className="text-xs text-muted-foreground">
                                    클라이언트 t3 로깅 활성화
                                </p>
                            </div>
                            <Switch
                                checked={config.enableTimestampLogging}
                                onCheckedChange={(checked) =>
                                    onConfigChange({ enableTimestampLogging: checked })
                                }
                                disabled={disabled}
                            />
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export default Run0ConfigPanel;
