'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Link2, Sparkles } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
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

import {
    useConvertTemplateV02,
    useDeleteTemplatePipelineLink,
    useSetTemplatePipelineLink,
    useTemplatePipelineLink,
    useVisualPipelineVersions,
    useVisualPipelines,
} from '../model/usePipelineMutations';

interface TemplatePipelineLinkCardProps {
    templateId?: string;
    pipelineMode: string;
    onPipelineModeChange: (mode: string) => void;
}

export const TemplatePipelineLinkCard = ({
    templateId,
    pipelineMode,
    onPipelineModeChange,
}: TemplatePipelineLinkCardProps) => {
    const pipelinesQuery = useVisualPipelines();
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [selectedPipelineVersion, setSelectedPipelineVersion] = useState<string>('');

    const linkQuery = useTemplatePipelineLink(templateId);
    const effectivePipelineId = selectedPipelineId || linkQuery.data?.pipeline_id || '';
    const effectivePipelineVersion = selectedPipelineVersion || (
        linkQuery.data?.pipeline_version ? String(linkQuery.data.pipeline_version) : 'latest'
    );
    const versionsQuery = useVisualPipelineVersions(effectivePipelineId || undefined);
    const setLinkMutation = useSetTemplatePipelineLink();
    const deleteLinkMutation = useDeleteTemplatePipelineLink();
    const convertMutation = useConvertTemplateV02();

    const selectedPipeline = useMemo(
        () => pipelinesQuery.data?.find((pipeline) => pipeline.id === effectivePipelineId) || null,
        [effectivePipelineId, pipelinesQuery.data],
    );

    const handleLink = async () => {
        if (!templateId) {
            alert('먼저 템플릿을 저장하세요.');
            return;
        }
        if (!effectivePipelineId) {
            alert('연결할 비주얼 파이프라인을 선택하세요.');
            return;
        }

        await setLinkMutation.mutateAsync({
            templateId,
            pipelineId: effectivePipelineId,
            pipelineVersion: effectivePipelineVersion === 'latest' ? null : Number(effectivePipelineVersion),
        });
        onPipelineModeChange('visual');
        alert('비주얼 파이프라인 연결을 저장했습니다.');
    };

    const handleUnlink = async () => {
        if (!templateId) return;
        await deleteLinkMutation.mutateAsync(templateId);
        onPipelineModeChange('basic');
        alert('비주얼 파이프라인 연결을 해제했습니다.');
    };

    const handleConvert = async () => {
        if (!templateId) {
            alert('먼저 템플릿을 저장하세요.');
            return;
        }

        try {
            const response = await convertMutation.mutateAsync(templateId);
            setSelectedPipelineId(response.pipeline_id);
            setSelectedPipelineVersion(response.pipeline_version ? String(response.pipeline_version) : 'latest');
            onPipelineModeChange('visual');
            alert('v0.2 템플릿을 비주얼 파이프라인으로 변환했습니다.');
        } catch (error) {
            console.error(error);
            alert('자동 변환에 실패했습니다. 프롬프트 설정을 확인하세요.');
        }
    };

    if (!templateId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">비주얼 파이프라인 연결</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>템플릿을 한 번 저장한 뒤에 새 비주얼 파이프라인 엔진과 연결할 수 있습니다.</p>
                    <p>저장 후 이 카드에서 파이프라인 선택, 버전 고정, v0.2 자동 변환이 가능합니다.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Link2 className="h-4 w-4" />
                    비주얼 파이프라인 연결
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {pipelinesQuery.isLoading || linkQuery.isLoading ? (
                    <Skeleton className="h-32 rounded-2xl" />
                ) : (
                    <>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-zinc-950">현재 상태</p>
                                <Badge variant={linkQuery.data ? 'default' : 'outline'}>
                                    {linkQuery.data ? '비주얼 모드 활성' : '기존 모드 유지'}
                                </Badge>
                            </div>
                            <p className="mt-2 text-sm text-zinc-600">
                                {linkQuery.data
                                    ? `${linkQuery.data.pipeline_name} / ${linkQuery.data.pipeline_status}`
                                    : '아직 연결된 비주얼 파이프라인이 없습니다.'}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                                연결이 저장되면 템플릿 `pipeline_mode`는 자동으로 `visual`로 전환됩니다.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>연결할 비주얼 파이프라인</Label>
                            <Select value={effectivePipelineId} onValueChange={setSelectedPipelineId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="비주얼 파이프라인 선택" />
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
                            <Label>실행 버전</Label>
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
                            <Button onClick={handleLink} disabled={setLinkMutation.isPending || !effectivePipelineId}>
                                연결 저장
                            </Button>
                            <Button variant="outline" onClick={handleUnlink} disabled={!linkQuery.data || deleteLinkMutation.isPending}>
                                연결 해제
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleConvert}
                                disabled={pipelineMode !== 'v0.2' || convertMutation.isPending}
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                v0.2 자동 변환
                            </Button>
                            {selectedPipeline ? (
                                <Button variant="outline" asChild>
                                    <Link href={`/ai-lab/pipeline-editor/${selectedPipeline.id}`}>
                                        빌더 열기
                                    </Link>
                                </Button>
                            ) : null}
                        </div>

                        {(pipelinesQuery.data || []).length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                                <p>먼저 새 비주얼 파이프라인을 하나 생성해야 합니다.</p>
                                <Button variant="outline" className="mt-3" asChild>
                                    <Link href="/ai-lab/pipeline-editor/new">새 비주얼 파이프라인 만들기</Link>
                                </Button>
                            </div>
                        ) : null}
                    </>
                )}
            </CardContent>
        </Card>
    );
};
