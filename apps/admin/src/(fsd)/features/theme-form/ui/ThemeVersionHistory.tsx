'use client';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { History, RotateCcw } from 'lucide-react';
import type { ThemeVersion } from '@/entities/theme';

interface Props {
    versions: ThemeVersion[];
    currentVersionId?: string;
    onRollback: (versionId: string) => void;
    isRollingBack?: boolean;
}

export const ThemeVersionHistory = ({ versions, currentVersionId, onRollback, isRollingBack }: Props) => {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (versions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4" />
                        버전 히스토리
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">저장된 버전이 없습니다.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    버전 히스토리
                    <Badge variant="secondary" className="font-normal">
                        {versions.length}개
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border">
                    {versions.map((version, index) => {
                        const isCurrent = version.id === currentVersionId;
                        const isLatest = index === 0;

                        return (
                            <div
                                key={version.id}
                                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">v{version.version}</span>
                                            {isLatest && (
                                                <Badge variant="default" className="text-xs">
                                                    최신
                                                </Badge>
                                            )}
                                            {isCurrent && !isLatest && (
                                                <Badge variant="outline" className="text-xs">
                                                    현재
                                                </Badge>
                                            )}
                                        </div>
                                        {version.description && (
                                            <span className="text-sm font-medium text-foreground">
                                                {version.description}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(version.created_at)}
                                        </span>
                                    </div>
                                </div>

                                {!isLatest && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRollback(version.id)}
                                        disabled={isRollingBack}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-1" />
                                        롤백
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
