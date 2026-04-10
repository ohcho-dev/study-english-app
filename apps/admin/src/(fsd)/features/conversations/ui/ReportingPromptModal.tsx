'use client';

/**
 * ReportingPromptModal — Reporting LLM 글로벌 프롬프트 설정 모달
 *
 * 세션 목록 페이지 헤더에 배치. 저장 시 모든 세션의 AI 분석에 전역 적용됨.
 */

import { useState } from 'react';
import { Settings2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/ui/dialog';

import {
    useReportingPrompt,
    useUpdateReportingPrompt,
    getDefaultReportingPrompt,
} from '@/(fsd)/features/conversations';

export function ReportingPromptModal() {
    const [open, setOpen] = useState(false);
    const [editedPrompt, setEditedPrompt] = useState('');
    const [editedModel, setEditedModel] = useState('gemini-3.1-pro');
    const [editedTemperature, setEditedTemperature] = useState('0.3');
    const [editedName, setEditedName] = useState('');
    const [loadingDefault, setLoadingDefault] = useState(false);

    const { data: reportingPrompt, isLoading: promptLoading } = useReportingPrompt();
    const updatePrompt = useUpdateReportingPrompt();

    const handleOpen = async (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) return;

        // 모달 열릴 때 현재 프롬프트로 초기화
        if (reportingPrompt) {
            if (reportingPrompt.is_default || !reportingPrompt.system_prompt) {
                // 기본 프롬프트(코드 내장)는 /default API에서 문자열 로드
                setLoadingDefault(true);
                try {
                    const d = await getDefaultReportingPrompt();
                    setEditedPrompt(d.system_prompt);
                    setEditedModel(d.llm_model);
                    setEditedTemperature(d.temperature);
                } finally {
                    setLoadingDefault(false);
                }
                setEditedName('v1 사용자 정의');
            } else {
                setEditedPrompt(reportingPrompt.system_prompt ?? '');
                setEditedModel(reportingPrompt.llm_model);
                setEditedTemperature(reportingPrompt.temperature);
                setEditedName(reportingPrompt.name);
            }
        }
    };

    const handleResetToDefault = async () => {
        setLoadingDefault(true);
        try {
            const d = await getDefaultReportingPrompt();
            setEditedPrompt(d.system_prompt);
            setEditedModel(d.llm_model);
            setEditedTemperature(d.temperature);
        } finally {
            setLoadingDefault(false);
        }
    };

    const handleSave = () => {
        updatePrompt.mutate(
            {
                name: editedName,
                system_prompt: editedPrompt,
                llm_model: editedModel,
                temperature: editedTemperature,
            },
            { onSuccess: () => setOpen(false) },
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    AI 분석 설정
                    {reportingPrompt && (
                        <span className="text-xs text-muted-foreground font-normal">
                            {reportingPrompt.is_default
                                ? '(기본)'
                                : `(${reportingPrompt.name})`}
                        </span>
                    )}
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        Reporting LLM 프롬프트 설정
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        저장 시 이후 모든 세션의 &quot;AI 분석 실행&quot;에 전역 적용됩니다.
                        이미 분석된 세션의 결과는 변경되지 않습니다.
                    </p>
                </DialogHeader>

                {promptLoading || loadingDefault ? (
                    <div className="py-8 text-center text-muted-foreground animate-pulse text-sm">
                        프롬프트 로드 중...
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {/* 현재 활성 프롬프트 상태 */}
                        <div className="p-3 bg-muted rounded-lg text-sm">
                            <span className="font-medium">현재 활성:</span>{' '}
                            {reportingPrompt?.is_default
                                ? '기본 프롬프트 (코드 내장) — DB에 저장된 프롬프트 없음'
                                : `${reportingPrompt?.name} · ${reportingPrompt?.llm_model}`}
                        </div>

                        {/* 프롬프트 이름 */}
                        <div>
                            <label className="text-sm font-medium">새 버전 이름</label>
                            <input
                                type="text"
                                className="w-full border rounded px-3 py-1.5 text-sm mt-1"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="예: v2 상세 분석"
                            />
                        </div>

                        {/* 모델 + 온도 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">LLM 모델</label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-3 py-1.5 text-sm mt-1 font-mono"
                                    value={editedModel}
                                    onChange={(e) => setEditedModel(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Temperature</label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-3 py-1.5 text-sm mt-1 font-mono"
                                    value={editedTemperature}
                                    onChange={(e) => setEditedTemperature(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 시스템 프롬프트 */}
                        <div>
                            <label className="text-sm font-medium">시스템 프롬프트</label>
                            <textarea
                                className="w-full border rounded px-3 py-2 text-xs font-mono mt-1"
                                rows={18}
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                            />
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-2 pt-1">
                            <Button
                                onClick={handleSave}
                                disabled={updatePrompt.isPending || !editedPrompt.trim() || !editedName.trim()}
                            >
                                {updatePrompt.isPending ? '저장 중...' : '새 버전으로 저장'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleResetToDefault}
                                disabled={loadingDefault}
                            >
                                기본값으로 리셋
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                            >
                                취소
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
