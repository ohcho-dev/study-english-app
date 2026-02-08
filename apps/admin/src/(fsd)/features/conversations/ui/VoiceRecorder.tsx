'use client';

/**
 * VoiceRecorder Component - Audio recording UI with visual feedback
 * 
 * Provides a user-friendly interface for voice recording with
 * real-time audio level visualization and duration display.
 */

import { Mic, Square, Pause, Play, AlertCircle } from 'lucide-react';

import { Button } from '@/shared/ui/button';

import { useVoiceRecorder, type UseVoiceRecorderOptions } from '../model/useVoiceRecorder';

interface VoiceRecorderProps {
    /** Callback when recording is completed */
    onRecordingComplete: (blob: Blob, t0UserEnd: number, duration: number) => void;
    /** Custom recorder options */
    options?: UseVoiceRecorderOptions;
    /** Whether the recorder is disabled */
    disabled?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Whether to show duration during recording */
    showDuration?: boolean;
    /** Whether to show audio level indicator */
    showAudioLevel?: boolean;
}

export const VoiceRecorder = ({
    onRecordingComplete,
    options = {},
    disabled = false,
    size = 'md',
    showDuration = true,
    showAudioLevel = true,
}: VoiceRecorderProps) => {
    const recorder = useVoiceRecorder({
        ...options,
        onStop: (result) => {
            onRecordingComplete(result.blob, result.t0UserEnd, result.duration);
            options.onStop?.(result);
        },
    });

    const sizeClasses = {
        sm: 'h-10 w-10',
        md: 'h-14 w-14',
        lg: 'h-20 w-20',
    };

    const iconSizes = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    // Audio level visualization (0-10 bars)
    const levelBars = Math.round(recorder.audioLevel * 10);

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Main Recording Button */}
            <div className="relative">
                {/* Audio Level Ring */}
                {recorder.isRecording && showAudioLevel && (
                    <div
                        className="absolute inset-0 rounded-full border-4 border-red-400 animate-pulse pointer-events-none"
                        style={{
                            transform: `scale(${1 + recorder.audioLevel * 0.3})`,
                            opacity: 0.5 + recorder.audioLevel * 0.5,
                            transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
                        }}
                    />
                )}

                <Button
                    variant={recorder.isRecording ? 'destructive' : 'default'}
                    size="icon"
                    className={`${sizeClasses[size]} rounded-full transition-all ${recorder.isRecording ? 'shadow-lg shadow-red-500/30' : ''
                        }`}
                    onClick={() => {
                        console.log('[VoiceRecorder] Button clicked, isRecording:', recorder.isRecording);
                        if (recorder.isRecording) {
                            console.log('[VoiceRecorder] Calling stopRecording');
                            recorder.stopRecording();
                        } else {
                            console.log('[VoiceRecorder] Calling startRecording');
                            recorder.startRecording();
                        }
                    }}
                    disabled={disabled}
                >
                    {recorder.isRecording ? (
                        <Square className={iconSizes[size]} />
                    ) : (
                        <Mic className={iconSizes[size]} />
                    )}
                </Button>
            </div>

            {/* Recording Status & Duration */}
            {recorder.isRecording && showDuration && (
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-mono text-lg text-red-600 dark:text-red-400">
                            {recorder.formattedDuration}
                        </span>
                    </div>

                    {/* Pause/Resume Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={recorder.isPaused ? recorder.resumeRecording : recorder.pauseRecording}
                    >
                        {recorder.isPaused ? (
                            <>
                                <Play className="h-4 w-4 mr-1" />
                                이어하기
                            </>
                        ) : (
                            <>
                                <Pause className="h-4 w-4 mr-1" />
                                일시정지
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Audio Level Bars */}
            {recorder.isRecording && showAudioLevel && (
                <div className="flex items-end gap-1 h-8">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 rounded-full transition-all duration-75 ${i < levelBars
                                ? 'bg-red-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                            style={{
                                height: `${(i + 1) * 3}px`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Helper Text */}
            {!recorder.isRecording && (
                <p className="text-sm text-muted-foreground">
                    {disabled ? '녹음이 비활성화됨' : '버튼을 눌러 녹음 시작'}
                </p>
            )}

            {/* Paused Indicator */}
            {recorder.isPaused && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">일시정지됨</span>
                </div>
            )}
        </div>
    );
};

export default VoiceRecorder;
