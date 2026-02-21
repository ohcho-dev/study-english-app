/**
 * My Turn Hook - WebRTC session management
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { endSession as apiEndSession } from '../api/conversationsApi';

export interface ChatMessage {
    id: string;
    speaker: string;
    text: string;
    isUser: boolean;
    timestamp: number;
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

export const useMyTurn = (sessionId: string | null) => {
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
            const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/api/v1/conversations/sessions/${sessionId}/ws`;
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

    const sendAudio = useCallback(async (audioBlob: Blob) => {
        if (!sessionId) return;

        setState(prev => ({ ...prev, isProcessing: true }));

        try {
            const formData = new FormData();
            formData.append('audio_file', audioBlob, 'input.webm');
            // metrics: t0 (user end)
            formData.append('t0_user_end', Date.now().toString());

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/conversations/sessions/${sessionId}/audio`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to send audio');
            const data = await res.json();

            // Note: transcript update might come from turn_changed event too, but this gives immediate feedback
            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                speaker: 'Me',
                text: data.transcript,
                isUser: true,
                timestamp: Date.now(),
            };

            setState(prev => ({
                ...prev,
                transcript: data.transcript,
                isProcessing: false,
                chatHistory: [...prev.chatHistory, userMsg]
            }));

        } catch (err) {
            console.error(err);
            setState(prev => ({ ...prev, error: 'Failed to send audio', isProcessing: false }));
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
    };
};
