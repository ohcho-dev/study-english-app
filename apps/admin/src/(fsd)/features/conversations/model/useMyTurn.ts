/**
 * My Turn Hook - WebRTC session management
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { endSession as apiEndSession } from '../api/conversationsApi';
import { WS_BASE_URL } from '@/shared/lib/api';

/** Evaluator pipeline output summary */
export interface EvaluatorData {
    overall_score?: number;
    primary_issue?: string;
    recommended_action?: string;
    wpm?: number;
    response_delay_sec?: number;
    /** Extra fields from LLM output not in standard schema */
    engine_trace?: Record<string, unknown>;
}

/** Planner pipeline output summary */
export interface PlannerData {
    current_level?: number;
    path?: string;
    reason?: string | string[];
    /** Extra fields from LLM output not in standard schema */
    engine_trace?: Record<string, unknown>;
}

/** Conductor pipeline output summary */
export interface ConductorData {
    scripts?: number;
    return_to_user_after?: boolean;
    user_emotion?: string;
    level_instruction?: string;
    /** Extra fields from LLM output not in standard schema */
    engine_trace?: Record<string, unknown>;
}

export interface ChatMessage {
    id: string;
    speaker: string;
    text: string;
    isUser: boolean;
    timestamp: number;
    /** Grammar/expression corrections from v0.2 pipeline (user messages only) */
    corrections?: string[];
    /** Suggested better expressions from v0.2 pipeline (user messages only) */
    betterExpressions?: string[];
    /** Energy flow comparison data from parallel API (user messages only) */
    energyFlow?: {
        verb: string;
        core_energy: string;
        comparisons: { korean: string; english: string; direction: string }[];
    } | null;
    /** Whether energy flow is still loading */
    energyFlowLoading?: boolean;
    /** Evaluator pipeline output (user messages only, when available) */
    evaluatorData?: EvaluatorData;
    /** Planner pipeline output (user messages only, when available) */
    plannerData?: PlannerData;
    /** Conductor pipeline output (user messages only, when available) */
    conductorData?: ConductorData;
}

export interface MyTurnState {
    isConnected: boolean;
    isSessionActive: boolean;
    error: string | null;
    currentSpeaker: { id: string; name: string; type: string; avatar_url?: string } | null;
    isUserTurn: boolean;
    turnIndex: number;
    transcript: string;
    aiResponse: string | null;
    isProcessing: boolean;
    chatHistory: ChatMessage[];
}

export interface UseMyTurnOptions {
    /** Whether to enable parallel Energy Flow API calls */
    energyFlowEnabled?: boolean;
}

export const useMyTurn = (sessionId: string | null, options: UseMyTurnOptions = {}) => {
    const { energyFlowEnabled = false } = options;
    const [state, setState] = useState<MyTurnState>({
        isConnected: false,
        isSessionActive: false,
        error: null,
        currentSpeaker: null,
        isUserTurn: false,
        turnIndex: -1,
        transcript: '',
        aiResponse: null,
        isProcessing: false,
        chatHistory: [],
    });

    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    // Initialize WebRTC and Signaling
    const connect = useCallback(async () => {
        if (!sessionId) return;

        try {
            // 1. Create WebRTC PeerConnection
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            pcRef.current = pc;

            // 2. Setup Audio Track (Mic)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));
            } catch (e) {
                console.warn('Mic permission denied or not available', e);
            }

            // 3. Connect WebSocket Signaling
            const wsUrl = `${WS_BASE_URL}/api/v1/conversations/sessions/${sessionId}/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                console.log('WS Connected');
                setState((prev) => ({ ...prev, isConnected: true }));

                // Create and send Offer
                if (pc.signalingState === 'closed') return;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }));
            };

            ws.onmessage = async (event) => {
                const msg = JSON.parse(event.data);

                if (msg.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription({
                        type: 'answer',
                        sdp: msg.sdp
                    }));
                } else if (msg.type === 'ice-candidate') {
                    // Handle candidate
                } else if (msg.type === 'turn_changed') {
                    setState((prev) => ({
                        ...prev,
                        turnIndex: msg.turn_index,
                        currentSpeaker: msg.speaker,
                        isUserTurn: msg.is_user_turn,
                        isSessionActive: true,
                        aiResponse: null,
                    }));
                } else if (msg.type === 'ai_response') {
                    const newMsg: ChatMessage = {
                        id: Date.now().toString(),
                        speaker: msg.speaker,
                        text: msg.text,
                        isUser: false,
                        timestamp: Date.now(),
                    };

                    setState((prev) => ({
                        ...prev,
                        aiResponse: msg.text,
                        chatHistory: [...prev.chatHistory, newMsg],
                    }));

                    if (msg.audio) {
                        try {
                            const audio = new Audio(`data:audio/mp3;base64,${msg.audio}`);
                            audio.onended = () => {
                                console.log("Audio finished, sending turn_complete");
                                if (ws.readyState === WebSocket.OPEN) {
                                    ws.send(JSON.stringify({ type: 'turn_complete' }));
                                }
                            };
                            await audio.play();

                            // Metrics: Log t3 (audio play start)
                            if (msg.turn_id && sessionId) {
                                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversations/sessions/log`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        session_id: sessionId,
                                        turn_id: msg.turn_id,
                                        t3_audio_play_start: Date.now() // milliseconds
                                    })
                                }).catch(e => console.error("Failed to log t3:", e));
                            }

                        } catch (e) {
                            console.error("Failed to play audio:", e);
                            // Fallback sync
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'turn_complete' }));
                            }
                        }
                    } else {
                        // Text only turn (e.g. system message or error fallback)
                        // Add small delay to allow reading
                        setTimeout(() => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: 'turn_complete' }));
                            }
                        }, 2000);
                    }
                }
            };

            ws.onerror = (e) => {
                console.error('WS Error', e);
                setState((prev) => ({ ...prev, error: 'Connection failed' }));
            };

            ws.onclose = () => {
                console.log('WS Closed');
                setState((prev) => ({ ...prev, isConnected: false }));
            };

        } catch (err) {
            console.error('Connection failed:', err);
            setState((prev) => ({
                ...prev,
                error: err instanceof Error ? err.message : 'Failed to connect'
            }));
        }
    }, [sessionId]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        setState((prev) => ({ ...prev, isConnected: false, isSessionActive: false }));
    }, []);

    const startSession = useCallback(async (userName: string = 'User') => {
        if (!sessionId) return;
        try {
            const formData = new FormData();
            formData.append('user_name', userName);

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversations/sessions/${sessionId}/start`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to start session');
            const data = await res.json();
            console.log('Session started:', data);

        } catch (err) {
            console.error(err);
            setState(prev => ({ ...prev, error: 'Failed to start session' }));
        }
    }, [sessionId]);

    const endSession = useCallback(async () => {
        if (!sessionId) return;
        try {
            await apiEndSession(sessionId);
            disconnect();
        } catch (err) {
            console.error('Failed to end session:', err);
            // Verify if we should disconnect anyway. For now, yes.
            disconnect();
        }
    }, [sessionId, disconnect]);

    /**
     * Fetch energy flow data in parallel (non-blocking).
     * Uses a ref to access the latest chatHistory, avoiding React stale closure issues.
     * Finds the last Ryan message and fires the /energy-flow API.
     */
    const chatHistoryRef = useRef<ChatMessage[]>([]);
    chatHistoryRef.current = state.chatHistory;

    const fetchEnergyFlow = useCallback(async (userMsgId: string, studentText: string) => {
        if (!sessionId) return;

        try {
            // Use ref to get latest chatHistory (avoids stale closure)
            const history = chatHistoryRef.current;
            const lastAiMsg = [...history].reverse().find(m => !m.isUser);
            if (!lastAiMsg) {
                console.warn('[EnergyFlow] No Ryan message found in history, clearing loading state');
                setState(prev => ({
                    ...prev,
                    chatHistory: prev.chatHistory.map(msg =>
                        msg.id === userMsgId ? { ...msg, energyFlowLoading: false } : msg
                    ),
                }));
                return;
            }

            console.log('[EnergyFlow] Fetching for AI:', lastAiMsg.text.slice(0, 50), '...');

            const formData = new FormData();
            formData.append('ryan_utterance', lastAiMsg.text);
            formData.append('student_response', studentText);
            formData.append('level', '1');

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversations/sessions/${sessionId}/energy-flow`,
                { method: 'POST', body: formData }
            );

            if (res.ok) {
                const data = await res.json();
                console.log('[EnergyFlow] Success:', data.energy_flow?.verb);
                setState(prev => ({
                    ...prev,
                    chatHistory: prev.chatHistory.map(msg =>
                        msg.id === userMsgId
                            ? { ...msg, energyFlow: data.energy_flow, energyFlowLoading: false }
                            : msg
                    ),
                }));
            } else {
                console.error('[EnergyFlow] API error:', res.status);
                setState(prev => ({
                    ...prev,
                    chatHistory: prev.chatHistory.map(msg =>
                        msg.id === userMsgId
                            ? { ...msg, energyFlowLoading: false }
                            : msg
                    ),
                }));
            }
        } catch (err) {
            console.error('[EnergyFlow] Fetch error:', err);
            setState(prev => ({
                ...prev,
                chatHistory: prev.chatHistory.map(msg =>
                    msg.id === userMsgId
                        ? { ...msg, energyFlowLoading: false }
                        : msg
                ),
            }));
        }
    }, [sessionId]);

    const sendAudio = useCallback(async (
        audioBlob: Blob,
        t0UserEnd?: number,
        tRecordingStart?: number,
        tFirstSpeech?: number,
    ) => {
        if (!sessionId) return;

        setState(prev => ({ ...prev, isProcessing: true }));

        try {
            const formData = new FormData();
            formData.append('audio_file', audioBlob, 'input.webm');
            // metrics: t0 (user end) — 녹음 종료 시점 사용
            formData.append('t0_user_end', (t0UserEnd || Date.now()).toString());
            console.log(`[sendAudio] timing: t0=${t0UserEnd}, tRecStart=${tRecordingStart}, tFirstSpeech=${tFirstSpeech}`);
            if (tRecordingStart) formData.append('t_recording_start', tRecordingStart.toString());
            if (tFirstSpeech) formData.append('t_first_speech', tFirstSpeech.toString());

            let res: Response;
            try {
                res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversations/sessions/${sessionId}/audio`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });
            } catch (networkErr) {
                // CORS or network error — server likely crashed with 500
                console.error('Network/CORS error sending audio:', networkErr);
                setState(prev => ({
                    ...prev,
                    error: '서버 연결 오류 — 서버 로그를 확인하세요.',
                    isProcessing: false,
                }));
                return;
            }

            if (!res.ok) {
                const errText = await res.text().catch(() => 'Unknown error');
                console.error(`Audio API error ${res.status}:`, errText);
                throw new Error(`Failed to send audio (${res.status})`);
            }
            const data = await res.json();

            // Note: transcript update might come from turn_changed event too, but this gives immediate feedback
            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                speaker: 'Me',
                text: data.transcript,
                isUser: true,
                timestamp: Date.now(),
                corrections: data.corrections?.length ? data.corrections : undefined,
                betterExpressions: data.better_expressions?.length ? data.better_expressions : undefined,
                evaluatorData: data.evaluator_data || undefined,
                plannerData: data.planner_data || undefined,
                conductorData: data.conductor_data || undefined,
            };

            setState(prev => ({
                ...prev,
                transcript: data.transcript,
                isProcessing: false,
                chatHistory: [...prev.chatHistory, { ...userMsg, energyFlowLoading: energyFlowEnabled ? true : undefined }]
            }));

            // Fire energy flow API in parallel (non-blocking) — only if enabled
            if (energyFlowEnabled) {
                fetchEnergyFlow(userMsg.id, data.transcript);
            }

        } catch (err) {
            console.error(err);
            setState(prev => ({ ...prev, error: 'Failed to send audio', isProcessing: false }));
        }
    }, [sessionId]);

    const sendText = useCallback(async (text: string, t0UserEnd?: number, t1ServerFinal?: number, tRecordingStart?: number, tFirstSpeech?: number) => {
        if (!sessionId || !text.trim()) return;

        setState(prev => ({ ...prev, isProcessing: true }));

        try {
            const formData = new FormData();
            formData.append('text', text);
            if (t0UserEnd !== undefined) formData.append('t0_user_end', t0UserEnd.toString());
            if (t1ServerFinal !== undefined) formData.append('t1_server_final', t1ServerFinal.toString());
            if (tRecordingStart !== undefined) formData.append('t_recording_start', tRecordingStart.toString());
            if (tFirstSpeech !== undefined) formData.append('t_first_speech', tFirstSpeech.toString());

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversations/sessions/${sessionId}/text`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to send text');
            const data = await res.json();

            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                speaker: 'Me',
                text: text,
                isUser: true,
                timestamp: Date.now(),
                corrections: data.corrections?.length ? data.corrections : undefined,
                betterExpressions: data.better_expressions?.length ? data.better_expressions : undefined,
                evaluatorData: data.evaluator_data || undefined,
                plannerData: data.planner_data || undefined,
                conductorData: data.conductor_data || undefined,
            };

            setState(prev => ({
                ...prev,
                transcript: text,
                isProcessing: false,
                chatHistory: [...prev.chatHistory, { ...userMsg, energyFlowLoading: energyFlowEnabled ? true : undefined }]
            }));

            // Fire energy flow API in parallel (non-blocking) — only if enabled
            if (energyFlowEnabled) {
                fetchEnergyFlow(userMsg.id, text);
            }

        } catch (err) {
            console.error(err);
            setState(prev => ({ ...prev, error: 'Failed to send text', isProcessing: false }));
        }
    }, [sessionId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        ...state,
        connect,
        disconnect,
        startSession,
        endSession,
        sendAudio,
        sendText,
    };
};
