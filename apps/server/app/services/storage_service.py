"""Storage Service — 파일 저장 추상화 (로컬 디스크 / GCS)

사용법:
    from app.services.storage_service import storage

    url = await storage.upload_audio(audio_bytes, "my_file.mp3")
    # 로컬: "/static/audio/my_file.mp3"
    # GCS:  "https://storage.googleapis.com/bucket/audio/my_file.mp3"
"""

import logging
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# Local audio directory — must match FastAPI static mount in main.py
# main.py: Path(__file__).parent.parent / "static" → apps/server/static/
# This file: apps/server/app/services/storage_service.py
LOCAL_AUDIO_DIR = Path(__file__).parent.parent.parent / "static" / "audio"


class StorageService:
    """파일 저장을 추상화. GCS_BUCKET_NAME 설정 여부로 자동 전환."""

    def __init__(self) -> None:
        self._gcs_client = None
        self._bucket = None

    @property
    def use_gcs(self) -> bool:
        return bool(settings.GCS_BUCKET_NAME)

    def _get_bucket(self):
        """Lazy-init GCS bucket client."""
        if self._bucket is None:
            from google.cloud import storage as gcs
            self._gcs_client = gcs.Client()
            self._bucket = self._gcs_client.bucket(settings.GCS_BUCKET_NAME)
        return self._bucket

    async def upload_audio(self, audio_bytes: bytes, filename: str) -> str:
        """오디오 파일을 저장하고 URL을 반환.

        Args:
            audio_bytes: 오디오 바이너리 데이터.
            filename: 저장할 파일명 (예: "1234_abc.mp3").

        Returns:
            접근 가능한 URL.
            - 로컬: "/static/audio/filename"
            - GCS: "https://storage.googleapis.com/bucket/audio/filename"
        """
        if self.use_gcs:
            return await self._upload_to_gcs(audio_bytes, filename)
        else:
            return self._save_to_local(audio_bytes, filename)

    async def _upload_to_gcs(self, audio_bytes: bytes, filename: str) -> str:
        """GCS에 업로드 후 내부 경로 반환 (프록시를 통해 서빙)."""
        blob_path = f"audio/{filename}"
        bucket = self._get_bucket()
        blob = bucket.blob(blob_path)

        # Content-Type 추정
        content_type = "audio/mpeg"
        if filename.endswith(".wav"):
            content_type = "audio/wav"
        elif filename.endswith(".ogg"):
            content_type = "audio/ogg"

        blob.upload_from_string(audio_bytes, content_type=content_type)

        logger.info(f"[StorageService] Uploaded to GCS: {blob_path}")
        # 프록시 경로 반환 — /api/v1/audio/gcs/{blob_path}
        return f"/api/v1/audio/gcs/{blob_path}"

    async def get_gcs_audio(self, blob_path: str) -> tuple[bytes, str]:
        """GCS에서 오디오 파일을 읽어 반환."""
        bucket = self._get_bucket()
        blob = bucket.blob(blob_path)

        audio_bytes = blob.download_as_bytes()

        content_type = "audio/mpeg"
        if blob_path.endswith(".wav"):
            content_type = "audio/wav"
        elif blob_path.endswith(".ogg"):
            content_type = "audio/ogg"

        return audio_bytes, content_type

    def _save_to_local(self, audio_bytes: bytes, filename: str) -> str:
        """로컬 디스크에 저장."""
        LOCAL_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        filepath = LOCAL_AUDIO_DIR / filename
        filepath.write_bytes(audio_bytes)
        logger.info(f"[StorageService] Saved locally: {filepath}")
        return f"/static/audio/{filename}"


# 싱글톤 인스턴스 — import해서 바로 사용
storage = StorageService()
