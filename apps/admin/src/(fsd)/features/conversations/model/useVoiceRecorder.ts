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
    /** Whether voice is currently detected (VAD) */
    isSpeaking: boolean;
}

export interface RecordingResult {
    blob: Blob;
    duration: number;
    t0UserEnd: number;
    /** How recording ended: 'vad' (silence timeout) or 'button' (manual) */
    speechEndMethod: 'vad' | 'button';
}

export interface UseVoiceRecorderOptions {
    /** Max recording duration in seconds (default: 90) */
    maxDuration?: number;
    /** Callback when recording starts */
    onStart?: () => void;
    /** Callback when recording stops with result */
    onStop?: (result: RecordingResult) => void;
    /** Callback when a chunk of audio data is available (for streaming STT) */
    onDataAvailable?: (data: Blob) => void;
    /** Callback on error */
    onError?: (error: Error) => void;
    /** Audio level update interval in ms (default: 100) */
    levelUpdateInterval?: number;
    /** Enable VAD (Voice Activity Detection) auto-stop (default: false) */
    enableVAD?: boolean;
    /** VAD: audio level threshold below which is considered silence (0~1, default: 0.05) */
    vadSilenceThreshold?: number;
    /** VAD: duration of silence before auto-stop in ms (default: 2000) */
    vadSilenceTimeoutMs?: number;
    /** VAD: minimum recording duration before VAD can trigger in seconds (default: 1) */
    vadMinDurationSec?: number;
}

export const useVoiceRecorder = (options: UseVoiceRecorderOptions = {}) => {
    const {
        maxDuration = 90,
        onStart,
        onStop,
        onDataAvailable,
        onError,
        levelUpdateInterval = 100,
        enableVAD = false,
        vadSilenceThreshold = 0.05,
        vadSilenceTimeoutMs = 2000,
        vadMinDurationSec = 1,
    } = options;

    const [state, setState] = useState<RecordingState>({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
        isSpeaking: false,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
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
    // VAD tracking
    const silenceSinceRef = useRef<number | null>(null);
    const hasSpokenRef = useRef<boolean>(false);
    // Ref to performStop so updateAudioLevel can call it without circular dep
    const performStopRef = useRef<() => void>(() => { });
    // Track if VAD triggered the stop
    const vadStoppedRef = useRef<boolean>(false);
    // Refs for all callbacks to avoid stale closures in mediaRecorder event handlers
    const onStopRef = useRef(onStop);
    const onStartRef = useRef(onStart);
    const onDataAvailableRef = useRef(onDataAvailable);
    const onErrorRef = useRef(onError);

    // Keep refs in sync with latest callbacks
    onStopRef.current = onStop;
    onStartRef.current = onStart;
    onDataAvailableRef.current = onDataAvailable;
    onErrorRef.current = onError;

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

        // VAD: detect speech/silence
        const speaking = normalizedLevel > vadSilenceThreshold;
        if (enableVAD && isRecordingRef.current && !isPausedRef.current) {
            if (speaking) {
                hasSpokenRef.current = true;
                silenceSinceRef.current = null;
            } else if (hasSpokenRef.current) {
                // Silence detected after speech
                const now = Date.now();
                if (silenceSinceRef.current === null) {
                    silenceSinceRef.current = now;
                } else {
                    const silenceDuration = now - silenceSinceRef.current;
                    const recordDuration = (now - startTimeRef.current - totalPausedMsRef.current) / 1000;
                    if (silenceDuration >= vadSilenceTimeoutMs && recordDuration >= vadMinDurationSec) {
                        // Auto-stop: silence timeout reached
                        vadStoppedRef.current = true;
                        performStopRef.current();
                        return;
                    }
                }
            }
        }

        setState((prev) => ({ ...prev, audioLevel: normalizedLevel, isSpeaking: speaking }));
    }, [enableVAD, vadSilenceThreshold, vadSilenceTimeoutMs, vadMinDurationSec]);

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
                isSpeaking: false,
            }));
        }
    }, []);

    // Keep ref in sync
    performStopRef.current = performStop;

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

            // If streaming STT is enabled, set up ScriptProcessorNode for raw PCM capture
            if (onDataAvailableRef.current) {
                const bufferSize = 1024; // ~21ms at 48kHz — smaller = more frequent chunks
                const scriptProcessor = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
                scriptProcessor.onaudioprocess = (e) => {
                    const float32Data = e.inputBuffer.getChannelData(0);
                    // Convert float32 [-1, 1] to int16 [-32768, 32767]
                    const int16Data = new Int16Array(float32Data.length);
                    for (let i = 0; i < float32Data.length; i++) {
                        const s = Math.max(-1, Math.min(1, float32Data[i]));
                        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    onDataAvailableRef.current?.(new Blob([int16Data.buffer]));
                };
                source.connect(scriptProcessor);
                // Connect to a silent gain node (NOT destination) to avoid mic feedback
                const silentGain = audioContextRef.current.createGain();
                silentGain.gain.value = 0;
                silentGain.connect(audioContextRef.current.destination);
                scriptProcessor.connect(silentGain);
                scriptProcessorRef.current = scriptProcessor;
            }

            // Set up media recorder (for final recording blob)
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                    // NOTE: onDataAvailable is now handled by ScriptProcessorNode above
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const t0UserEnd = Date.now();
                const duration = (t0UserEnd - startTimeRef.current) / 1000;

                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());

                // Clean up script processor (streaming PCM)
                if (scriptProcessorRef.current) {
                    scriptProcessorRef.current.disconnect();
                    scriptProcessorRef.current = null;
                }

                // Clean up audio context
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }

                onStopRef.current?.({ blob, duration, t0UserEnd, speechEndMethod: vadStoppedRef.current ? 'vad' : 'button' });
            };

            mediaRecorder.onerror = () => {
                onErrorRef.current?.(new Error('Recording error'));
            };

            // Start recording
            startTimeRef.current = Date.now();
            totalPausedMsRef.current = 0;
            pausedAtRef.current = 0;
            isPausedRef.current = false;
            isRecordingRef.current = true;
            // Reset VAD state
            silenceSinceRef.current = null;
            hasSpokenRef.current = false;
            vadStoppedRef.current = false;
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
                isSpeaking: false,
            });

            onStartRef.current?.();
        } catch (error) {
            onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to start recording'));
        }
    }, [maxDuration, levelUpdateInterval, updateAudioLevel, performStop]);

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
        maxDuration,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        formatDuration,
        formattedDuration: formatDuration(state.duration),
    };
};

export default useVoiceRecorder;

