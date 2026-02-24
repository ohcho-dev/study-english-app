"""Google Cloud Text-to-Speech service.

This module provides TTS functionality using Google Cloud Text-to-Speech API.
Supports multiple voices, SSML, and various audio settings.
"""

import base64
import hashlib
import os
import time
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings


# Available voices for conversation scenarios
AVAILABLE_VOICES = {
    # English (US) - Female
    "en-US-Wavenet-F": {"gender": "FEMALE", "name": "Sarah · WaveNet"},
    "en-US-Wavenet-C": {"gender": "FEMALE", "name": "Emma · WaveNet"},
    "en-US-Neural2-F": {"gender": "FEMALE", "name": "Olivia · Neural2"},
    "en-US-Neural2-C": {"gender": "FEMALE", "name": "Sophia · Neural2"},
    
    # English (US) - Male
    "en-US-Wavenet-D": {"gender": "MALE", "name": "Mike · WaveNet"},
    "en-US-Wavenet-B": {"gender": "MALE", "name": "James · WaveNet"},
    "en-US-Neural2-D": {"gender": "MALE", "name": "David · Neural2"},
    "en-US-Neural2-J": {"gender": "MALE", "name": "Daniel · Neural2"},
    
    # English (UK)
    "en-GB-Wavenet-A": {"gender": "FEMALE", "name": "Emily · WaveNet"},
    "en-GB-Wavenet-B": {"gender": "MALE", "name": "Oliver · WaveNet"},
    
    # English (Australia)
    "en-AU-Wavenet-B": {"gender": "MALE", "name": "Jack · WaveNet"},
    
    # English (US) - Polyglot
    "en-US-Polyglot-1": {"gender": "MALE", "name": "Polyglot"},

    # Korean
    "ko-KR-Wavenet-A": {"gender": "FEMALE", "name": "Sun-Hi · WaveNet"},
    "ko-KR-Wavenet-B": {"gender": "FEMALE", "name": "Ji-Min · WaveNet"},
    "ko-KR-Wavenet-C": {"gender": "MALE", "name": "In-Su · WaveNet"},
    "ko-KR-Wavenet-D": {"gender": "MALE", "name": "Jun-Ho · WaveNet"},
    "ko-KR-Neural2-A": {"gender": "FEMALE", "name": "Seo-Yun · Neural2"},
    "ko-KR-Neural2-B": {"gender": "FEMALE", "name": "Min-Ji · Neural2"},
    "ko-KR-Neural2-C": {"gender": "MALE", "name": "Min-Su · Neural2"},
}


class TTSService:
    """Service for converting text to speech using Google Cloud TTS.
    
    Supports SSML for fine-grained control over speech synthesis.
    
    Attributes:
        api_key: Google Cloud API key.
        api_url: Google Cloud TTS API endpoint.
        static_dir: Directory for saving audio files.
    """
    
    API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
    
    def __init__(self, static_dir: str = "static/audio") -> None:
        """Initialize the TTS service.
        
        Args:
            static_dir: Directory for saving generated audio files.
        """
        self.api_key = settings.GOOGLE_CLOUD_STT_TTS_API_KEY
        self.static_dir = Path(static_dir)
        self.static_dir.mkdir(parents=True, exist_ok=True)
    
    async def synthesize(
        self,
        text: str,
        voice_id: str = "en-US-Wavenet-F",
        speaking_rate: float = 1.0,
        pitch: float = 0.0,
        volume_gain_db: float = 0.0,
        save_file: bool = True,
    ) -> dict[str, Any]:
        """Convert text to speech.
        
        Args:
            text: Text to synthesize.
            voice_id: Google Cloud voice ID (e.g., en-US-Wavenet-F).
            speaking_rate: Speaking rate (0.25 to 4.0).
            pitch: Pitch adjustment (-20 to 20 semitones).
            volume_gain_db: Volume gain in dB (-96 to 16).
            save_file: Whether to save as static file.
            
        Returns:
            Dictionary containing:
                - audio_base64: Base64-encoded audio.
                - audio_url: URL to saved audio file (if save_file=True).
                - duration_ms: Estimated audio duration.
                - processing_time_ms: Time taken to process.
        """
        start_time = time.time()
        
        # Parse voice ID
        language_code = "-".join(voice_id.split("-")[:2])  # e.g., "en-US"
        
        # Prepare request
        request_body = {
            "input": {"text": text},
            "voice": {
                "languageCode": language_code,
                "name": voice_id,
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": speaking_rate,
                "pitch": pitch,
                "volumeGainDb": volume_gain_db,
            },
        }
        
        # Make API request
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.API_URL}?key={self.api_key}",
                json=request_body,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = response.json()
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        audio_content = result.get("audioContent", "")
        
        # Save file if requested
        audio_url = None
        if save_file and audio_content:
            audio_url = await self._save_audio_file(audio_content, text)
        
        # Estimate duration (rough: ~150 words per minute)
        word_count = len(text.split())
        estimated_duration_ms = int((word_count / 150) * 60 * 1000 / speaking_rate)
        
        return {
            "audio_base64": audio_content,
            "audio_url": audio_url,
            "duration_ms": estimated_duration_ms,
            "processing_time_ms": processing_time_ms,
        }
    
    async def synthesize_ssml(
        self,
        ssml: str,
        voice_id: str = "en-US-Wavenet-F",
        save_file: bool = True,
    ) -> dict[str, Any]:
        """Convert SSML to speech.
        
        Args:
            ssml: SSML markup text.
            voice_id: Google Cloud voice ID.
            save_file: Whether to save as static file.
            
        Returns:
            Dictionary with audio data and metadata.
        """
        start_time = time.time()
        
        language_code = "-".join(voice_id.split("-")[:2])
        
        request_body = {
            "input": {"ssml": ssml},
            "voice": {
                "languageCode": language_code,
                "name": voice_id,
            },
            "audioConfig": {
                "audioEncoding": "MP3",
            },
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.API_URL}?key={self.api_key}",
                json=request_body,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = response.json()
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        audio_content = result.get("audioContent", "")
        
        audio_url = None
        if save_file and audio_content:
            audio_url = await self._save_audio_file(audio_content, ssml)
        
        return {
            "audio_base64": audio_content,
            "audio_url": audio_url,
            "processing_time_ms": processing_time_ms,
        }
    
    async def _save_audio_file(self, audio_base64: str, text: str) -> str:
        """Save audio to storage and return URL.
        
        Args:
            audio_base64: Base64-encoded audio data.
            text: Original text (used for filename hash).
            
        Returns:
            URL path to the saved file.
        """
        from app.services.storage_service import storage

        # Generate unique filename based on content
        content_hash = hashlib.md5(text.encode()).hexdigest()[:12]
        timestamp = int(time.time())
        filename = f"{timestamp}_{content_hash}.mp3"
        
        # Decode and upload
        audio_bytes = base64.b64decode(audio_base64)
        return await storage.upload_audio(audio_bytes, filename)
    
    @staticmethod
    def get_available_voices() -> list[dict[str, Any]]:
        """Get list of available voices with metadata.
        
        Returns:
            List of voice info dictionaries.
        """
        voices = []
        for voice_id, info in AVAILABLE_VOICES.items():
            parts = voice_id.split("-")
            language = f"{parts[0]}-{parts[1]}"
            if "Polyglot" in voice_id:
                voice_type = "Polyglot"
            else:
                voice_type = "WaveNet" if "Wavenet" in voice_id else "Neural2"
            
            voices.append({
                "id": voice_id,
                "name": info["name"],
                "gender": info["gender"],
                "language": language,
                "type": voice_type,
            })
        
        return voices
    
    @staticmethod
    def create_ssml(
        text: str,
        speaking_rate: float = 1.0,
        pitch: str = "+0%",
        pause_before: float = 0.0,
        pause_after: float = 0.0,
        emphasis: str | None = None,
    ) -> str:
        """Create SSML markup for text.
        
        Args:
            text: Plain text to convert.
            speaking_rate: Speaking rate (0.25 to 4.0).
            pitch: Pitch as percentage (e.g., "+10%", "-5%").
            pause_before: Pause before text in seconds.
            pause_after: Pause after text in seconds.
            emphasis: Emphasis level (strong, moderate, reduced).
            
        Returns:
            SSML string.
        """
        ssml_parts = ["<speak>"]
        
        if pause_before > 0:
            ssml_parts.append(f'<break time="{pause_before}s"/>')
        
        # Build prosody tag
        prosody_attrs = []
        if speaking_rate != 1.0:
            prosody_attrs.append(f'rate="{speaking_rate}"')
        if pitch != "+0%":
            prosody_attrs.append(f'pitch="{pitch}"')
        
        if prosody_attrs:
            ssml_parts.append(f'<prosody {" ".join(prosody_attrs)}>')
        
        if emphasis:
            ssml_parts.append(f'<emphasis level="{emphasis}">{text}</emphasis>')
        else:
            ssml_parts.append(text)
        
        if prosody_attrs:
            ssml_parts.append("</prosody>")
        
        if pause_after > 0:
            ssml_parts.append(f'<break time="{pause_after}s"/>')
        
        ssml_parts.append("</speak>")
        
        return "".join(ssml_parts)
