'use client';

import { useEffect, useState } from 'react';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

import type { OutputFieldDescriptor } from '../../model/types';

export const SectionBlock = ({ title, description, children }: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) => (
    <section className="space-y-2 rounded-2xl border border-border bg-card/85 p-4 shadow-sm shadow-black/10 backdrop-blur">
        <div>
            <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
            {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {children}
    </section>
);

export const VariableSuggestions = ({ registry }: { registry: OutputFieldDescriptor[] }) => (
    <div className="rounded-xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">출력 레지스트리</p>
        <div className="mt-2 flex flex-wrap gap-2">
            {registry.map((field) => (
                <code key={field.key} className="rounded border border-border bg-background/80 px-2 py-1 text-[11px] text-teal-300">
                    {`{{${field.path}}}`}
                </code>
            ))}
        </div>
    </div>
);

export const BindingsEditor = ({
    title,
    description,
    value,
    onChange,
    suggestions,
}: {
    title: string;
    description?: string;
    value: Record<string, string>;
    onChange: (next: Record<string, string>) => void;
    suggestions: OutputFieldDescriptor[];
}) => {
    const entries = Object.entries(value || {});
    return (
        <SectionBlock title={title} description={description ?? '키명과 참조식을 연결합니다.'}>
            <div className="space-y-2">
                {entries.map(([key, binding], index) => (
                    // key를 index로 고정 → 변수명 타이핑 중 re-mount 방지 (포커스 유지)
                    <div key={index} className="grid grid-cols-[120px_1fr_auto] gap-2">
                        <Input
                            value={key}
                            onChange={(event) => {
                                const nextKey = event.target.value;
                                // 순서를 유지하면서 키 이름만 교체
                                const nextEntries = entries.map(([k, v], i) =>
                                    i === index ? [nextKey, v] : [k, v]
                                );
                                onChange(Object.fromEntries(nextEntries));
                            }}
                            placeholder="변수명"
                        />
                        <Input
                            value={binding}
                            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
                            placeholder="{{start.transcript}}"
                            list={`binding-suggestions-${title}`}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                const clone = { ...value };
                                delete clone[key];
                                onChange(clone);
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...value, [`input_${entries.length + 1}`]: '' })}
            >
                <Plus className="mr-2 h-4 w-4" />
                변수 추가
            </Button>
            <VariableSuggestions registry={suggestions} />
            <datalist id={`binding-suggestions-${title}`}>
                {suggestions.map((field) => (
                    <option key={field.key} value={`{{${field.path}}}`} />
                ))}
            </datalist>
        </SectionBlock>
    );
};

const serializeOutputs = (items: Array<{ path: string; label: string }> | undefined) =>
    (items || []).map((item) => `${item.path}|${item.label}`).join('\n');

const parseOutputs = (text: string) =>
    text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const sep = line.indexOf('|');
            const path = sep === -1 ? line : line.slice(0, sep);
            const label = sep === -1 ? line : line.slice(sep + 1);
            return { key: path, path, label: label || path };
        });

export const DeclaredOutputsEditor = ({
    value,
    onChange,
}: {
    value: Array<{ key: string; label: string; path: string }> | undefined;
    onChange: (next: Array<{ key: string; label: string; path: string }>) => void;
}) => {
    // 로컬 텍스트 상태 — 타이핑 중에는 부모에 반영하지 않음
    const [text, setText] = useState(() => serializeOutputs(value));

    // 노드 전환 등 외부에서 value가 바뀌면 텍스트 초기화
    const serialized = serializeOutputs(value);
    useEffect(() => {
        setText(serialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serialized]);

    return (
        <SectionBlock title="출력 등록" description="하위 노드가 참조할 출력 필드를 등록합니다. 형식: path|라벨 (한 줄에 하나, 포커스를 잃으면 저장)">
            <Textarea
                rows={6}
                className="font-mono text-xs"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onBlur={() => onChange(parseOutputs(text))}
                placeholder={`result.score|점수\nresult.summary|요약`}
            />
        </SectionBlock>
    );
};

export const JsonTextareaField = ({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
}) => (
    <div className="space-y-1">
        <Label>{label}</Label>
        <Textarea rows={8} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="font-mono text-xs" />
    </div>
);
