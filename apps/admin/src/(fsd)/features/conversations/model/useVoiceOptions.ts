import { useQuery } from '@tanstack/react-query';
import { getAvailableVoices } from '../api/conversationsApi';
import { VoiceInfo } from './types';

export const useAvailableVoices = () => {
    return useQuery({
        queryKey: ['conversations', 'voices'],
        queryFn: getAvailableVoices,
        staleTime: 1000 * 60 * 60, // 1 hour cached
    });
};

// Define types for grouped options
interface VoiceOption {
    label: string;
    value: string;
    voice: VoiceInfo;
}

interface VoiceGroup {
    label: string;
    options: VoiceOption[];
}

const LANGUAGE_LABELS: Record<string, string> = {
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'en-AU': 'English (Australia)',
    'ko-KR': 'Korean',
};

export const useVoiceOptions = () => {
    const { data: voices = [], isLoading, error } = useAvailableVoices();

    const options: VoiceOption[] = voices.map((v) => ({
        label: `${v.name} (${v.language}, ${v.gender}, ${v.type})`,
        value: v.id,
        voice: v,
    }));

    // Group by language
    const groups: Record<string, VoiceOption[]> = {};

    voices.forEach((v) => {
        const langCode = v.language;
        if (!groups[langCode]) {
            groups[langCode] = [];
        }
        groups[langCode].push({
            label: `${v.name} (${v.gender}, ${v.type})`,
            value: v.id,
            voice: v,
        });
    });

    const groupedOptions: VoiceGroup[] = [];
    Object.keys(groups).sort().forEach((langCode) => {
        groupedOptions.push({
            label: LANGUAGE_LABELS[langCode] || langCode,
            options: groups[langCode],
        });
    });

    return {
        voices,
        options,
        groupedOptions,
        isLoading,
        error
    };
};
