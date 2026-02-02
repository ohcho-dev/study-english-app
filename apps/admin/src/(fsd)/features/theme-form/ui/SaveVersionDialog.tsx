'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/shared/ui/dialog';
import { Loader2 } from 'lucide-react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (description: string) => void;
    isSaving?: boolean;
}

export const SaveVersionDialog = ({ open, onOpenChange, onSave, isSaving }: Props) => {
    const [description, setDescription] = useState('');

    const handleSave = () => {
        onSave(description);
        setDescription('');
    };

    const handleClose = () => {
        setDescription('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>버전 저장</DialogTitle>
                    <DialogDescription>
                        변경 사항에 대한 설명을 작성하세요. 나중에 버전을 구분하는 데 도움이 됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="예: 다크모드 배경색 변경"
                        autoFocus
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                        취소
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        저장
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
