'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioRecorderState {
    status: 'idle' | 'recording' | 'recorded';
    duration: number; // seconds
    audioBlob: Blob | null;
    audioUrl: string | null;
}

interface UseAudioRecorderReturn extends AudioRecorderState {
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    cancelRecording: () => void;
    reset: () => void;
    isSupported: boolean;
    error: string | null;
}

/**
 * Custom hook for audio recording using MediaRecorder API
 */
export const useAudioRecorder = (): UseAudioRecorderReturn => {
    const [status, setStatus] = useState<AudioRecorderState['status']>('idle');
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Check if MediaRecorder is supported
    const isSupported = typeof window !== 'undefined'
        && 'MediaRecorder' in window
        && typeof navigator !== 'undefined'
        && navigator.mediaDevices !== undefined
        && typeof navigator.mediaDevices.getUserMedia === 'function';

    // Cleanup function
    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current = null;
        }
        chunksRef.current = [];
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [cleanup, audioUrl]);

    const startRecording = useCallback(async () => {
        if (!isSupported) {
            setError('브라우저가 오디오 녹음을 지원하지 않습니다.');
            return;
        }

        try {
            setError(null);

            // Request microphone access
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('브라우저에서 마이크 접근을 지원하지 않습니다. HTTPS 환경인지 확인해주세요.');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100,
                }
            });
            streamRef.current = stream;

            // Create MediaRecorder with best available codec
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setStatus('recorded');
                cleanup();
            };

            mediaRecorder.onerror = () => {
                setError('녹음 중 오류가 발생했습니다.');
                cleanup();
                setStatus('idle');
            };

            // Start recording
            mediaRecorder.start(100); // collect data every 100ms
            setStatus('recording');
            startTimeRef.current = Date.now();
            setDuration(0);

            // Update duration every second
            timerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setDuration(elapsed);
            }, 1000);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '마이크 접근 권한이 필요합니다.';
            setError(errorMessage);
            cleanup();
        }
    }, [isSupported, cleanup]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const cancelRecording = useCallback(() => {
        cleanup();
        setStatus('idle');
        setDuration(0);
    }, [cleanup]);

    const reset = useCallback(() => {
        cleanup();
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setStatus('idle');
        setDuration(0);
        setAudioBlob(null);
        setAudioUrl(null);
        setError(null);
    }, [cleanup, audioUrl]);

    return {
        status,
        duration,
        audioBlob,
        audioUrl,
        startRecording,
        stopRecording,
        cancelRecording,
        reset,
        isSupported,
        error,
    };
};

/**
 * Format seconds to MM:SS
 */
export const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
