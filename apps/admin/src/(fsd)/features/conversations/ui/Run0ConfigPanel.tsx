'use client';

/**
 * Run0ConfigPanel Component - Customizable experiment settings
 * 
 * Provides a comprehensive UI for configuring RUN0 experiments
 * with all adjustable parameters visible and accessible.
 */

import { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, Target, Beaker } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';

// Voice settings are now controlled in the experiment page
import type { Run0Config } from '../model/useRun0';

interface Run0ConfigPanelProps {
    config: Run0Config;
    onConfigChange: (updates: Partial<Run0Config>) => void;
    /** Collapse by default */
    defaultCollapsed?: boolean;
    /** Disable all inputs */
    disabled?: boolean;
}

export const Run0ConfigPanel = ({
    config,
    onConfigChange,
    defaultCollapsed = false,
    disabled = false,
}: Run0ConfigPanelProps) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

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
                    {/* Basic Settings */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <Beaker className="h-4 w-4" />
                            기본 설정
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Warmup Iterations */}
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

                            {/* Test Iterations */}
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

                    {/* Voice settings are now controlled in the experiment page */}

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
