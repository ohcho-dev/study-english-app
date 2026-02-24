"""Gemini TTS service.

Uses Google Cloud Text-to-Speech API with Gemini TTS models.
Supports style prompts for emotional control, markup tags, and multiple voices.

Models:
  - gemini-2.5-flash-tts: Fast, efficient (recommended)
  - gemini-2.5-flash-lite-preview-tts: Lightweight preview
  - gemini-2.5-pro-tts: Highest quality

Voices: Aoede, Charon, Fenrir, Kore, Puck, and more.
"""

import base64
import hashlib
import logging
import time
from pathlib import Path
from typing import Any, Optional

from google.cloud import texttospeech

from app.core.config import settings


logger = logging.getLogger(__name__)

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
    "gemini-2.5-flash-tts": {
        "name": "Gemini 2.5 Flash TTS",
        "description": "빠르고 효율적인 TTS 모델 (추천)",
    },
    "gemini-2.5-flash-lite-preview-tts": {
        "name": "Gemini 2.5 Flash Lite TTS (Preview)",
        "description": "경량 프리뷰 TTS 모델",
    },
    "gemini-2.5-pro-tts": {
        "name": "Gemini 2.5 Pro TTS",
        "description": "고품질 자연스러운 음성 생성",
    },
}

# Emotion → TTS style prompt mapping
EMOTION_STYLE_PROMPTS = {
    "happy": "Speak in a cheerful, warm, and upbeat tone.",
    "excited": "Speak with enthusiasm and energy, as if sharing exciting news.",
    "nervous": "Speak in a calm, reassuring, and gentle tone to put the listener at ease.",
    "confused": "Speak slowly and clearly, in a patient and supportive way.",
    "frustrated": "Speak in a calm, empathetic, and understanding tone.",
    "shy": "Speak in a soft, gentle, and encouraging way.",
    "neutral": "Speak in a natural, friendly conversational tone.",
}


class GeminiTTSService:
    """Service for text-to-speech using Google Cloud TTS with Gemini models.
    
    Uses the official google-cloud-texttospeech SDK which routes through
    the Cloud Text-to-Speech API (1,000 req/min quota) instead of the
    Generative Language API (10 req/min quota).
    """
    
    def __init__(self, static_dir: str = "static/audio") -> None:
        """Initialize the Gemini TTS service."""
        self.client = texttospeech.TextToSpeechClient()
        self.static_dir = Path(static_dir)
        self.static_dir.mkdir(parents=True, exist_ok=True)
    
    async def synthesize(
        self,
        text: str,
        model: str = "gemini-2.5-flash-tts",
        voice_name: str = "Kore",
        prompt: Optional[str] = None,
        user_emotion: Optional[str] = None,
        save_file: bool = True,
    ) -> dict[str, Any]:
        """Convert text to speech using Gemini TTS via Cloud TTS API.
        
        Args:
            text: Text to synthesize.
            model: Gemini TTS model name.
            voice_name: Voice name (Aoede, Charon, Fenrir, Kore, Puck).
            prompt: Style prompt for controlling tone/emotion.
            user_emotion: User emotion key to auto-generate style prompt.
            save_file: Whether to save as static file.
            
        Returns:
            Dictionary containing audio_base64, audio_url, duration_ms, processing_time_ms.
        """
        start_time = time.time()
        
        # Build style prompt: explicit prompt > emotion-based > default
        style_prompt = prompt
        if not style_prompt and user_emotion:
            style_prompt = EMOTION_STYLE_PROMPTS.get(user_emotion, EMOTION_STYLE_PROMPTS["neutral"])
        if not style_prompt:
            style_prompt = "Say the following"
        
        # Build synthesis input with text + style prompt
        synthesis_input = texttospeech.SynthesisInput(
            text=text,
            prompt=style_prompt,
        )
        
        # Voice selection with Gemini model
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name=voice_name,
            model_name=model,
        )
        
        # Audio config — MP3 for browser compatibility
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
        )
        
        # Perform synthesis (sync SDK call in async context)
        import asyncio
        loop = asyncio.get_event_loop()
        
        try:
            response = await loop.run_in_executor(
                None,
                lambda: self.client.synthesize_speech(
                    input=synthesis_input,
                    voice=voice,
                    audio_config=audio_config,
                ),
            )
        except Exception as e:
            logger.error(f"Gemini TTS synthesis failed: {e}")
            raise
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        audio_data = response.audio_content
        if not audio_data:
            raise ValueError("No audio data received from Gemini TTS")
        
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        # Save file if requested
        audio_url = None
        if save_file and audio_data:
            audio_url = await self._save_audio_file(audio_data, text)
        
        # Estimate duration (rough: ~150 words per minute)
        word_count = len(text.split())
        estimated_duration_ms = int((word_count / 150) * 60 * 1000)
        
        logger.info(
            f"Gemini TTS: model={model}, voice={voice_name}, "
            f"emotion={user_emotion}, prompt='{style_prompt[:50]}...', "
            f"processing={processing_time_ms}ms"
        )
        
        return {
            "audio_base64": audio_base64,
            "audio_url": audio_url,
            "duration_ms": estimated_duration_ms,
            "processing_time_ms": processing_time_ms,
        }
    
    async def _save_audio_file(self, audio_bytes: bytes, text: str) -> str:
        """Save audio content using StorageService."""
        from app.services.storage_service import storage

        text_hash = hashlib.md5(text.encode()).hexdigest()[:12]
        timestamp = int(time.time())
        filename = f"gemini_tts_{timestamp}_{text_hash}.mp3"
        return await storage.upload_audio(audio_bytes, filename)
    
    @staticmethod
    def get_available_models() -> list[dict[str, Any]]:
        """Get list of available Gemini TTS models."""
        return [
            {"id": model_id, "name": info["name"], "description": info["description"]}
            for model_id, info in GEMINI_TTS_MODELS.items()
        ]
    
    @staticmethod
    def get_available_voices() -> list[dict[str, Any]]:
        """Get list of available Gemini TTS voices."""
        return [
            {"id": name, "name": name, "gender": info["gender"], "description": info["description"]}
            for name, info in GEMINI_TTS_VOICES.items()
        ]
