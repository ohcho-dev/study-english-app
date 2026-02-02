'use client';

import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { THEME_COLOR_KEYS, COLOR_LABELS, type ThemeColors } from '@/entities/theme';

interface Props {
    mode: 'light' | 'dark';
    colors: ThemeColors;
    onChange: (key: keyof ThemeColors, value: string) => void;
}

export const ThemeColorForm = ({ mode, colors, onChange }: Props) => {
    const title = mode === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {THEME_COLOR_KEYS.map((key) => (
                    <div key={key} className="grid grid-cols-[140px_1fr_40px] gap-3 items-center">
                        <label className="text-sm font-medium text-muted-foreground">
                            {COLOR_LABELS[key]}
                        </label>
                        <Input
                            value={colors[key] || ''}
                            onChange={(e) => onChange(key, e.target.value)}
                            placeholder="#f97316"
                            className="font-mono text-sm"
                        />
                        <input
                            type="color"
                            value={colors[key] || '#808080'}
                            onChange={(e) => onChange(key, e.target.value)}
                            className="w-8 h-8 rounded border border-border cursor-pointer"
                            title={colors[key]}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
