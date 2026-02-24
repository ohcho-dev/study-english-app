"""TTS Service - Text-to-Speech using Google Cloud TTS API with Gemini models.

Uses the official google-cloud-texttospeech SDK for higher quota limits
(1,000 req/min vs 10 req/min with genai SDK).
"""

import base64
import logging
import uuid
from pathlib import Path
from typing import Optional

from google.cloud import texttospeech
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings


logger = logging.getLogger(__name__)

# Audio output directory
AUDIO_DIR = Path(__file__).parent.parent.parent.parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


class TTSService:
    """Text-to-Speech service using Google Cloud TTS with Gemini TTS models."""
    
    def __init__(self, model_name: str = "gemini-2.5-flash-tts") -> None:
        """Initialize TTS service.
        
        Args:
            model_name: TTS model to use.
        """
        self.model_name = model_name
        self.client = texttospeech.TextToSpeechClient()
    
    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(3),
        reraise=True
    )
    async def generate_speech(
        self,
        text: str,
        voice_name: str = "Kore",
        prompt: Optional[str] = None,
    ) -> dict:
        """Generate speech from text.
        
        Args:
            text: Text to convert to speech.
            voice_name: Voice to use (Puck, Charon, Kore, Fenrir, Aoede, etc.)
            prompt: Optional style prompt for tone/emotion control.
            
        Returns:
            Dict with audio_url, audio_base64, and mime_type.
        """
        import asyncio
        
        # Build synthesis input with optional style prompt
        synthesis_input = texttospeech.SynthesisInput(
            text=text,
            prompt=prompt or "Say the following",
        )
        
        # Voice selection with Gemini model
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name=voice_name,
            model_name=self.model_name,
        )
        
        # Audio config — MP3 for browser compatibility
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
        )
        
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.synthesize_speech(
                    input=synthesis_input,
                    voice=voice,
                    audio_config=audio_config,
                ),
            )
            
            audio_bytes = response.audio_content
            if not audio_bytes:
                raise ValueError("No audio data in response")
            
            # Save audio file via StorageService
            from app.services.storage_service import storage
            
            file_id = str(uuid.uuid4())
            filename = f"{file_id}.mp3"
            audio_url = await storage.upload_audio(audio_bytes, filename)
            
            # Encode to base64 for response
            audio_base64_str = base64.b64encode(audio_bytes).decode("utf-8")
            
            return {
                "audio_url": audio_url,
                "audio_base64": audio_base64_str,
                "mime_type": "audio/mp3",
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"TTS generation failed: {error_msg}")
            raise RuntimeError(f"TTS generation failed: {error_msg}") from e


# Available TTS voices
TTS_VOICES = [
    "Puck",    # 남성
    "Charon",  # 남성
    "Kore",    # 여성
    "Fenrir",  # 남성
    "Aoede",   # 여성
    "Orbit",   # 중성
]


async def generate_speech_from_text(
    text: str,
    voice_name: str = "Kore",
    model_name: str = "gemini-2.5-flash-tts",
) -> dict:
    """Convenience function to generate speech.
    
    Args:
        text: Text to convert to speech.
        voice_name: Voice to use.
        model_name: TTS model to use.
        
    Returns:
        Dict with audio_url, audio_base64, and mime_type.
    """
    service = TTSService(model_name=model_name)
    return await service.generate_speech(text, voice_name=voice_name)
