"""Gemini TTS service.

Uses Google's Gemini generative AI models for text-to-speech synthesis.
Supports gemini-2.5-flash-preview-tts and gemini-2.5-pro-preview-tts models
with voice options: Aoede, Charon, Fenrir, Kore, Puck.
"""

import base64
import hashlib
import time
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings


# Available Gemini TTS voices
GEMINI_TTS_VOICES = {
    "Kore": {"gender": "FEMALE", "description": "밝고 활기찬 여성 음성 (추천)"},
    "Aoede": {"gender": "FEMALE", "description": "부드럽고 따뜻한 여성 음성"},
    "Puck": {"gender": "MALE", "description": "자연스럽고 친근한 남성 음성"},
    "Charon": {"gender": "MALE", "description": "차분하고 낮은 남성 음성"},
    "Fenrir": {"gender": "MALE", "description": "또렷하고 강한 남성 음성"},
}

# Available Gemini TTS models
GEMINI_TTS_MODELS = {
    "gemini-2.5-flash-preview-tts": {
        "name": "Gemini 2.5 Flash TTS",
        "description": "빠르고 효율적인 TTS 모델 (추천)",
    },
    "gemini-2.5-pro-preview-tts": {
        "name": "Gemini 2.5 Pro TTS",
        "description": "고품질 자연스러운 음성 생성",
    },
}


class GeminiTTSService:
    """Service for text-to-speech using Gemini generative AI models.
    
    Attributes:
        client: Google GenAI client.
        static_dir: Directory for saving audio files.
    """
    
    def __init__(self, static_dir: str = "static/audio") -> None:
        """Initialize the Gemini TTS service."""
        self.client = genai.Client(api_key=settings.GOOGLE_AI_API_KEY)
        self.static_dir = Path(static_dir)
        self.static_dir.mkdir(parents=True, exist_ok=True)
    
    async def synthesize(
        self,
        text: str,
        model: str = "gemini-2.5-flash-preview-tts",
        voice_name: str = "Kore",
        save_file: bool = True,
    ) -> dict[str, Any]:
        """Convert text to speech using Gemini TTS.
        
        Args:
            text: Text to synthesize.
            model: Gemini TTS model ID.
            voice_name: Voice name (Aoede, Charon, Fenrir, Kore, Puck).
            save_file: Whether to save as static file.
            
        Returns:
            Dictionary containing:
                - audio_base64: Base64-encoded audio.
                - audio_url: URL to saved audio file (if save_file=True).
                - duration_ms: Estimated audio duration.
                - processing_time_ms: Time taken to process.
        """
        start_time = time.time()
        
        # Use sync client in async context (genai SDK is sync)
        import asyncio
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            None,
            lambda: self._generate_speech(text, model, voice_name),
        )
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        audio_data = result["audio_data"]
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        # Save file if requested
        audio_url = None
        if save_file and audio_data:
            audio_url = await self._save_audio_file(audio_base64, text)
        
        # Estimate duration (rough: ~150 words per minute)
        word_count = len(text.split())
        estimated_duration_ms = int((word_count / 150) * 60 * 1000)
        
        return {
            "audio_base64": audio_base64,
            "audio_url": audio_url,
            "duration_ms": estimated_duration_ms,
            "processing_time_ms": processing_time_ms,
        }
    
    def _generate_speech(
        self, text: str, model: str, voice_name: str
    ) -> dict[str, Any]:
        """Generate speech using Gemini API (sync).
        
        Args:
            text: Text to synthesize.
            model: Gemini TTS model ID.
            voice_name: Voice name.
            
        Returns:
            Dictionary with audio_data bytes.
        """
        response = self.client.models.generate_content(
            model=model,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        ),
                    ),
                ),
            ),
        )
        
        # Extract audio data from response
        audio_data = b""
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    audio_data = part.inline_data.data
                    break
        
        if not audio_data:
            raise ValueError("No audio data received from Gemini TTS")
        
        return {"audio_data": audio_data}
    
    async def _save_audio_file(self, audio_base64: str, text: str) -> str:
        """Save audio content to a file.
        
        Args:
            audio_base64: Base64-encoded audio content.
            text: Original text (used for filename hash).
            
        Returns:
            URL path to the saved audio file.
        """
        text_hash = hashlib.md5(text.encode()).hexdigest()[:12]
        timestamp = int(time.time())
        # Gemini TTS outputs WAV format
        filename = f"gemini_tts_{timestamp}_{text_hash}.wav"
        filepath = self.static_dir / filename
        
        audio_bytes = base64.b64decode(audio_base64)
        filepath.write_bytes(audio_bytes)
        
        return f"/static/audio/{filename}"
    
    @staticmethod
    def get_available_models() -> list[dict[str, Any]]:
        """Get list of available Gemini TTS models."""
        models = []
        for model_id, info in GEMINI_TTS_MODELS.items():
            models.append({
                "id": model_id,
                "name": info["name"],
                "description": info["description"],
            })
        return models
    
    @staticmethod
    def get_available_voices() -> list[dict[str, Any]]:
        """Get list of available Gemini TTS voices."""
        voices = []
        for voice_name, info in GEMINI_TTS_VOICES.items():
            voices.append({
                "id": voice_name,
                "name": voice_name,
                "gender": info["gender"],
                "description": info["description"],
            })
        return voices
