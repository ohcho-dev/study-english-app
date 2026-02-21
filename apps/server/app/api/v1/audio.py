"""Audio proxy endpoint — GCS 비공개 버킷의 오디오를 서빙.

GCS에 저장된 오디오 파일을 서버를 통해 프록시로 전달합니다.
버킷은 비공개로 유지되며, 서버의 서비스 계정으로만 접근합니다.
"""

import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from app.services.storage_service import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["Audio"])


@router.get("/gcs/audio/{filename:path}")
async def proxy_gcs_audio(filename: str):
    """GCS에서 오디오 파일을 읽어 프록시로 전달."""
    blob_path = f"audio/{filename}"
    
    try:
        audio_bytes, content_type = await storage.get_gcs_audio(blob_path)
        return Response(
            content=audio_bytes,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=3600",
            },
        )
    except Exception as e:
        logger.error(f"[AudioProxy] Failed to fetch {blob_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audio file not found: {filename}",
        ) from e
