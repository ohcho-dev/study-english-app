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
    """Translate text using Gemini API."""
    try:
        from google import genai
        from app.core.config import settings
        
        api_key = settings.GOOGLE_AI_API_KEY
        if not api_key:
            return {"translated_text": request.text, "error": "No API key configured"}
        
        client = genai.Client(api_key=api_key)
        
        lang_names = {"ko": "한국어", "ja": "日本語", "zh": "中文", "es": "Español"}
        target_name = lang_names.get(request.target_language, request.target_language)
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"번역할 텍스트: \"{request.text}\"",
            config={
                "system_instruction": (
                    f"당신은 전문 번역가입니다. 입력받은 텍스트를 {target_name}로 정확하게 번역하세요. "
                    f"번역된 텍스트만 출력하세요. 따옴표, 설명, 원문은 절대 포함하지 마세요."
                ),
                "temperature": 0.1,
            }
        )
        
        translated = response.text.strip() if response.text else request.text
        # Strip any surrounding quotes the model might add
        if translated.startswith('"') and translated.endswith('"'):
            translated = translated[1:-1]
        if translated.startswith("'") and translated.endswith("'"):
            translated = translated[1:-1]
            
        logger.info(f"Translation: '{request.text[:50]}' -> '{translated[:50]}'")
        return {"translated_text": translated}
        
    except Exception as e:
        logger.error(f"Translation error: {e}", exc_info=True)
        return {"translated_text": request.text, "error": str(e)}
