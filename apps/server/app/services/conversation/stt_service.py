"""Google Cloud Speech-to-Text service.

This module provides STT functionality using Google Cloud Speech-to-Text API.
Supports audio format conversion and returns transcription with timing metadata.
"""

import base64
import io
import time
from typing import Any

import httpx
from pydub import AudioSegment

from app.core.config import settings


class STTService:
    """Service for converting speech to text using Google Cloud STT.
    
    Attributes:
        api_key: Google Cloud API key.
        api_url: Google Cloud STT API endpoint.
    """
    
    API_URL = "https://speech.googleapis.com/v1/speech:recognize"
    
    def __init__(self) -> None:
        """Initialize the STT service."""
        self.api_key = settings.GOOGLE_CLOUD_STT_TTS_API_KEY
    
    async def transcribe(
        self,
        audio_data: bytes,
        audio_format: str = "webm",
        language_code: str = "en-US",
        sample_rate_hertz: int = 16000,
        model: str = "latest_long",
    ) -> dict[str, Any]:
        """Convert speech audio to text.
        
        Args:
            audio_data: Raw audio bytes.
            audio_format: Input audio format (webm, wav, mp3, etc.).
            language_code: Language code for speech recognition.
            sample_rate_hertz: Sample rate of the audio.
            
        Returns:
            Dictionary containing:
                - transcript: Transcribed text.
                - confidence: Confidence score (0-1).
                - words: Word-level timing (if available).
                - duration_ms: Duration in milliseconds.
                - processing_time_ms: Time taken to process.
        """
        start_time = time.time()
        
        # OPTIMIZATION: Try Direct WebM (WEBM_OPUS) to avoid conversion overhead
        result = None
        if audio_format.lower() == "webm":
            try:
                request_body = {
                    "config": {
                        "encoding": "WEBM_OPUS",
                        # Note: sampleRateHertz omitted — Google auto-detects for Opus
                        "languageCode": language_code,

                        "enableWordTimeOffsets": True,
                        "enableAutomaticPunctuation": True,
                        "model": model,
                    },
                    "audio": {
                        "content": base64.b64encode(audio_data).decode("utf-8"),
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
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"WebM direct upload failed: {e}. Falling back to converted WAV.")
                result = None

        # Fallback: Convert audio to Linear16 WAV if WebM failed or format is not WebM
        if not result:
            audio_content, actual_sample_rate = await self._prepare_audio(
                audio_data,
                audio_format,
                sample_rate_hertz,
            )
            
            # Prepare request
            request_body = {
                "config": {
                    "encoding": "LINEAR16",
                    "sampleRateHertz": actual_sample_rate,
                    "languageCode": language_code,

                    "enableWordTimeOffsets": True,
                    "enableAutomaticPunctuation": True,
                    "model": model,
                },
                "audio": {
                    "content": base64.b64encode(audio_content).decode("utf-8"),
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
        
        # Parse response
        if "results" not in result or not result["results"]:
            return {
                "transcript": "",
                "confidence": 0.0,
                "words": [],
                "duration_ms": 0,
                "processing_time_ms": processing_time_ms,
            }
        
        # Combine ALL result segments.
        # When users pause between words/sentences, Google Cloud STT
        # returns multiple result segments. We must join them all.
        transcript_parts = []
        total_confidence = 0.0
        words = []
        num_results = len(result["results"])
        
        for segment in result["results"]:
            alternative = segment.get("alternatives", [{}])[0]
            seg_text = alternative.get("transcript", "")
            if seg_text:
                transcript_parts.append(seg_text.strip())
            total_confidence += alternative.get("confidence", 0.0)
            
            # Parse word timings from each segment
            for word_info in alternative.get("words", []):
                words.append({
                    "word": word_info.get("word", ""),
                    "start_time": self._parse_duration(word_info.get("startTime", "0s")),
                    "end_time": self._parse_duration(word_info.get("endTime", "0s")),
                })
        
        transcript = " ".join(transcript_parts)
        confidence = total_confidence / num_results if num_results > 0 else 0.0
        
        # Calculate duration from last word
        duration_ms = 0
        if words:
            duration_ms = int(words[-1]["end_time"] * 1000)
        
        return {
            "transcript": transcript,
            "confidence": confidence,
            "words": words,
            "duration_ms": duration_ms,
            "processing_time_ms": processing_time_ms,
        }
    
    async def _prepare_audio(
        self,
        audio_data: bytes,
        audio_format: str,
        target_sample_rate: int = 16000,
    ) -> tuple[bytes, int]:
        """Convert audio to Linear16 WAV format.
        
        Args:
            audio_data: Raw audio bytes.
            audio_format: Input format (webm, wav, mp3, ogg, etc.).
            target_sample_rate: Target sample rate.
            
        Returns:
            Tuple of (audio_bytes, sample_rate).
        """
        try:
            # Load audio using pydub
            audio_io = io.BytesIO(audio_data)
            
            if audio_format.lower() in ("webm", "opus", "ogg"):
                audio = AudioSegment.from_file(audio_io, format="webm")
            elif audio_format.lower() == "mp3":
                audio = AudioSegment.from_mp3(audio_io)
            elif audio_format.lower() == "wav":
                audio = AudioSegment.from_wav(audio_io)
            else:
                # Try auto-detection
                audio = AudioSegment.from_file(audio_io)
            
            # Convert to mono, 16kHz, 16-bit
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(target_sample_rate)
            audio = audio.set_sample_width(2)  # 16-bit
            
            # Export as raw PCM
            output_io = io.BytesIO()
            audio.export(output_io, format="wav")
            output_io.seek(0)
            
            # Skip WAV header (44 bytes) to get raw PCM
            wav_data = output_io.read()
            
            return wav_data, target_sample_rate
            
        except Exception as e:
            # If conversion fails, return original data
            # This might fail at API level, but we'll get a clearer error
            raise ValueError(f"Audio conversion failed: {e}") from e
    
    def _parse_duration(self, duration_str: str) -> float:
        """Parse duration string (e.g., '1.5s') to seconds.
        
        Args:
            duration_str: Duration string with 's' suffix.
            
        Returns:
            Duration in seconds.
        """
        if not duration_str:
            return 0.0
        return float(duration_str.rstrip("s"))
