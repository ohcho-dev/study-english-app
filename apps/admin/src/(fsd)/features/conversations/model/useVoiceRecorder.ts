/**
 * Voice Recorder Hook - Browser audio recording with WebM output
 * 
 * Provides customizable recording with real-time feedback and timing.
 */

import { useCallback, useRef, useState } from 'react';

export interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    audioLevel: number;
}

export interface RecordingResult {
    blob: Blob;
    duration: number;
    t0UserEnd: number;
}

export interface UseVoiceRecorderOptions {
    /** Max recording duration in seconds (default: 60) */
    maxDuration?: number;
    /** Callback when recording starts */
    onStart?: () => void;
    /** Callback when recording stops with result */
    onStop?: (result: RecordingResult) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Audio level update interval in ms (default: 100) */
    levelUpdateInterval?: number;
}

export const useVoiceRecorder = (options: UseVoiceRecorderOptions = {}) => {
    const {
        maxDuration = 60,
        onStart,
        onStop,
        onError,
        levelUpdateInterval = 100,
    } = options;

    const [state, setState] = useState<RecordingState>({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const levelIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Track if currently recording (ref to avoid stale closure)
    const isRecordingRef = useRef<boolean>(false);
    // Pause tracking: freeze visual timer, track background pause time
    const pausedAtRef = useRef<number>(0);
    const totalPausedMsRef = useRef<number>(0);
    const isPausedRef = useRef<boolean>(false);

    // Calculate audio level focused on human voice frequencies (85Hz – 3000Hz)
    const updateAudioLevel = useCallback(() => {
        if (!analyserRef.current || !audioContextRef.current) return;

        const analyser = analyserRef.current;
        const sampleRate = audioContextRef.current.sampleRate;
        const binCount = analyser.frequencyBinCount;
        const binHz = sampleRate / (analyser.fftSize); // Hz per bin

        // Human voice range: ~85Hz to ~3000Hz
        const voiceLowBin = Math.floor(85 / binHz);
        const voiceHighBin = Math.min(Math.ceil(3000 / binHz), binCount - 1);

        const dataArray = new Uint8Array(binCount);
        analyser.getByteFrequencyData(dataArray);

        // Average only voice-frequency bins
        let voiceSum = 0;
        let voiceBins = 0;
        for (let i = voiceLowBin; i <= voiceHighBin; i++) {
            voiceSum += dataArray[i];
            voiceBins++;
        }
        const voiceAvg = voiceBins > 0 ? voiceSum / voiceBins : 0;
        const normalizedLevel = Math.min(voiceAvg / 128, 1);

        setState((prev) => ({ ...prev, audioLevel: normalizedLevel }));
    }, []);

    // Internal stop function (defined early so startRecording can reference it)
    const performStop = useCallback(() => {
        const mediaRecorder = mediaRecorderRef.current;

        // Check actual MediaRecorder state instead of ref (more reliable)
        if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
            mediaRecorder.stop();

            // Clear intervals
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }
            if (levelIntervalRef.current) {
                clearInterval(levelIntervalRef.current);
                levelIntervalRef.current = null;
            }

            isRecordingRef.current = false;
            setState((prev) => ({
                ...prev,
                isRecording: false,
                isPaused: false,
                audioLevel: 0,
            }));
        }
    }, []);

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: true,
                },
            });

            // Set up audio analysis
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048; // 1024 bins → ~23Hz per bin at 48kHz
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            // Set up media recorder
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const t0UserEnd = Date.now();
                const duration = (t0UserEnd - startTimeRef.current) / 1000;

                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());

                // Clean up audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }

                onStop?.({ blob, duration, t0UserEnd });
            };

            mediaRecorder.onerror = () => {
                onError?.(new Error('Recording error'));
            };

            // Start recording
            startTimeRef.current = Date.now();
            totalPausedMsRef.current = 0;
            pausedAtRef.current = 0;
            isPausedRef.current = false;
            isRecordingRef.current = true;
            mediaRecorder.start(100); // Collect data every 100ms

            // Update duration (skip when paused so visual timer freezes)
            durationIntervalRef.current = setInterval(() => {
                if (isPausedRef.current) return; // freeze visual timer
                const elapsed = (Date.now() - startTimeRef.current - totalPausedMsRef.current) / 1000;
                setState((prev) => ({ ...prev, duration: elapsed }));

                // Auto-stop at max duration
                if (elapsed >= maxDuration) {
                    performStop();
                }
            }, 100);

            // Update audio level
            levelIntervalRef.current = setInterval(updateAudioLevel, levelUpdateInterval);

            setState({
                isRecording: true,
                isPaused: false,
                duration: 0,
                audioLevel: 0,
            });

            onStart?.();
        } catch (error) {
            onError?.(error instanceof Error ? error : new Error('Failed to start recording'));
        }
    }, [maxDuration, onStart, onStop, onError, levelUpdateInterval, updateAudioLevel, performStop]);

    // Stop recording (public API)
    const stopRecording = useCallback(() => {
        performStop();
    }, [performStop]);

    // Pause recording
    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
            mediaRecorderRef.current.pause();

            if (levelIntervalRef.current) {
                clearInterval(levelIntervalRef.current);
                levelIntervalRef.current = null;
            }

            // Track when pause started
            pausedAtRef.current = Date.now();
            isPausedRef.current = true;

            setState((prev) => ({ ...prev, isPaused: true, audioLevel: 0 }));
        }
    }, [state.isRecording, state.isPaused]);

    // Resume recording
    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && state.isPaused) {
            mediaRecorderRef.current.resume();

            // Accumulate paused duration
            if (pausedAtRef.current > 0) {
                totalPausedMsRef.current += Date.now() - pausedAtRef.current;
                pausedAtRef.current = 0;
            }
            isPausedRef.current = false;

            levelIntervalRef.current = setInterval(updateAudioLevel, levelUpdateInterval);

            setState((prev) => ({ ...prev, isPaused: false }));
        }
    }, [state.isPaused, levelUpdateInterval, updateAudioLevel]);

    // Format duration for display
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        ...state,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        formatDuration,
        formattedDuration: formatDuration(state.duration),
    };
};

export default useVoiceRecorder;

