'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Skeleton } from '@/shared/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/table';
import { usePipelineExecutionLogs, usePipelineExecutionTrace } from '@/features/pipeline-editor';

const PipelineLogsPage = () => {
    const [traceFilter, setTraceFilter] = useState('');
    const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
    const logsQuery = usePipelineExecutionLogs(traceFilter ? { trace_id: traceFilter } : undefined);
    const detailQuery = usePipelineExecutionTrace(selectedTraceId || undefined);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">비주얼 파이프라인 실행 로그</h1>
                <p className="mt-1 text-sm">실제 세션 실행 중 기록된 노드 단위 로그를 추적합니다.</p>
            </div>
            <Card className="rounded-3xl">
                <CardHeader>
                    <CardTitle>실행 추적 목록</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input value={traceFilter} onChange={(event) => setTraceFilter(event.target.value)} placeholder="Trace ID로 필터링" />
                    {logsQuery.isLoading ? (
                        <Skeleton className="h-96 rounded-2xl" />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Trace ID</TableHead>
                                    <TableHead>파이프라인</TableHead>
                                    <TableHead>노드 수</TableHead>
                                    <TableHead>실패</TableHead>
                                    <TableHead>시점</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(logsQuery.data?.items || []).map((item) => (
                                    <TableRow key={item.trace_id} className="cursor-pointer" onClick={() => setSelectedTraceId(item.trace_id)}>
                                        <TableCell className="font-mono text-xs">{item.trace_id}</TableCell>
                                        <TableCell>{item.pipeline_id}</TableCell>
                                        <TableCell>{item.node_count}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.failure_count > 0 ? 'destructive' : 'outline'}>
                                                {item.failure_count}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-500">
                                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ko })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedTraceId} onOpenChange={(open) => !open && setSelectedTraceId(null)}>
                <DialogContent className="w-full max-w-7xl sm:max-w-7xl">
                    <DialogHeader>
                        <DialogTitle>실행 상세 로그</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[70vh]">
                        <div className="space-y-3 pr-3">
                            {(detailQuery.data?.logs || []).map((log) => (
                                <div key={`${log.node_id}-${log.created_at || log.trace_id}`} className="rounded-2xl border border-zinc-200 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="font-semibold">{log.node_label || log.node_id}</p>
                                            <p className="text-xs">{log.node_type} · {log.model_name || 'no-model'}</p>
                                        </div>
                                        <Badge variant={log.status === 'failed' ? 'destructive' : 'outline'}>{log.status}</Badge>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div className="rounded-xl bg-zinc-50 p-3">
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">입력</p>
                                            <pre className="whitespace-pre-wrap text-xs text-zinc-700">{JSON.stringify(log.input_json || {}, null, 2)}</pre>
                                        </div>
                                        <div className="rounded-xl bg-zinc-50 p-3">
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">출력</p>
                                            <pre className="whitespace-pre-wrap text-xs text-zinc-700">{JSON.stringify(log.output_json || log.error_message || {}, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default PipelineLogsPage;
