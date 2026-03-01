'use client';

/**
 * TemplateList Component - Display and manage conversation templates
 */

import { useState } from 'react';
import { Plus, Search, Edit, Trash2, Copy, MoreHorizontal, Eye, Play, MessageSquare } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

import type { TemplateListItem } from '../model/types';

interface TemplateListProps {
    templates: TemplateListItem[];
    isLoading?: boolean;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onCreate: () => void;
    onView?: (id: string) => void;
    /** Start experiment with this template */
    onTest?: (id: string) => void;
    /** Start My Turn scenario */
    onMyTurn?: (id: string) => void;
}

export const TemplateList = ({
    templates,
    isLoading = false,
    onEdit,
    onDelete,
    onDuplicate,
    onCreate,
    onView,
    onTest,
    onMyTurn,
}: TemplateListProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [modeFilter, setModeFilter] = useState<string>('all');

    // Filter templates
    const filteredTemplates = templates.filter((template) => {
        const matchesSearch =
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMode = modeFilter === 'all' || template.mode === modeFilter;
        return matchesSearch && matchesMode;
    });

    // Get mode badge color
    const getModeColor = (mode: string) => {
        switch (mode) {
            case 'turn_based':
                return 'bg-blue-500/10 text-blue-600';
            case 'free_form':
                return 'bg-purple-500/10 text-purple-600';
            default:
                return 'bg-gray-500/10 text-gray-600';
        }
    };

    // Get difficulty stars
    const getDifficultyStars = (difficulty: number | null) => {
        if (!difficulty) return 'N/A';
        return '⭐'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">템플릿 관리</h1>
                    <p className="text-muted-foreground">
                        대화 시나리오 템플릿을 생성하고 관리합니다
                    </p>
                </div>
                <Button onClick={onCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    새 템플릿
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="템플릿 검색..."
                        className="pl-9"
                    />
                </div>
                <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                    <option value="all">모든 모드</option>
                    <option value="turn_based">턴 기반</option>
                    <option value="free_form">자유 형식</option>
                </select>
            </div>

            {/* Templates Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="py-6">
                                <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                                <div className="h-3 bg-muted rounded w-1/2 mb-2" />
                                <div className="h-3 bg-muted rounded w-2/3" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : filteredTemplates.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="text-4xl mb-4">📝</div>
                        <h3 className="text-lg font-medium mb-2">템플릿이 없습니다</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {searchQuery
                                ? '검색 결과가 없습니다'
                                : '첫 번째 템플릿을 생성해보세요'}
                        </p>
                        {!searchQuery && (
                            <Button onClick={onCreate}>
                                <Plus className="h-4 w-4 mr-2" />
                                새 템플릿 만들기
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                        <Card
                            key={template.id}
                            className={`hover:shadow-md transition-shadow ${!template.is_active ? 'opacity-60' : ''
                                }`}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className="text-base truncate">
                                            {template.name}
                                        </CardTitle>
                                        {template.topic && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {template.topic}
                                            </p>
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {onTest && template.is_active && (
                                                <>
                                                    <DropdownMenuItem
                                                        onClick={() => onTest(template.id)}
                                                        className="text-primary"
                                                    >
                                                        <Play className="h-4 w-4 mr-2" />
                                                        Run0 (Latency)
                                                    </DropdownMenuItem>
                                                    {onMyTurn && (
                                                        <DropdownMenuItem
                                                            onClick={() => onMyTurn(template.id)}
                                                            className="text-green-600"
                                                        >
                                                            <MessageSquare className="h-4 w-4 mr-2" />
                                                            My Turn 시작
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                </>
                                            )}
                                            {onView && (
                                                <DropdownMenuItem onClick={() => onView(template.id)}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    보기
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem onClick={() => onEdit(template.id)}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                편집
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onDuplicate(template.id)}>
                                                <Copy className="h-4 w-4 mr-2" />
                                                복제
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => onDelete(template.id)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                삭제
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {template.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {template.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className={getModeColor(template.mode)}>
                                        {template.mode === 'turn_based' ? '턴 기반' : '자유 형식'}
                                    </Badge>
                                    {!template.is_active && (
                                        <Badge variant="secondary">비활성</Badge>
                                    )}
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        참여자 {template.participant_count}명
                                    </span>
                                    <span>
                                        {template.is_active ? '활성화' : '비활성화'}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Total count */}
            {!isLoading && filteredTemplates.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                    총 {filteredTemplates.length}개의 템플릿
                </p>
            )}
        </div>
    );
};

export default TemplateList;
