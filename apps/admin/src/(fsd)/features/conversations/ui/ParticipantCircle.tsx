'use client';

/**
 * ParticipantCircle Component
 * 
 * Displays participant avatars in a dynamic layout (2-5 participants).
 * Active speaker gets a glowing ring with audio wave animation.
 */

import { cn } from '@/lib/utils';
import type { Participant } from '../model/types';

interface ParticipantCircleProps {
    participants: Participant[];
    currentSpeakerId: string | null;
    isUserTurn: boolean;
    userName?: string;
}

const SPEAKER_COLORS: Record<string, string> = {
    moderator: 'from-violet-500 to-purple-600',
    ai: 'from-blue-500 to-cyan-500',
    user: 'from-emerald-500 to-green-500',
};

const AVATAR_BG: Record<string, string> = {
    moderator: 'bg-violet-500/20 text-violet-400',
    ai: 'bg-blue-500/20 text-blue-400',
    user: 'bg-emerald-500/20 text-emerald-400',
};

/** Sound wave dots animation for the active speaker */
const SpeakingWave = () => (
    <div className="flex items-center gap-[2px] mt-0.5">
        {[0, 1, 2].map((i) => (
            <div
                key={i}
                className="w-[3px] rounded-full bg-current animate-bounce"
                style={{
                    height: `${8 + (i % 2) * 4}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '0.6s',
                }}
            />
        ))}
    </div>
);

const AvatarItem = ({
    participant,
    isSpeaking,
    isUser,
    userName,
}: {
    participant: Participant;
    isSpeaking: boolean;
    isUser: boolean;
    userName?: string;
}) => {
    const type = participant.participant_type;
    const displayName = isUser ? (userName || 'Me') : participant.name;
    const initial = isUser ? '나' : participant.name[0]?.toUpperCase();
    const roleLabel = isUser ? 'You' : type === 'moderator' ? 'Mod' : 'AI';

    return (
        <div className="flex flex-col items-center gap-1 min-w-0">
            {/* Avatar ring */}
            <div className="relative">
                {/* Glow ring for active speaker */}
                {isSpeaking && (
                    <div
                        className={cn(
                            'absolute -inset-1 rounded-full bg-gradient-to-r opacity-70 blur-sm animate-pulse',
                            SPEAKER_COLORS[type] || SPEAKER_COLORS.ai
                        )}
                    />
                )}

                {/* Avatar circle */}
                <div
                    className={cn(
                        'relative flex items-center justify-center rounded-full border-2 transition-all duration-300',
                        'w-12 h-12 sm:w-14 sm:h-14',
                        isSpeaking
                            ? cn('border-transparent bg-gradient-to-r', SPEAKER_COLORS[type])
                            : 'border-muted-foreground/20 opacity-50',
                    )}
                >
                    {/* Inner avatar */}
                    <div
                        className={cn(
                            'flex items-center justify-center rounded-full text-sm font-bold',
                            'w-10 h-10 sm:w-12 sm:h-12',
                            isSpeaking ? 'bg-background' : '',
                            AVATAR_BG[type] || AVATAR_BG.ai
                        )}
                    >
                        {participant.avatar_url ? (
                            <img
                                src={participant.avatar_url}
                                alt={displayName}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="text-base sm:text-lg">{initial}</span>
                        )}
                    </div>
                </div>

                {/* Speaking indicator */}
                {isSpeaking && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <div className={cn(
                            'flex items-center justify-center px-1 py-0.5 rounded-full text-[8px]',
                            'bg-gradient-to-r',
                            SPEAKER_COLORS[type]
                        )}>
                            <SpeakingWave />
                        </div>
                    </div>
                )}
            </div>

            {/* Name */}
            <span
                className={cn(
                    'text-[11px] font-medium truncate max-w-[60px] sm:max-w-[72px] text-center leading-tight',
                    isSpeaking ? 'text-foreground' : 'text-muted-foreground/60'
                )}
            >
                {displayName}
            </span>

            {/* Role label */}
            <span
                className={cn(
                    'text-[9px] -mt-0.5 truncate max-w-[60px]',
                    isSpeaking ? 'text-muted-foreground' : 'text-muted-foreground/40'
                )}
            >
                {roleLabel}
            </span>
        </div>
    );
};

export const ParticipantCircle = ({
    participants,
    currentSpeakerId,
    isUserTurn,
    userName,
}: ParticipantCircleProps) => {
    const count = participants.length;

    // Split into rows for 4-5 participants
    const useDoubleRow = count >= 4;
    const topRow = useDoubleRow ? participants.slice(0, 3) : participants;
    const bottomRow = useDoubleRow ? participants.slice(3) : [];

    return (
        <div className="flex flex-col items-center gap-2 py-3 px-4">
            {/* Top row */}
            <div className="flex items-center justify-center gap-4 sm:gap-6">
                {topRow.map((p) => {
                    const isUser = p.participant_type === 'user';
                    const isSpeaking = isUser ? isUserTurn : currentSpeakerId === p.id;
                    return (
                        <AvatarItem
                            key={p.id}
                            participant={p}
                            isSpeaking={isSpeaking}
                            isUser={isUser}
                            userName={userName}
                        />
                    );
                })}
            </div>

            {/* Bottom row (4-5 participants) */}
            {bottomRow.length > 0 && (
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                    {bottomRow.map((p) => {
                        const isUser = p.participant_type === 'user';
                        const isSpeaking = isUser ? isUserTurn : currentSpeakerId === p.id;
                        return (
                            <AvatarItem
                                key={p.id}
                                participant={p}
                                isSpeaking={isSpeaking}
                                isUser={isUser}
                                userName={userName}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};
