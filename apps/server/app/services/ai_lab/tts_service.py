"""TTS Service - Text-to-Speech using Gemini API."""

import base64
import os
import uuid
from pathlib import Path

from google import genai
from google.genai import types, errors
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from app.core.config import settings


# Audio output directory
AUDIO_DIR = Path(__file__).parent.parent.parent.parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _is_retryable_error(exception: Exception) -> bool:
    """Check if the exception is retryable.
    
    Retry on 429 (Too Many Requests) for RPM limits, but NOT for RPD (Daily Quota) limits.
    Retry on 5xx (Server Errors) and other transient errors.
    """
    if isinstance(exception, errors.ClientError):
        # 429: Resource Exhausted
        if exception.code == 429:
            # If daily quota exceeded, do not retry
            if "GenerateRequestsPerDay" in str(exception) or "quota exceeded" in str(exception).lower():
                return False
            # If rate limit (RPM) exceeded, retry
            return True
        # 5xx: Server Errors
        if exception.code >= 500:
            print(f"DEBUG: Retrying on Server Error: {exception}")
            return True
            
    # Also retry on other potential transient errors if they don't have code (e.g. network issues)
    # But be careful not to retry on 400 (Invalid Argument)
    return False


class TTSService:
    """Text-to-Speech service using Gemini TTS models.
    
    Generates audio from text using gemini-2.5-flash-preview-tts model.
    """
    
    def __init__(self, model_name: str = "gemini-2.5-flash-preview-tts") -> None:
        """Initialize TTS service.
        
        Args:
            model_name: TTS model to use.
        """
        self.model_name = model_name
        self.client = genai.Client(api_key=settings.GOOGLE_AI_API_KEY)
    
    @retry(
        retry=retry_if_exception(_is_retryable_error),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        stop=stop_after_attempt(5),
        reraise=True
    )
    async def generate_speech(
        self,
        text: str,
        voice_name: str = "Kore",
    ) -> dict:
        """Generate speech from text.
        
        Args:
            text: Text to convert to speech.
            voice_name: Voice to use (Puck, Charon, Kore, Fenrir, Aoede, etc.)
            
        Returns:
            Dict with audio_url and audio_path.
        """
        try:
            # Configure speech output
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=types.Content(
                    parts=[
                        types.Part(text=text)
                    ]
                ),
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=voice_name,
                            )
                        )
                    ),
                ),
            )
            
            # Extract audio data
            audio_data = None
            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    audio_data = part.inline_data.data
                    mime_type = part.inline_data.mime_type
                    print(f"DEBUG: Found inline_data. MimeType: {mime_type}, Data Type: {type(audio_data)}")
                    break
            
            if not audio_data:
                print("DEBUG: No audio data found in candidates")
                raise ValueError("No audio data in response")
            
            # Decode audio data
            if isinstance(audio_data, bytes):
                audio_bytes = audio_data
                print("DEBUG: audio_data is already bytes, skipping base64 decode")
            else:
                audio_bytes = base64.b64decode(audio_data)
                print("DEBUG: audio_data is string, performing base64 decode")
            
            print(f"DEBUG: Audio bytes length: {len(audio_bytes)}")
            print(f"DEBUG: First 20 bytes (hex): {audio_bytes[:20].hex()}")

            # Save audio file via StorageService
            from app.services.storage_service import storage
            
            file_id = str(uuid.uuid4())
            
            # Check for PCM data and convert to WAV
            if "audio/L16" in mime_type or "pcm" in mime_type:
                import wave
                import io
                filename = f"{file_id}.wav"
                
                print(f"DEBUG: Detected PCM data ({mime_type}). Converting to WAV.")
                
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, "wb") as wav_file:
                    wav_file.setnchannels(1)  # Mono
                    wav_file.setsampwidth(2)  # 16-bit
                    wav_file.setframerate(24000)
                    wav_file.writeframes(audio_bytes)
                audio_bytes_to_save = wav_buffer.getvalue()
            else:
                extension = "wav" if "wav" in mime_type else "mp3"
                filename = f"{file_id}.{extension}"
                audio_bytes_to_save = audio_bytes
            
            audio_url = await storage.upload_audio(audio_bytes_to_save, filename)
            
            # Encode to base64 for response
            audio_base64_str = base64.b64encode(audio_bytes).decode("utf-8")
            
            return {
                "audio_url": audio_url,
                "audio_base64": audio_base64_str,
                "mime_type": mime_type,
            }
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg:
                 print(f"WARNING: TTS Quota Exceeded. Please try again later. Error: {e}")
            elif "500" in error_msg:
                 print(f"WARNING: TTS Server Error. Retrying might help. Error: {e}")
            
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
    model_name: str = "gemini-2.5-flash-preview-tts",
) -> dict:
    """Convenience function to generate speech.
    
    Args:
        text: Text to convert to speech.
        voice_name: Voice to use.
        model_name: TTS model to use.
        
    Returns:
        Dict with audio_url and audio_path.
    """
    service = TTSService(model_name=model_name)
    return await service.generate_speech(text, voice_name=voice_name)
