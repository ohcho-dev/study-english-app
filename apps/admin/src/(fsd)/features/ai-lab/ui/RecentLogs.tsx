'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Clock, Coins, Eye, MessageSquare, Volume2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/table';

import { useLogDetail, useLogs } from '../model/useExperiment';
import type { ExperimentLogSummary } from '../model/types';
import { LogDetailModal } from './LogDetailModal';

interface RecentLogsProps {
    limit?: number;
    pipelineId?: string;
}

/**
 * Recent experiment logs component
 */
export const RecentLogs = ({ limit = 10, pipelineId }: RecentLogsProps) => {
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const { data, isLoading } = useLogs(1, limit, pipelineId);
    const { data: logDetail } = useLogDetail(selectedLogId);

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatCost = (usd: number) => {
        return `$${usd.toFixed(4)}`;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>최근 실험 로그</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.items.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>최근 실험 로그</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        아직 실험 로그가 없습니다.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>최근 실험 로그</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            총 {data.total}개
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>파이프라인</TableHead>
                                <TableHead>모델</TableHead>
                                <TableHead>전달 방식</TableHead>
                                <TableHead className="text-center">음성</TableHead>
                                <TableHead className="text-right">토큰</TableHead>
                                <TableHead className="text-right">비용</TableHead>
                                <TableHead className="text-right">시간</TableHead>
                                <TableHead className="text-right">실행일</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.items.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-medium">
                                        {log.pipeline_name || '-'}
                                    </TableCell>
                                    <TableCell>{log.model_name}</TableCell>
                                    <TableCell>{log.data_transfer_mode}</TableCell>
                                    <TableCell className="text-center">
                                        {log.generate_audio ? (
                                            <span className="text-green-600">
                                                <Volume2 className="h-4 w-4 inline" />
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="flex items-center justify-end gap-1">
                                            <MessageSquare className="h-3 w-3" />
                                            {log.total_tokens}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="flex items-center justify-end gap-1">
                                            <Coins className="h-3 w-3" />
                                            {formatCost(log.estimated_cost_usd)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="flex items-center justify-end gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatTime(log.execution_time_ms)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-xs">
                                        {formatDistanceToNow(new Date(log.created_at), {
                                            addSuffix: true,
                                            locale: ko,
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() => setSelectedLogId(log.id)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <LogDetailModal
                log={logDetail || null}
                open={!!selectedLogId}
                onClose={() => setSelectedLogId(null)}
            />
        </>
    );
};
