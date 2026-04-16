'use client';

import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Slider } from '@/shared/ui/slider';
import { Textarea } from '@/shared/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useLLMModels } from '@/shared/lib/useModels';

import type { EditorNode, LLMNodeData, OutputFieldDescriptor } from '../../model/types';
import { BindingsEditor, DeclaredOutputsEditor, JsonTextareaField, SectionBlock } from './shared';

export const LLMConfigPanel = ({
    node,
    suggestions,
    onPatch,
}: {
    node: EditorNode;
    suggestions: OutputFieldDescriptor[];
    onPatch: (patch: Record<string, unknown>) => void;
}) => {
    const data = node.data as unknown as LLMNodeData;
    const { models, isLoading: modelsLoading } = useLLMModels();

    // provider별로 그룹핑
    const modelsByProvider = models.reduce<Record<string, typeof models>>((acc, m) => {
        const key = m.provider;
        acc[key] = acc[key] ? [...acc[key], m] : [m];
        return acc;
    }, {});

    const currentModel = data.model || 'gemini-2.5-flash';
    const selectedModelInfo = models.find((m) => m.id === currentModel);

    return (
        <div className="space-y-4">
            <SectionBlock title="기본 설정" description="모델, 온도, 제한 시간을 설정합니다.">
                <div className="space-y-2">
                    <Label>노드 이름</Label>
                    <Input value={data.label || ''} onChange={(event) => onPatch({ label: event.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>모델</Label>
                    <Select
                        value={currentModel}
                        onValueChange={(value) => onPatch({ model: value })}
                        disabled={modelsLoading}
                    >
                        <SelectTrigger className="font-mono text-xs">
                            <SelectValue placeholder={modelsLoading ? '로딩 중...' : '모델 선택'} />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                                <SelectGroup key={provider}>
                                    <SelectLabel className="text-xs uppercase tracking-wider text-zinc-400">
                                        {provider}
                                    </SelectLabel>
                                    {providerModels.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedModelInfo && (
                        <p className="text-xs text-zinc-500">
                            입력 ${selectedModelInfo.input_price_per_1m}/1M · 출력 ${selectedModelInfo.output_price_per_1m}/1M
                            {selectedModelInfo.max_context_tokens
                                ? ` · ${(selectedModelInfo.max_context_tokens / 1000).toFixed(0)}K 컨텍스트`
                                : ''}
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label>응답 형식</Label>
                    <Select value={data.response_format || 'text'} onValueChange={(value) => onPatch({ response_format: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">텍스트</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <Label>온도</Label>
                        <span>{Number(data.temperature || 0).toFixed(1)}</span>
                    </div>
                    <Slider value={[Number(data.temperature || 0)]} min={0} max={1} step={0.1} onValueChange={([value]) => onPatch({ temperature: value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>최대 출력 토큰</Label>
                        <Input type="number" value={data.max_output_tokens || ''} onChange={(event) => onPatch({ max_output_tokens: Number(event.target.value || 0) || undefined })} />
                    </div>
                    <div className="space-y-2">
                        <Label>타임아웃(ms)</Label>
                        <Input type="number" value={data.timeout_ms || 10000} onChange={(event) => onPatch({ timeout_ms: Number(event.target.value || 10000) })} />
                    </div>
                </div>
            </SectionBlock>

            <SectionBlock title="프롬프트" description="실제 모델에 주입될 시스템 지시문입니다.">
                <Textarea rows={12} value={data.prompt || ''} onChange={(event) => onPatch({ prompt: event.target.value })} className="font-mono text-xs" />
            </SectionBlock>

            <BindingsEditor title="입력 변수 바인딩" value={data.input_variables || {}} onChange={(input_variables) => onPatch({ input_variables })} suggestions={suggestions} />

            <SectionBlock title="출력 JSON 스키마" description="LLM에게 기대하는 응답 구조를 명시합니다.">
                <JsonTextareaField
                    label="스키마"
                    value={JSON.stringify(data.output_schema || {}, null, 2)}
                    onChange={(value) => {
                        try {
                            onPatch({ output_schema: JSON.parse(value) });
                        } catch {
                            onPatch({ output_schema: data.output_schema });
                        }
                    }}
                    placeholder='{"type":"object","properties":{"result":{"type":"string"}}}'
                />
            </SectionBlock>

            <DeclaredOutputsEditor
                value={data.declared_outputs}
                onChange={(declared_outputs) => onPatch({ declared_outputs })}
            />
        </div>
    );
};
