/**
 * useAudioStorage Hook - Separate audio storage strategies (base64 vs URL)
 * 
 * Abstracts audio data handling so components don't need to know
 * whether audio is stored as base64 (inline) or GCS URL (remote).
 */

import { useCallback, useState } from 'react';

export type AudioStorageType = 'base64' | 'url';

export interface AudioEntry {
    id: string;
    type: AudioStorageType;
    /** base64 data (if type === 'base64') */
    base64?: string;
    /** Remote URL (if type === 'url') */
    url?: string;
    /** MIME type (e.g., 'audio/webm', 'audio/mp3') */
    mimeType: string;
    /** Duration in ms */
    durationMs?: number;
    /** Created at timestamp */
    createdAt: number;
}

interface UseAudioStorageReturn {
    /** All stored audio entries */
    entries: AudioEntry[];
    /** Add an audio entry from a base64 string */
    addBase64: (id: string, base64: string, mimeType?: string, durationMs?: number) => void;
    /** Add an audio entry from a URL */
    addUrl: (id: string, url: string, mimeType?: string, durationMs?: number) => void;
    /** Add an entry from a Run0 response (auto-detect base64 or url) */
    addFromResponse: (id: string, response: { audio_base64?: string | null; audio_url?: string | null }) => void;
    /** Get a playable audio source (data URI or URL) */
    getPlayableSource: (id: string) => string | null;
    /** Remove an audio entry */
    remove: (id: string) => void;
    /** Clear all entries */
    clear: () => void;
}

export const useAudioStorage = (): UseAudioStorageReturn => {
    const [entries, setEntries] = useState<AudioEntry[]>([]);

    const addBase64 = useCallback((id: string, base64: string, mimeType = 'audio/mp3', durationMs?: number) => {
        setEntries((prev) => [
            ...prev.filter((e) => e.id !== id),
            {
                id,
                type: 'base64',
                base64,
                mimeType,
                durationMs,
                createdAt: Date.now(),
            },
        ]);
    }, []);

    const addUrl = useCallback((id: string, url: string, mimeType = 'audio/mp3', durationMs?: number) => {
        setEntries((prev) => [
            ...prev.filter((e) => e.id !== id),
            {
                id,
                type: 'url',
                url,
                mimeType,
                durationMs,
                createdAt: Date.now(),
            },
        ]);
    }, []);

    const addFromResponse = useCallback(
        (id: string, response: { audio_base64?: string | null; audio_url?: string | null }) => {
            if (response.audio_url) {
                addUrl(id, response.audio_url);
            } else if (response.audio_base64) {
                addBase64(id, response.audio_base64);
            }
        },
        [addBase64, addUrl],
    );

    const getPlayableSource = useCallback(
        (id: string): string | null => {
            const entry = entries.find((e) => e.id === id);
            if (!entry) return null;

            if (entry.type === 'url' && entry.url) {
                return entry.url;
            }
            if (entry.type === 'base64' && entry.base64) {
                return `data:${entry.mimeType};base64,${entry.base64}`;
            }
            return null;
        },
        [entries],
    );

    const remove = useCallback((id: string) => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const clear = useCallback(() => {
        setEntries([]);
    }, []);

    return {
        entries,
        addBase64,
        addUrl,
        addFromResponse,
        getPlayableSource,
        remove,
        clear,
    };
};

export default useAudioStorage;
