"""
Signaling Service for WebRTC.

This module handles WebSocket connections for signaling in the My Turn conversation system.
It manages the exchange of SDP offers/answers and ICE candidates between the client and server.
"""

import json
import logging
from typing import Any, Dict, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for signaling."""

    def __init__(self):
        # Store active connections: session_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # Store WebRTC peer connections (managed by WebRTCService, but tracked here)
        # In a real app, this might be better placed in WebRTCService or a shared state manager.
        self.peer_connections: Dict[str, Any] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        """Accepts a WebSocket connection and stores it."""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"Client connected to session: {session_id}")

    def disconnect(self, session_id: str):
        """Removes a WebSocket connection."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        logger.info(f"Client disconnected from session: {session_id}")

    async def send_message(self, session_id: str, message: Dict[str, Any]):
        """Sends a JSON message to a specific session."""
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                # Potentially disconnect if send fails repeatedly
        else:
            logger.warning(f"Session {session_id} not found for sending message")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a message to all connected clients (for debugging/admin)."""
        for session_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {session_id}: {e}")


# Global connection manager instance
manager = ConnectionManager()
