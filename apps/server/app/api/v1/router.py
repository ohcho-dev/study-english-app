"""API v1 main router."""

import logging
from fastapi import APIRouter
from pydantic import BaseModel

from app.api.v1 import admin, ai_lab, analytics, audio, auth, conversations, logs, prompts, scenarios, themes, variables

logger = logging.getLogger(__name__)

router = APIRouter()

# Include sub-routers
router.include_router(variables.router)
router.include_router(prompts.router)
router.include_router(scenarios.router)
router.include_router(logs.router)
router.include_router(analytics.router)
router.include_router(themes.router)
router.include_router(ai_lab.router)
router.include_router(conversations.router)
router.include_router(audio.router)
router.include_router(auth.router)
router.include_router(admin.router)


# ============================================================================
# Translation Endpoint (used by TranscriptTimeline)
# ============================================================================

class TranslateRequest(BaseModel):
    text: str
    target_language: str = "ko"

@router.post("/translate")
async def translate_text(request: TranslateRequest):
    """Translate text using Google Cloud Translation API."""
    try:
        from google.cloud import translate_v2 as translate
        
        client = translate.Client()
        
        result = client.translate(
            request.text,
            target_language=request.target_language,
            format_="text",
        )
        
        translated = result["translatedText"]
        logger.info(f"Translation: '{request.text[:50]}' -> '{translated[:50]}'")
        return {"translated_text": translated}
        
    except Exception as e:
        logger.error(f"Translation error: {e}", exc_info=True)
        return {"translated_text": request.text, "error": str(e)}

