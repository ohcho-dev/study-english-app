"""Google Cloud Speech-to-Text service.

This module provides STT functionality using Google Cloud Speech-to-Text API.
V1 REST API: legacy models (latest_long, latest_short, command_and_search, etc.)
V2 SDK: chirp_2, chirp_3 models with AutoDetectDecodingConfig, word confidence, phrase hints.

Supports audio format conversion and returns transcription with timing metadata.
"""

import asyncio
import base64
import io
import logging
import time
from typing import Any

import httpx
from pydub import AudioSegment

from app.core.config import settings

logger = logging.getLogger(__name__)

# V2 모델 목록 (V2 SDK 필요)
V2_MODELS = {"chirp_2", "chirp_3"}


class STTService:
    """Service for converting speech to text using Google Cloud STT.
    
    Supports both V1 REST API (legacy models) and V2 SDK (chirp models).
    The appropriate method is selected based on the model name.
    """
    
    API_URL = "https://speech.googleapis.com/v1/speech:recognize"
    
    # Model → Location mapping (different models are GA in different regions)
    MODEL_LOCATION_MAP: dict[str, str] = {
        "chirp_3": "us",            # GA in 'us' multi-region
        "chirp_2": "us-central1",   # GA in 'us-central1'
        "chirp": "us-central1",     # Legacy chirp
    }
    DEFAULT_V2_LOCATION = "us-central1"
    
    def __init__(self) -> None:
        """Initialize the STT service."""
        self.api_key = settings.GOOGLE_CLOUD_STT_TTS_API_KEY
        self._v2_clients: dict[str, Any] = {}  # Per-location client cache
    
    def _get_location_for_model(self, model: str) -> str:
        """Get the correct API location for a given model."""
        return self.MODEL_LOCATION_MAP.get(model, self.DEFAULT_V2_LOCATION)
    
    def _get_v2_client(self, model: str = "chirp_3"):
        """Get or create V2 SpeechClient for the correct location."""
        location = self._get_location_for_model(model)
        if location not in self._v2_clients:
            from google.cloud.speech_v2 import SpeechClient
            from google.api_core.client_options import ClientOptions
            self._v2_clients[location] = SpeechClient(
                client_options=ClientOptions(
                    api_endpoint=f"{location}-speech.googleapis.com",
                )
            )
        return self._v2_clients[location], location

    def _get_project_id(self) -> str:
        """Get GCP project ID from settings or environment."""
        project_id = settings.GOOGLE_CLOUD_PROJECT
        if not project_id:
            import os
            project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
        if not project_id:
            try:
                import google.auth
                _, project_id = google.auth.default()
            except Exception:
                pass
        if not project_id:
            raise ValueError(
                "GOOGLE_CLOUD_PROJECT not set. Required for V2 STT API (chirp models)."
            )
        return project_id

    # ================================================================
    # Smart Router — 모델에 따라 V1/V2 자동 선택
    # ================================================================

    async def smart_transcribe(
        self,
        audio_data: bytes,
        audio_format: str = "webm",
        language_code: str = "en-US",
        sample_rate_hertz: int = 16000,
        model: str = "chirp_3",
        phrase_hints: list[str] | None = None,
        enable_word_confidence: bool = False,
        profanity_filter: bool = False,
    ) -> dict[str, Any]:
        """Smart router: V2 API for chirp models, V1 REST for legacy models.
        
        Args:
            audio_data: Raw audio bytes.
            audio_format: Input audio format (webm, wav, mp3).
            language_code: Language code for recognition.
            sample_rate_hertz: Sample rate (used only for V1 fallback).
            model: STT model name.
            phrase_hints: Optional list of hint phrases for adaptation.
            enable_word_confidence: Return per-word confidence scores.
            profanity_filter: Filter profanity.
            
        Returns:
            Dict with transcript, confidence, words, duration_ms, processing_time_ms,
            and optionally word_confidences, recognition_api.
        """
        if model in V2_MODELS:
            return await self.transcribe_v2(
                audio_data=audio_data,
                audio_format=audio_format,
                language_code=language_code,
                model=model,
                phrase_hints=phrase_hints,
                enable_word_confidence=enable_word_confidence,
                profanity_filter=profanity_filter,
            )
        else:
            result = await self.transcribe(
                audio_data=audio_data,
                audio_format=audio_format,
                language_code=language_code,
                sample_rate_hertz=sample_rate_hertz,
                model=model,
            )
            result["recognition_api"] = "v1"
            return result

    # ================================================================
    # V2 SDK — chirp_2, chirp_3 (AutoDetectDecodingConfig)
    # ================================================================

    async def transcribe_v2(
        self,
        audio_data: bytes,
        audio_format: str = "webm",
        language_code: str = "en-US",
        model: str = "chirp_3",
        phrase_hints: list[str] | None = None,
        enable_word_confidence: bool = False,
        profanity_filter: bool = False,
    ) -> dict[str, Any]:
        """Transcribe audio using V2 SDK with chirp models.
        
        Uses AutoDetectDecodingConfig — no manual audio conversion needed.
        
        Args:
            audio_data: Raw audio bytes (any supported format).
            audio_format: Input format (informational, auto-detected by API).
            language_code: Language code.
            model: V2 model (chirp_2, chirp_3).
            phrase_hints: Boost recognition of specific phrases.
            enable_word_confidence: Per-word confidence scores.
            profanity_filter: Filter profanity in results.
            
        Returns:
            Dict with transcript, confidence, words, word_confidences,
            duration_ms, processing_time_ms, recognition_api.
        """
        from google.cloud.speech_v2.types import cloud_speech

        start_time = time.time()
        
        project_id = self._get_project_id()
        client, location = self._get_v2_client(model)

        # Build recognition config
        features = cloud_speech.RecognitionFeatures(
            enable_word_time_offsets=True,
            enable_word_confidence=enable_word_confidence,
            profanity_filter=profanity_filter,
        )

        # Build adaptation (phrase hints)
        adaptation = None
        if phrase_hints:
            adaptation = cloud_speech.SpeechAdaptation(
                phrase_sets=[
                    cloud_speech.SpeechAdaptation.AdaptationPhraseSet(
                        inline_phrase_set=cloud_speech.PhraseSet(
                            phrases=[{"value": h} for h in phrase_hints]
                        )
                    )
                ]
            )

        config = cloud_speech.RecognitionConfig(
            auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
            language_codes=[language_code],
            model=model,
            features=features,
            adaptation=adaptation,
        )

        request = cloud_speech.RecognizeRequest(
            recognizer=f"projects/{project_id}/locations/{location}/recognizers/_",
            config=config,
            content=audio_data,
        )

        # Run sync SDK call in executor
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.recognize(request=request),
            )
        except Exception as e:
            logger.error(f"V2 STT ({model}) recognition failed: {e}", exc_info=True)
            raise

        processing_time_ms = int((time.time() - start_time) * 1000)

        # Parse V2 response
        if not response.results:
            return {
                "transcript": "",
                "confidence": 0.0,
                "words": [],
                "word_confidences": [],
                "duration_ms": 0,
                "processing_time_ms": processing_time_ms,
                "recognition_api": "v2",
            }

        transcript_parts = []
        total_confidence = 0.0
        words = []
        word_confidences = []
        num_results = len(response.results)

        for result in response.results:
            if not result.alternatives:
                continue
            alt = result.alternatives[0]
            seg_text = alt.transcript
            if seg_text:
                transcript_parts.append(seg_text.strip())
            total_confidence += alt.confidence

            for w in alt.words:
                word_entry = {
                    "word": w.word,
                    "start_time": w.start_offset.total_seconds() if w.start_offset else 0.0,
                    "end_time": w.end_offset.total_seconds() if w.end_offset else 0.0,
                }
                words.append(word_entry)
                if enable_word_confidence:
                    word_confidences.append({
                        "word": w.word,
                        "confidence": w.confidence,
                    })

        transcript = " ".join(transcript_parts)
        confidence = total_confidence / num_results if num_results > 0 else 0.0

        duration_ms = 0
        if words:
            duration_ms = int(words[-1]["end_time"] * 1000)

        logger.info(
            f"V2 STT: model={model}, confidence={confidence:.3f}, "
            f"words={len(words)}, processing={processing_time_ms}ms"
        )

        return {
            "transcript": transcript,
            "confidence": confidence,
            "words": words,
            "word_confidences": word_confidences if enable_word_confidence else [],
            "duration_ms": duration_ms,
            "processing_time_ms": processing_time_ms,
            "recognition_api": "v2",
        }

    # ================================================================
    # V1 REST API — legacy models (unchanged)
    # ================================================================

    async def transcribe(
        self,
        audio_data: bytes,
        audio_format: str = "webm",
        language_code: str = "en-US",
        sample_rate_hertz: int = 16000,
        model: str = "latest_long",
    ) -> dict[str, Any]:
        """Convert speech audio to text using V1 REST API.
        
        Args:
            audio_data: Raw audio bytes.
            audio_format: Input audio format (webm, wav, mp3, etc.).
            language_code: Language code for speech recognition.
            sample_rate_hertz: Sample rate of the audio.
            model: V1 model name.
            
        Returns:
            Dictionary containing transcript, confidence, words,
            duration_ms, processing_time_ms.
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
                logger.warning(f"WebM direct upload failed: {e}. Falling back to converted WAV.")
                result = None

        # Fallback: Convert audio to Linear16 WAV if WebM failed or format is not WebM
        if not result:
            audio_content, actual_sample_rate = await self._prepare_audio(
                audio_data,
                audio_format,
                sample_rate_hertz,
            )
            
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
                "recognition_api": "v1",
            }
        
        # Combine ALL result segments.
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
            
            for word_info in alternative.get("words", []):
                words.append({
                    "word": word_info.get("word", ""),
                    "start_time": self._parse_duration(word_info.get("startTime", "0s")),
                    "end_time": self._parse_duration(word_info.get("endTime", "0s")),
                })
        
        transcript = " ".join(transcript_parts)
        confidence = total_confidence / num_results if num_results > 0 else 0.0
        
        duration_ms = 0
        if words:
            duration_ms = int(words[-1]["end_time"] * 1000)
        
        return {
            "transcript": transcript,
            "confidence": confidence,
            "words": words,
            "duration_ms": duration_ms,
            "processing_time_ms": processing_time_ms,
            "recognition_api": "v1",
        }
    
    async def _prepare_audio(
        self,
        audio_data: bytes,
        audio_format: str,
        target_sample_rate: int = 16000,
    ) -> tuple[bytes, int]:
        """Convert audio to Linear16 WAV format (V1 fallback)."""
        try:
            audio_io = io.BytesIO(audio_data)
            
            if audio_format.lower() in ("webm", "opus", "ogg"):
                audio = AudioSegment.from_file(audio_io, format="webm")
            elif audio_format.lower() == "mp3":
                audio = AudioSegment.from_mp3(audio_io)
            elif audio_format.lower() == "wav":
                audio = AudioSegment.from_wav(audio_io)
            else:
                audio = AudioSegment.from_file(audio_io)
            
            audio = audio.set_channels(1)
            audio = audio.set_frame_rate(target_sample_rate)
            audio = audio.set_sample_width(2)  # 16-bit
            
            output_io = io.BytesIO()
            audio.export(output_io, format="wav")
            output_io.seek(0)
            wav_data = output_io.read()
            
            return wav_data, target_sample_rate
            
        except Exception as e:
            raise ValueError(f"Audio conversion failed: {e}") from e
    
    def _parse_duration(self, duration_str: str) -> float:
        """Parse duration string (e.g., '1.5s') to seconds."""
        if not duration_str:
            return 0.0
        return float(duration_str.rstrip("s"))


# ================================================================
# WER / CER 정확도 유틸리티
# ================================================================

def calculate_accuracy(
    hypothesis: str,
    reference: str,
) -> dict[str, float | None]:
    """Calculate WER and CER between hypothesis and reference texts.
    
    Args:
        hypothesis: STT output text.
        reference: Ground truth text.
        
    Returns:
        Dict with wer and cer values (0.0~1.0+), or None if reference is empty.
    """
    if not reference or not reference.strip():
        return {"wer": None, "cer": None}
    
    try:
        import jiwer
        import re
        
        # Normalize texts manually (jiwer 4.x changed transform API)
        def normalize(text: str) -> str:
            text = text.lower().strip()
            text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
            text = re.sub(r'\s+', ' ', text).strip()  # Multiple spaces
            return text
        
        ref_norm = normalize(reference)
        hyp_norm = normalize(hypothesis)
        
        if not ref_norm:
            return {"wer": None, "cer": None}
        
        wer_val = jiwer.wer(ref_norm, hyp_norm)
        cer_val = jiwer.cer(ref_norm, hyp_norm)
        
        return {"wer": round(wer_val, 4), "cer": round(cer_val, 4)}
    except Exception as e:
        logger.warning(f"WER/CER calculation failed: {e}")
        return {"wer": None, "cer": None}

