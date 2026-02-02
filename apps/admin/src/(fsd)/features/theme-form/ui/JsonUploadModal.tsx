'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/shared/ui/dialog';
import { DEFAULT_THEME_TEMPLATE, type ThemeColors } from '@/entities/theme';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (data: { light_mode: ThemeColors; dark_mode: ThemeColors }) => void;
}

export const JsonUploadModal = ({ open, onOpenChange, onApply }: Props) => {
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLoadTemplate = () => {
        setJsonText(JSON.stringify(DEFAULT_THEME_TEMPLATE, null, 2));
        setError(null);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setJsonText(text);
            setError(null);
        };
        reader.readAsText(file);
    };

    const handleApply = () => {
        try {
            const parsed = JSON.parse(jsonText);

            if (!parsed.light_mode || !parsed.dark_mode) {
                throw new Error('JSON must contain light_mode and dark_mode objects');
            }

            onApply({
                light_mode: parsed.light_mode,
                dark_mode: parsed.dark_mode,
            });
            setJsonText('');
            setError(null);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid JSON format');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>JSON 업로드</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleLoadTemplate}>
                            기본 템플릿 불러오기
                        </Button>
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <Button type="button" variant="outline" size="sm" asChild>
                                <span>파일 선택</span>
                            </Button>
                        </label>
                    </div>

                    <textarea
                        value={jsonText}
                        onChange={(e) => {
                            setJsonText(e.target.value);
                            setError(null);
                        }}
                        placeholder='{"light_mode": {...}, "dark_mode": {...}}'
                        className="w-full h-[400px] p-3 font-mono text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button onClick={handleApply} disabled={!jsonText.trim()}>
                        적용하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
