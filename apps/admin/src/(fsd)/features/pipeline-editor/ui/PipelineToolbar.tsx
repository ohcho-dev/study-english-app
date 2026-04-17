'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
    Download,
    FlaskConical,
    Play,
    Redo2,
    Save,
    TriangleAlert,
    Undo2,
    Upload,
    UploadCloud,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Textarea } from '@/shared/ui/textarea';

import { getGraphWarnings } from '../model/graphValidation';
import { usePipelineEditor } from '../model/usePipelineEditor';
import {
    useCreateVisualPipeline,
    usePublishVisualPipeline,
    useTestRunVisualPipeline,
    useUpdateVisualPipeline,
    useValidateVisualPipeline,
    useVisualPipelineVersions,
} from '../model/usePipelineMutations';

export const PipelineToolbar = () => {
    const router = useRouter();
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const pipelineId = usePipelineEditor((state) => state.pipelineId);
    const pipelineName = usePipelineEditor((state) => state.pipelineName);
    const pipelineDescription = usePipelineEditor((state) => state.pipelineDescription);
    const timeoutMs = usePipelineEditor((state) => state.timeoutMs);
    const nodes = usePipelineEditor((state) => state.nodes);
    const edges = usePipelineEditor((state) => state.edges);
    const viewport = usePipelineEditor((state) => state.viewport);
    const isDirty = usePipelineEditor((state) => state.isDirty);
    const lastSavedAt = usePipelineEditor((state) => state.lastSavedAt);
    const historyPast = usePipelineEditor((state) => state.historyPast);
    const historyFuture = usePipelineEditor((state) => state.historyFuture);
    const setMeta = usePipelineEditor((state) => state.setMeta);
    const loadPipeline = usePipelineEditor((state) => state.loadPipeline);
    const loadImportedGraph = usePipelineEditor((state) => state.loadImportedGraph);
    const markSaved = usePipelineEditor((state) => state.markSaved);
    const setExecutionState = usePipelineEditor((state) => state.setExecutionState);
    const setExecuting = usePipelineEditor((state) => state.setExecuting);
    const undo = usePipelineEditor((state) => state.undo);
    const redo = usePipelineEditor((state) => state.redo);

    const versionsQuery = useVisualPipelineVersions(pipelineId || undefined);
    const createMutation = useCreateVisualPipeline();
    const updateMutation = useUpdateVisualPipeline();
    const publishMutation = usePublishVisualPipeline();
    const validateMutation = useValidateVisualPipeline();
    const testRunMutation = useTestRunVisualPipeline();

    const [testTranscript, setTestTranscript] = useState('');
    const [testHistory, setTestHistory] = useState('');
    const [testTopic, setTestTopic] = useState('');
    const [testScene, setTestScene] = useState('');

    const graphJson = useMemo(() => ({ nodes, edges, viewport }), [nodes, edges, viewport]);
    const graphWarnings = useMemo(() => getGraphWarnings(nodes, edges), [nodes, edges]);
    const errorCount = graphWarnings.filter((warning) => warning.level === 'error').length;
    const warningCount = graphWarnings.length - errorCount;

    const handleSave = async () => {
        if (!pipelineName.trim()) {
            alert('파이프라인 이름을 입력하세요.');
            return;
        }

        if (pipelineId) {
            const response = await updateMutation.mutateAsync({
                id: pipelineId,
                payload: {
                    name: pipelineName,
                    description: pipelineDescription || null,
                    timeout_ms: timeoutMs,
                    graph_json: graphJson,
                },
            });
            loadPipeline(response);
            markSaved();
            return;
        }

        const response = await createMutation.mutateAsync({
            name: pipelineName,
            description: pipelineDescription || null,
            timeout_ms: timeoutMs,
            graph_json: graphJson,
        });
        loadPipeline(response);
        markSaved();
        router.replace(`/ai-lab/pipeline-editor/${response.id}`);
    };

    const handlePublish = async () => {
        if (!pipelineId) {
            await handleSave();
            return;
        }
        await publishMutation.mutateAsync({ id: pipelineId });
        alert('파이프라인을 발행했습니다.');
    };

    const handleValidate = async () => {
        if (!pipelineId) {
            alert('먼저 저장한 뒤 검증하세요.');
            return;
        }
        const result = await validateMutation.mutateAsync({ id: pipelineId, graphJson });
        if (result.valid) {
            alert('그래프 검증을 통과했습니다.');
            return;
        }
        alert(result.errors.join('\n'));
    };

    const handleTestRun = async () => {
        if (!pipelineId) {
            alert('테스트 실행 전 먼저 저장하세요.');
            return;
        }
        if (!testTranscript.trim()) {
            alert('테스트 발화를 입력하세요.');
            return;
        }

        setExecuting(true);

        try {
            const response = await testRunMutation.mutateAsync({
                id: pipelineId,
                transcript: testTranscript,
                sessionContext: {
                    history: testHistory,
                    topic: testTopic,
                    scene_context: testScene,
                    participants: [],
                    variant: {},
                },
            });
            setExecutionState(
                response.trace_id,
                Object.fromEntries(response.node_logs.map((log) => [log.node_id, log.status])),
            );
        } finally {
            setExecuting(false);
        }
    };

    const handleExport = () => {
        const payload = {
            name: pipelineName,
            description: pipelineDescription || null,
            timeout_ms: timeoutMs,
            graph_json: graphJson,
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${pipelineName || 'visual-pipeline'}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as {
                name?: string;
                description?: string | null;
                timeout_ms?: number;
                graph_json?: typeof graphJson;
                nodes?: typeof nodes;
                edges?: typeof edges;
                viewport?: typeof viewport;
            };

            const graph = parsed.graph_json || (
                parsed.nodes && parsed.edges && parsed.viewport
                    ? {
                        nodes: parsed.nodes,
                        edges: parsed.edges,
                        viewport: parsed.viewport,
                    }
                    : null
            );

            if (!graph?.nodes || !graph?.edges || !graph?.viewport) {
                throw new Error('파이프라인 JSON 형식을 확인하세요.');
            }

            loadImportedGraph({
                pipelineName: parsed.name,
                pipelineDescription: parsed.description,
                timeoutMs: parsed.timeout_ms,
                graphJson: graph,
            });
            alert('파이프라인 JSON을 불러왔습니다.');
        } catch (error) {
            console.error(error);
            alert('JSON 가져오기에 실패했습니다. 파일 형식을 확인하세요.');
        } finally {
            event.target.value = '';
        }
    };

    return (
        <div className="absolute left-4 right-4 top-4 z-20 rounded-3xl border border-border bg-card/92 p-4 shadow-xl shadow-black/20 backdrop-blur">
            <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportChange} />
            <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px_auto] lg:items-start">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="space-y-2">
                            <Label>파이프라인 이름</Label>
                            <Input value={pipelineName} onChange={(event) => setMeta({ pipelineName: event.target.value })} placeholder="학습 세션 비주얼 파이프라인" />
                        </div>
                        <div className="space-y-2">
                            <Label>설명</Label>
                            <Input value={pipelineDescription} onChange={(event) => setMeta({ pipelineDescription: event.target.value })} placeholder="세션 실행 흐름 설명" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>전체 타임아웃(ms)</Label>
                            <Input type="number" value={timeoutMs} onChange={(event) => setMeta({ timeoutMs: Number(event.target.value || 15000) })} />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between text-foreground">
                            <span className="font-semibold">편집 상태</span>
                            <Badge variant={isDirty ? 'default' : 'outline'}>{isDirty ? '변경 있음' : '저장됨'}</Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-xs">
                            <p>노드 {nodes.length}개 / 엣지 {edges.length}개</p>
                            <p>경고 {warningCount}건 / 오류 {errorCount}건</p>
                            <p>마지막 저장: {lastSavedAt ? new Date(lastSavedAt).toLocaleString('ko-KR') : '아직 없음'}</p>
                            <p>발행 버전: {versionsQuery.data?.[0]?.version ?? '-'}</p>
                            <p>단축키: 되돌리기 `Ctrl/Cmd+Z`, 붙여넣기 `Ctrl/Cmd+V`</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button variant="outline" onClick={undo} disabled={historyPast.length === 0}>
                            <Undo2 className="mr-2 h-4 w-4" />
                            되돌리기
                        </Button>
                        <Button variant="outline" onClick={redo} disabled={historyFuture.length === 0}>
                            <Redo2 className="mr-2 h-4 w-4" />
                            다시 실행
                        </Button>
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="mr-2 h-4 w-4" />
                            가져오기
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            내보내기
                        </Button>
                        <Button variant="outline" onClick={handleValidate} disabled={validateMutation.isPending}>
                            <FlaskConical className="mr-2 h-4 w-4" />
                            검증
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Play className="mr-2 h-4 w-4" />
                                    테스트 실행
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl sm:max-w-4xl">
                                <DialogHeader>
                                    <DialogTitle>테스트 실행</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>테스트 발화</Label>
                                            <Textarea rows={6} value={testTranscript} onChange={(event) => setTestTranscript(event.target.value)} placeholder="사용자 발화를 입력하세요." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>대화 이력</Label>
                                            <Textarea rows={6} value={testHistory} onChange={(event) => setTestHistory(event.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>주제</Label>
                                                <Input value={testTopic} onChange={(event) => setTestTopic(event.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>장면 문맥</Label>
                                                <Input value={testScene} onChange={(event) => setTestScene(event.target.value)} />
                                            </div>
                                        </div>
                                        <Button onClick={handleTestRun} disabled={testRunMutation.isPending}>
                                            <Play className="mr-2 h-4 w-4" />
                                            {testRunMutation.isPending ? '실행 중...' : '실행'}
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="rounded-2xl border border-border bg-muted/40 p-3">
                                            <p className="text-sm font-semibold text-foreground">최종 결과</p>
                                            <ScrollArea className="mt-2 h-[190px] rounded-xl border border-border bg-background/90 p-3 text-xs text-muted-foreground">
                                                <pre>{JSON.stringify(testRunMutation.data?.result || {}, null, 2)}</pre>
                                            </ScrollArea>
                                            {testRunMutation.data ? (
                                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                    <p>총 실행 시간: {testRunMutation.data.total_duration_ms}ms</p>
                                                    <p>입력 토큰: {testRunMutation.data.total_input_tokens}</p>
                                                    <p>출력 토큰: {testRunMutation.data.total_output_tokens}</p>
                                                    <p>예상 비용: ${testRunMutation.data.estimated_cost_usd.toFixed(6)}</p>
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="rounded-2xl border border-border bg-muted/40 p-3">
                                            <p className="text-sm font-semibold text-foreground">노드 로그</p>
                                            <ScrollArea className="mt-2 h-[250px] rounded-xl border border-border bg-background/90 p-3">
                                                <div className="space-y-2 text-xs text-muted-foreground">
                                                    {(testRunMutation.data?.node_logs || []).map((log) => (
                                                        <div key={`${log.node_id}-${log.created_at || log.trace_id}`} className="rounded-xl border border-border bg-card/70 p-2">
                                                            <div className="flex items-center justify-between font-medium text-foreground">
                                                                <span>{log.node_label || log.node_id}</span>
                                                                <Badge variant="outline">{log.status}</Badge>
                                                            </div>
                                                            <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(log.output_json || log.error_message || {}, null, 2)}</pre>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Button variant="outline" onClick={handlePublish} disabled={publishMutation.isPending}>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            발행
                        </Button>
                        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                            <Save className="mr-2 h-4 w-4" />
                            저장
                        </Button>
                    </div>
                </div>

                <Alert className={graphWarnings.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}>
                    <TriangleAlert className={graphWarnings.length > 0 ? 'text-amber-600' : 'text-emerald-600'} />
                    <AlertTitle className={graphWarnings.length > 0 ? 'text-amber-950' : 'text-emerald-950'}>
                        {graphWarnings.length > 0 ? '에디터 검증 경고' : '에디터 검증 통과'}
                    </AlertTitle>
                    <AlertDescription className={graphWarnings.length > 0 ? 'text-amber-900' : 'text-emerald-900'}>
                        {graphWarnings.length > 0 ? (
                            <ul className="space-y-1">
                                {graphWarnings.slice(0, 4).map((warning) => (
                                    <li key={warning.id}>
                                        [{warning.level === 'error' ? '오류' : '경고'}] {warning.message}
                                    </li>
                                ))}
                                {graphWarnings.length > 4 ? <li>외 {graphWarnings.length - 4}건</li> : null}
                            </ul>
                        ) : (
                            <p>연결 끊김, 사이클, 필수 설정 누락이 감지되지 않았습니다.</p>
                        )}
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    );
};
