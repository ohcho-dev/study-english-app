"""Streaming STT Service — gRPC streaming recognition via Google Cloud Speech V2.

Manages streaming recognition sessions that receive audio chunks
and yield interim/final transcription results in real-time.
"""

import asyncio
import logging
import time
from typing import Any, AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)


class StreamingSTTSession:
    """A single streaming recognition session.
    
    Usage:
        session = StreamingSTTSession(model="chirp_3")
        async for result in session.stream(audio_chunk_generator):
            print(result)
    """
    
    # Model → Location mapping
    MODEL_LOCATION_MAP: dict[str, str] = {
        "chirp_3": "us",
        "chirp_2": "us-central1",
        "chirp": "us-central1",
    }
    DEFAULT_V2_LOCATION = "us-central1"
    
    def __init__(
        self,
        model: str = "chirp_3",
        language_code: str = "en-US",
        interim_results: bool = True,
        speech_end_timeout_sec: float = 5.0,
        phrase_hints: list[str] | None = None,
        enable_word_confidence: bool = False,
        sample_rate: int = 48000,
    ):
        self.model = model
        self.language_code = language_code
        self.interim_results = interim_results
        self.speech_end_timeout_sec = speech_end_timeout_sec
        self.phrase_hints = phrase_hints
        self.enable_word_confidence = enable_word_confidence
        self.sample_rate = sample_rate
        
        self._client = None
        self._location = self.MODEL_LOCATION_MAP.get(model, self.DEFAULT_V2_LOCATION)
        self._start_time: float = 0
        self._ttfr_ms: int | None = None  # Time to first result
        self._interim_count: int = 0
    
    def _get_project_id(self) -> str:
        """Get GCP project ID."""
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
            raise ValueError("GOOGLE_CLOUD_PROJECT not set.")
        return project_id
    
    def _get_client(self):
        """Lazy-init V2 SpeechClient for the correct location."""
        if self._client is None:
            from google.cloud.speech_v2 import SpeechClient
            from google.api_core.client_options import ClientOptions
            self._client = SpeechClient(
                client_options=ClientOptions(
                    api_endpoint=f"{self._location}-speech.googleapis.com",
                )
            )
        return self._client
    
    def _build_streaming_config(self):
        """Build StreamingRecognitionConfig."""
        from google.cloud.speech_v2.types import cloud_speech
        
        features = cloud_speech.RecognitionFeatures(
            # chirp_3 does NOT support word timestamps in streaming mode
            enable_word_time_offsets=(self.model != "chirp_3"),
            enable_word_confidence=self.enable_word_confidence and (self.model != "chirp_3"),
        )
        
        adaptation = None
        if self.phrase_hints:
            adaptation = cloud_speech.SpeechAdaptation(
                phrase_sets=[
                    cloud_speech.SpeechAdaptation.AdaptationPhraseSet(
                        inline_phrase_set=cloud_speech.PhraseSet(
                            phrases=[{"value": h} for h in self.phrase_hints]
                        )
                    )
                ]
            )
        
        config = cloud_speech.RecognitionConfig(
            explicit_decoding_config=cloud_speech.ExplicitDecodingConfig(
                encoding=cloud_speech.ExplicitDecodingConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=self.sample_rate,
                audio_channel_count=1,
            ),
            language_codes=[self.language_code],
            model=self.model,
            features=features,
            adaptation=adaptation,
        )
        
        streaming_features = cloud_speech.StreamingRecognitionFeatures(
            interim_results=self.interim_results,
            # NOTE: voice_activity_timeout removed intentionally.
            # With it set, Google STT V2 terminates the gRPC stream after
            # the first is_final (speech end detected), preventing multi-utterance
            # recognition. Without it, the stream stays open for consecutive
            # utterances until audio flow ends (client stop signal).
        )
        
        return cloud_speech.StreamingRecognitionConfig(
            config=config,
            streaming_features=streaming_features,
        )
    
    async def stream(
        self,
        audio_chunks: AsyncGenerator[bytes, None],
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Stream audio chunks and yield recognition results.
        
        Architecture: 
            - feed_chunks (async task): WebSocket → sync Queue
            - run_streaming (executor thread): sync Queue → gRPC → asyncio.Queue
            - stream() (async generator): asyncio.Queue → caller
        
        This avoids blocking the event loop with sync gRPC iteration.
        """
        from google.cloud.speech_v2.types import cloud_speech
        import queue as queue_mod
        
        self._start_time = time.time()
        self._ttfr_ms = None
        self._interim_count = 0
        
        project_id = self._get_project_id()
        client = self._get_client()
        streaming_config = self._build_streaming_config()
        
        # Sync queue: async feed_chunks → sync request_generator (in executor)
        chunk_queue: queue_mod.Queue[bytes | None] = queue_mod.Queue()
        done_flag = False
        
        # Async queue: sync run_streaming (in executor) → async stream() caller
        result_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        loop = asyncio.get_event_loop()
        
        def request_generator():
            """Sync generator consumed by gRPC in the executor thread."""
            yield cloud_speech.StreamingRecognizeRequest(
                recognizer=f"projects/{project_id}/locations/{self._location}/recognizers/_",
                streaming_config=streaming_config,
            )
            logger.info("Streaming STT: config sent, waiting for audio chunks...")
            chunk_count = 0
            while True:
                try:
                    chunk = chunk_queue.get(timeout=2.0)
                    if chunk is None:
                        logger.info(f"Streaming STT: end sentinel after {chunk_count} chunks")
                        break
                    chunk_count += 1
                    if chunk_count == 1:
                        logger.info(f"Streaming STT: first chunk to gRPC ({len(chunk)} bytes)")
                    yield cloud_speech.StreamingRecognizeRequest(audio=chunk)
                except queue_mod.Empty:
                    if done_flag:
                        logger.info(f"Streaming STT: done flag after {chunk_count} chunks")
                        break
        
        def run_streaming():
            """Runs ENTIRELY in executor thread: sends audio to gRPC, reads responses."""
            try:
                logger.info(f"Streaming STT: starting gRPC (model={self.model}, location={self._location})")
                responses = client.streaming_recognize(requests=request_generator())
                
                for response in responses:
                    for result in response.results:
                        if not result.alternatives:
                            continue
                        
                        alt = result.alternatives[0]
                        now = time.time()
                        
                        if self._ttfr_ms is None:
                            self._ttfr_ms = int((now - self._start_time) * 1000)
                        
                        if result.is_final:
                            words = []
                            if self.enable_word_confidence and (self.model != "chirp_3"):
                                for w in alt.words:
                                    words.append({
                                        "word": w.word,
                                        "confidence": w.confidence,
                                        "start_time": w.start_offset.total_seconds() if w.start_offset else 0.0,
                                        "end_time": w.end_offset.total_seconds() if w.end_offset else 0.0,
                                    })
                            
                            parsed = {
                                "type": "final",
                                "transcript": alt.transcript,
                                "confidence": alt.confidence,
                                "is_final": True,
                                "ttfr_ms": self._ttfr_ms,
                                "interim_count": self._interim_count,
                                "words": words,
                                "processing_ms": int((now - self._start_time) * 1000),
                                "speech_end_method": "vad",
                                "server_final_timestamp_ms": int(now * 1000),
                            }
                        else:
                            self._interim_count += 1
                            parsed = {
                                "type": "interim",
                                "transcript": alt.transcript,
                                "is_final": False,
                                "ttfr_ms": self._ttfr_ms,
                                "interim_count": self._interim_count,
                            }
                        
                        # Push result to async queue (thread-safe)
                        asyncio.run_coroutine_threadsafe(result_queue.put(parsed), loop)
                        logger.info(f"Streaming STT: {parsed['type']} result: {alt.transcript[:50]}")
                        
            except Exception as e:
                logger.error(f"Streaming STT error: {e}", exc_info=True)
                asyncio.run_coroutine_threadsafe(
                    result_queue.put({"type": "error", "error": str(e), "is_final": True}),
                    loop,
                )
            finally:
                # Signal end of results
                asyncio.run_coroutine_threadsafe(result_queue.put(None), loop)
        
        # Feed WebSocket audio chunks into sync queue (runs in event loop)
        async def feed_chunks():
            chunk_count = 0
            try:
                async for chunk in audio_chunks:
                    chunk_count += 1
                    chunk_queue.put(chunk)
                logger.info(f"Streaming STT: feed_chunks done, {chunk_count} chunks")
                chunk_queue.put(None)  # Sentinel
            except Exception as e:
                logger.error(f"Error feeding audio chunks: {e}")
                chunk_queue.put(None)
        
        feed_task = asyncio.create_task(feed_chunks())
        
        # Start gRPC streaming in executor thread (non-blocking)
        executor_future = loop.run_in_executor(None, run_streaming)
        
        try:
            # Yield results from async queue (non-blocking event loop)
            while True:
                result = await result_queue.get()
                if result is None:
                    break
                yield result
                if result.get("is_final"):
                    break
        finally:
            done_flag = True
            feed_task.cancel()
            # Don't await executor_future — let it clean up on its own
    
    @property
    def ttfr_ms(self) -> int | None:
        """Time to first result in ms."""
        return self._ttfr_ms
    
    @property
    def interim_count(self) -> int:
        """Number of interim results received."""
        return self._interim_count
