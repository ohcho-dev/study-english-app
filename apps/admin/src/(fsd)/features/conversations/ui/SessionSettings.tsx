import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/shared/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/select";
import { Slider } from "@/shared/ui/slider";
import { Label } from "@/shared/ui/label";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Settings2, Volume2, Zap, Gauge } from "lucide-react";
import { Participant } from "../model/types";


// Placeholder for Voice options until fully integrated
const VOICE_OPTIONS = [
    { id: "en-US-Neural2-F", name: "Google US Female (Neural2)" },
    { id: "en-US-Neural2-D", name: "Google US Male (Neural2)" },
    { id: "en-US-Wavenet-F", name: "Google US Female (Wavenet)" },
    { id: "en-US-Wavenet-D", name: "Google US Male (Wavenet)" },
    { id: "en-GB-Neural2-A", name: "Google UK Female (Neural2)" },
    { id: "en-GB-Neural2-B", name: "Google UK Male (Neural2)" },
];

const MODEL_OPTIONS = [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended)" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Preview)" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Legacy)" },
];

export interface ParticipantConfig {
    voice_id?: string;
    llm_model?: string;
    speaking_rate: number;
    difficulty: number;
}

export interface SessionConfig {
    participants: Record<string, ParticipantConfig>; // key: participant.id
}

interface SessionSettingsProps {
    participants: Participant[];
    config: SessionConfig;
    onChange: (newConfig: SessionConfig) => void;
    disabled?: boolean;
    currentSpeakerId?: string | null;
}

export const SessionSettings = ({
    participants,
    config,
    onChange,
    disabled,
    currentSpeakerId,
}: SessionSettingsProps) => {

    const handleParticipantChange = (
        participantId: string,
        field: keyof ParticipantConfig,
        value: any
    ) => {
        const currentConfig = config.participants[participantId] || {
            speaking_rate: 1.0,
            difficulty: 1,
            llm_model: "gemini-2.0-flash",
        };

        const newParticipantsConfig = {
            ...config.participants,
            [participantId]: {
                ...currentConfig,
                [field]: value,
            },
        };

        onChange({
            ...config,
            participants: newParticipantsConfig,
        });
    };

    const getParticipantConfig = (id: string) => {
        return (
            config.participants[id] || {
                speaking_rate: 1.0,
                difficulty: 1,
                voice_id: undefined,
                llm_model: "gemini-2.0-flash",
            }
        );
    };

    const aiParticipants = participants.filter(p => p.participant_type !== 'user');

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-1 pb-3 shrink-0">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">참여자 설정</h3>
                {disabled && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">세션 중</span>
                )}
            </div>

            {/* Participant Cards */}
            <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                    {aiParticipants.map((p) => {
                        const pConfig = getParticipantConfig(p.id);
                        const isSpeaking = currentSpeakerId === p.id;

                        return (
                            <div
                                key={p.id}
                                className={`
                                    rounded-lg border p-3 transition-all duration-300
                                    ${isSpeaking
                                        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                                        : 'border-border bg-card'
                                    }
                                `}
                            >
                                {/* Name + Role */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`
                                        flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                        ${isSpeaking
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                        }
                                    `}>
                                        {p.name[0]}
                                    </span>
                                    <span className="text-sm font-medium">{p.name}</span>
                                    {isSpeaking && (
                                        <span className="text-[10px] text-primary font-medium">발화 중</span>
                                    )}
                                </div>

                                {/* Settings Grid */}
                                <div className="space-y-2.5 pl-8">
                                    {/* Voice */}
                                    <div className="space-y-1">
                                        <Label className="text-[11px] flex items-center gap-1 text-muted-foreground">
                                            <Volume2 className="h-3 w-3" /> Voice
                                        </Label>
                                        <Select
                                            value={pConfig.voice_id || p.voice_id || ""}
                                            onValueChange={(val) =>
                                                handleParticipantChange(p.id, "voice_id", val)
                                            }
                                            disabled={disabled}
                                        >
                                            <SelectTrigger className="h-7 text-xs">
                                                <SelectValue placeholder="Select voice" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {VOICE_OPTIONS.map((v) => (
                                                    <SelectItem key={v.id} value={v.id} className="text-xs">
                                                        {v.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* LLM Model */}
                                    <div className="space-y-1">
                                        <Label className="text-[11px] flex items-center gap-1 text-muted-foreground">
                                            <Zap className="h-3 w-3" /> LLM Model
                                        </Label>
                                        <Select
                                            value={pConfig.llm_model || "gemini-2.5-flash"}
                                            onValueChange={(val) =>
                                                handleParticipantChange(p.id, "llm_model", val)
                                            }
                                            disabled={disabled}
                                        >
                                            <SelectTrigger className="h-7 text-xs">
                                                <SelectValue placeholder="Select Model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODEL_OPTIONS.map((m) => (
                                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                                        {m.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Speed + Difficulty inline */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Speed */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] flex items-center justify-between text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Zap className="h-3 w-3" /> Speed
                                                </span>
                                                <span>{pConfig.speaking_rate.toFixed(1)}x</span>
                                            </Label>
                                            <Slider
                                                min={0.5}
                                                max={2.0}
                                                step={0.1}
                                                value={[pConfig.speaking_rate]}
                                                onValueChange={([val]) =>
                                                    handleParticipantChange(p.id, "speaking_rate", val)
                                                }
                                                disabled={disabled}
                                            />
                                        </div>

                                        {/* Difficulty */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] flex items-center gap-1 text-muted-foreground">
                                                <Gauge className="h-3 w-3" /> Difficulty
                                            </Label>
                                            <Select
                                                value={String(pConfig.difficulty)}
                                                onValueChange={(val) =>
                                                    handleParticipantChange(p.id, "difficulty", parseInt(val))
                                                }
                                                disabled={disabled}
                                            >
                                                <SelectTrigger className="h-7 text-xs">
                                                    <SelectValue placeholder="Level" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">Lv.1 Beginner</SelectItem>
                                                    <SelectItem value="2">Lv.2 Elementary</SelectItem>
                                                    <SelectItem value="3">Lv.3 Intermediate</SelectItem>
                                                    <SelectItem value="4">Lv.4 Upper</SelectItem>
                                                    <SelectItem value="5">Lv.5 Advanced</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
};
