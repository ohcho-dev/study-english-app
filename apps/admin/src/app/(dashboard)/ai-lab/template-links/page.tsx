'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { useTemplates } from '@/features/conversations';
import {
    useConvertTemplateV02,
    useDeleteTemplatePipelineLink,
    useSetTemplatePipelineLink,
    useTemplatePipelineLink,
    useVisualPipelineVersions,
    useVisualPipelines,
} from '@/features/pipeline-editor';

const TemplateLinksPage = () => {
    const templatesQuery = useTemplates(1, 100, true);
    const pipelinesQuery = useVisualPipelines();
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [selectedPipelineVersion, setSelectedPipelineVersion] = useState<string>('');

    const effectiveTemplateId = selectedTemplateId || templatesQuery.data?.items?.[0]?.id || '';
    const linkQuery = useTemplatePipelineLink(effectiveTemplateId || undefined);
    const effectivePipelineId = selectedPipelineId || linkQuery.data?.pipeline_id || '';
    const effectivePipelineVersion = selectedPipelineVersion || (
        linkQuery.data?.pipeline_version ? String(linkQuery.data.pipeline_version) : 'latest'
    );
    const versionsQuery = useVisualPipelineVersions(effectivePipelineId || undefined);
    const setLinkMutation = useSetTemplatePipelineLink();
    const deleteLinkMutation = useDeleteTemplatePipelineLink();
    const convertMutation = useConvertTemplateV02();

    const selectedTemplate = useMemo(
        () => templatesQuery.data?.items.find((item) => item.id === effectiveTemplateId),
        [effectiveTemplateId, templatesQuery.data?.items],
    );

    const handleLink = async () => {
        if (!effectiveTemplateId || !effectivePipelineId) {
            alert('템플릿과 파이프라인을 모두 선택하세요.');
            return;
        }
        await setLinkMutation.mutateAsync({
            templateId: effectiveTemplateId,
            pipelineId: effectivePipelineId,
            pipelineVersion: effectivePipelineVersion === 'latest' ? null : Number(effectivePipelineVersion),
        });
        alert('템플릿 연결을 저장했습니다.');
    };

    const handleUnlink = async () => {
        if (!effectiveTemplateId) return;
        await deleteLinkMutation.mutateAsync(effectiveTemplateId);
        alert('연결을 해제했습니다.');
    };

    const handleConvert = async () => {
        if (!effectiveTemplateId) return;
        try {
            const response = await convertMutation.mutateAsync(effectiveTemplateId);
            setSelectedPipelineId(response.pipeline_id);
            setSelectedPipelineVersion(response.pipeline_version ? String(response.pipeline_version) : 'latest');
            alert('v0.2 템플릿을 비주얼 파이프라인으로 변환했습니다.');
        } catch (error) {
            console.error(error);
            alert('자동 변환에 실패했습니다. 템플릿 프롬프트를 확인하세요.');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-950">템플릿 연결</h1>
                <p className="mt-1 text-sm text-zinc-500">대화 템플릿을 새 비주얼 파이프라인 엔진에 연결하고, 기존 v0.2를 새 버전으로 변환할 수 있습니다.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>템플릿 선택</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {templatesQuery.isLoading ? (
                            <Skeleton className="h-[420px] rounded-2xl" />
                        ) : (
                            <div className="space-y-2">
                                {(templatesQuery.data?.items || []).map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTemplateId(template.id);
                                            setSelectedPipelineId('');
                                            setSelectedPipelineVersion('');
                                        }}
                                        className={[
                                            'w-full rounded-2xl border p-3 text-left transition',
                                            effectiveTemplateId === template.id
                                                ? 'border-teal-500 bg-teal-50'
                                                : 'border-zinc-200 bg-white hover:border-zinc-300',
                                        ].join(' ')}
                                    >
                                        <p className="font-semibold text-zinc-950">{template.name}</p>
                                        <p className="mt-1 text-xs text-zinc-500">{template.description || '설명 없음'}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle>연결 설정</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {selectedTemplate ? (
                            <div className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-600">
                                <p className="font-semibold text-zinc-900">선택된 템플릿</p>
                                <p className="mt-1">{selectedTemplate.name}</p>
                                <p className="mt-1 text-xs text-zinc-500">현재 연결: {linkQuery.data ? `${linkQuery.data.pipeline_name} (${linkQuery.data.pipeline_status})` : '없음'}</p>
                            </div>
                        ) : null}
                        <div className="space-y-2">
                            <Label>비주얼 파이프라인</Label>
                            <Select value={effectivePipelineId} onValueChange={setSelectedPipelineId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="파이프라인 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(pipelinesQuery.data || []).map((pipeline) => (
                                        <SelectItem key={pipeline.id} value={pipeline.id}>
                                            {pipeline.name} · {pipeline.status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>버전</Label>
                            <Select value={effectivePipelineVersion} onValueChange={setSelectedPipelineVersion}>
                                <SelectTrigger>
                                    <SelectValue placeholder="버전 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="latest">최신 발행 버전</SelectItem>
                                    {(versionsQuery.data || []).map((version) => (
                                        <SelectItem key={version.id} value={String(version.version)}>
                                            버전 {version.version}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleLink} disabled={setLinkMutation.isPending}>연결 저장</Button>
                            <Button variant="outline" onClick={handleUnlink} disabled={!linkQuery.data || deleteLinkMutation.isPending}>연결 해제</Button>
                            <Button variant="outline" onClick={handleConvert} disabled={convertMutation.isPending}>v0.2 자동 변환</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TemplateLinksPage;
