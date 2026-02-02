'use client';

import { Switch } from '@/shared/ui/switch';
import { Badge } from '@/shared/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/table';
import {
    type ExperimentVariable,
    LEARNING_THEME_LABELS,
    VARIABLE_CATEGORY_LABELS,
} from '@/entities/variable';

interface Props {
    variables: ExperimentVariable[];
    onToggle?: (id: string, isActive: boolean) => void;
    onEdit?: (variable: ExperimentVariable) => void;
}

export const VariableTable = ({ variables, onToggle, onEdit }: Props) => {
    return (
        <div className="rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">변수 키</TableHead>
                        <TableHead className="w-[120px]">학습 테마</TableHead>
                        <TableHead className="w-[80px]">카테고리</TableHead>
                        <TableHead>설명</TableHead>
                        <TableHead className="w-[100px]">Control</TableHead>
                        <TableHead className="w-[100px]">Treatment</TableHead>
                        <TableHead className="text-center w-[80px]">활성화</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {!variables || variables.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                등록된 변수가 없습니다.
                            </TableCell>
                        </TableRow>
                    ) : (
                        variables.map((variable) => (
                            <TableRow
                                key={variable.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => onEdit?.(variable)}
                            >
                                <TableCell className="font-mono text-sm">
                                    {variable.variable_key}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                        {LEARNING_THEME_LABELS[variable.learning_theme]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                        {VARIABLE_CATEGORY_LABELS[variable.category]}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {variable.description}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {variable.control_value}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {variable.treatment_value}
                                </TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <Switch
                                        checked={variable.is_active}
                                        onCheckedChange={(checked) => onToggle?.(variable.id, checked)}
                                    />
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
