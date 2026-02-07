'use client';

import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Edit, Trash2, PlayCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

import type { PipelineListItem } from '../model/types';

interface PipelineCardProps {
    pipeline: PipelineListItem;
    onDelete?: (id: string) => void;
}

/**
 * Pipeline card component for pipeline list
 */
export const PipelineCard = ({ pipeline, onDelete }: PipelineCardProps) => {
    const handleDelete = () => {
        if (onDelete && confirm('정말 이 파이프라인을 삭제하시겠습니까?')) {
            onDelete(pipeline.id);
        }
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg">📋 {pipeline.name}</CardTitle>
                        <CardDescription>
                            에이전트 {pipeline.agent_count}개 |
                            수정: {formatDistanceToNow(new Date(pipeline.updated_at), {
                                addSuffix: true,
                                locale: ko,
                            })}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {pipeline.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {pipeline.description}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/ai-lab/pipelines/${pipeline.id}/edit`}>
                            <Edit className="h-4 w-4 mr-1" />
                            수정
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/ai-lab/experiment?pipeline=${pipeline.id}`}>
                            <PlayCircle className="h-4 w-4 mr-1" />
                            테스트
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={handleDelete}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
