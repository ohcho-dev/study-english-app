"""
WebRTC Service.

This module manages WebRTC PeerConnections using `aiortc`.
It handles SDP negotiation and tracks for audio streaming (Mic input -> STT, TTS -> Speaker).
"""

import json
import logging
from typing import Dict, Optional
import uuid

# aiortc imports (will fail if not installed)
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
    from aiortc.contrib.media import MediaBlackhole, MediaRecorder
except ImportError:
    # Dummy classes for development environment without aiortc
    class RTCPeerConnection:
        def __init__(self): pass
        async def close(self): pass
    class RTCSessionDescription:
        def __init__(self, sdp, type): pass
    class MediaStreamTrack:
        pass

from app.services.conversation.signaling import manager

logger = logging.getLogger(__name__)


class WebRTCService:
    """Manages WebRTC PeerConnections."""

    def __init__(self):
        self.pcs: Dict[str, RTCPeerConnection] = {}

    async def create_peer_connection(self, session_id: str) -> RTCPeerConnection:
        """Creates and configures a new PeerConnection."""
        pc = RTCPeerConnection()
        self.pcs[session_id] = pc

        @pc.on("connectionstatechange")
        async def on_connectionstatechange():
            logger.info(f"Connection state for {session_id}: {pc.connectionState}")
            if pc.connectionState == "failed":
                await pc.close()
                if session_id in self.pcs:
                    del self.pcs[session_id]

        @pc.on("track")
        def on_track(track):
            logger.info(f"Track received: {track.kind}")
            if track.kind == "audio":
                # Handle incoming audio (User Mic)
                # In Phase 4, we will pipe this to STT/VAD
                # For now, we just record it or blackhole it
                recorder = MediaBlackhole()
                recorder.addTrack(track)
                # await recorder.start()

        return pc

    async def handle_offer(self, session_id: str, sdp: str) -> Dict[str, str]:
        """Handles an SDP offer from the client."""
        pc = await self.create_peer_connection(session_id)
        
        offer = RTCSessionDescription(sdp=sdp, type="offer")
        await pc.setRemoteDescription(offer)

        # Add TTS track (Server -> Client)
        # In Phase 4, this will be a real source
        # For now, maybe add a dummy track or silence
        # pc.addTrack(TTSTrack()) 

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}

    async def close(self, session_id: str):
        """Closes a PeerConnection."""
        if session_id in self.pcs:
            await self.pcs[session_id].close()
            del self.pcs[session_id]


# Global WebRTC service instance
webrtc_service = WebRTCService()
