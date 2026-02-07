"""Model registry - AI model configuration and cost calculation."""

from app.schemas.ai_lab import ModelInfo


# Model pricing (USD per 1M tokens) - Updated for 2026 estimates
MODEL_REGISTRY: dict[str, ModelInfo] = {
    # ========================================================================
    # Gemini 3 (Latest - Preview)
    # ========================================================================
    "gemini-3-pro-preview": ModelInfo(
        id="gemini-3-pro-preview",
        name="Gemini 3 Pro (Preview)",
        provider="google",
        input_price_per_1m=2.50,
        output_price_per_1m=10.00,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="최신 Gemini 3 Pro 모델. 복잡한 추론과 멀티모달 분석에 최적화.",
        use_cases=["복잡한 분석", "문서 이해", "코드 생성", "이미지/동영상 분석"],
        max_context_tokens=2_000_000,
    ),
    "gemini-3-flash-preview": ModelInfo(
        id="gemini-3-flash-preview",
        name="Gemini 3 Flash (Preview)",
        provider="google",
        input_price_per_1m=0.15,
        output_price_per_1m=0.60,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="빠르고 저렴한 Gemini 3 모델. 일반적인 파이프라인 실험에 추천.",
        use_cases=["빠른 응답", "대량 처리", "간단한 분석", "멀티모달 입력"],
        max_context_tokens=1_000_000,
    ),
    
    # ========================================================================
    # Gemini 2.5
    # ========================================================================
    "gemini-2.5-pro": ModelInfo(
        id="gemini-2.5-pro",
        name="Gemini 2.5 Pro",
        provider="google",
        input_price_per_1m=1.50,
        output_price_per_1m=6.00,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="안정적인 프로덕션용 Pro 모델. 정확도 높은 분석에 적합.",
        use_cases=["프로덕션 배포", "정확한 피드백", "긴 문맥 처리"],
        max_context_tokens=2_000_000,
    ),
    "gemini-2.5-flash": ModelInfo(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider="google",
        input_price_per_1m=0.10,
        output_price_per_1m=0.40,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="범용 실험용 모델. 속도와 비용 효율성의 균형.",
        use_cases=["일반 실험", "파이프라인 테스트", "학습자 발화 분석"],
        max_context_tokens=1_000_000,
    ),
    
    # ========================================================================
    # Gemini 2.0
    # ========================================================================
    "gemini-2.0-flash": ModelInfo(
        id="gemini-2.0-flash",
        name="Gemini 2.0 Flash",
        provider="google",
        input_price_per_1m=0.10,
        output_price_per_1m=0.40,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="이전 세대 Flash 모델. 레거시 호환용.",
        use_cases=["기존 파이프라인 호환", "비용 절감"],
        max_context_tokens=1_000_000,
    ),
    
    # ========================================================================
    # Gemini TTS (Text-to-Speech)
    # ========================================================================
    "gemini-2.5-flash-preview-tts": ModelInfo(
        id="gemini-2.5-flash-preview-tts",
        name="Gemini 2.5 Flash TTS",
        provider="google",
        input_price_per_1m=0.05,
        output_price_per_1m=0.20,
        supports_multimodal=False,
        supports_audio_input=False,
        supports_audio_output=True,
        category="tts",
        description="텍스트 → 음성 변환 전용. 5가지 음성 지원 (Kore, Aoede, Puck, Charon, Fenrir).",
        use_cases=["피드백 음성화", "오디오 콘텐츠 생성"],
    ),
    "gemini-2.5-pro-preview-tts": ModelInfo(
        id="gemini-2.5-pro-preview-tts",
        name="Gemini 2.5 Pro TTS",
        provider="google",
        input_price_per_1m=0.10,
        output_price_per_1m=0.40,
        supports_multimodal=False,
        supports_audio_input=False,
        supports_audio_output=True,
        category="tts",
        description="고품질 TTS 모델. 더 자연스러운 음성 생성.",
        use_cases=["프리미엄 음성 콘텐츠", "발표용 오디오"],
    ),
    
    # ========================================================================
    # Gemini Native Audio (Bidirectional Audio)
    # ========================================================================
    "gemini-2.5-flash-preview-native-audio": ModelInfo(
        id="gemini-2.5-flash-preview-native-audio",
        name="Gemini 2.5 Flash Native Audio",
        provider="google",
        input_price_per_1m=0.10,
        output_price_per_1m=0.40,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=True,
        supports_native_audio=True,
        category="audio",
        description="양방향 오디오 모델. 음성 입력 분석 + 음성 출력 생성. 감정/억양 인식 가능.",
        use_cases=["학습자 발화 분석 + 음성 피드백", "대화형 AI", "실시간 음성 튜터"],
        max_context_tokens=1_000_000,
    ),
    
    # ========================================================================
    # OpenAI
    # ========================================================================
    "gpt-4o": ModelInfo(
        id="gpt-4o",
        name="GPT-4o",
        provider="openai",
        input_price_per_1m=5.00,
        output_price_per_1m=15.00,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="OpenAI의 최신 멀티모달 모델. 이미지/오디오 분석 지원.",
        use_cases=["멀티모달 분석", "복잡한 추론", "다국어 지원"],
        max_context_tokens=128_000,
    ),
    "gpt-4-turbo": ModelInfo(
        id="gpt-4-turbo",
        name="GPT-4 Turbo",
        provider="openai",
        input_price_per_1m=10.00,
        output_price_per_1m=30.00,
        supports_multimodal=True,
        supports_audio_input=False,
        supports_audio_output=False,
        category="general",
        description="GPT-4 고성능 버전. 긴 문맥과 정확한 지시 따르기에 최적화.",
        use_cases=["정밀한 분석", "긴 문서 처리", "복잡한 지시"],
        max_context_tokens=128_000,
    ),
}


def calculate_cost(
    model_name: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Calculate estimated cost for token usage.
    
    Args:
        model_name: Name of the AI model.
        input_tokens: Number of input tokens.
        output_tokens: Number of output tokens.
        
    Returns:
        Estimated cost in USD.
    """
    model = MODEL_REGISTRY.get(model_name)
    if not model:
        return 0.0
    
    input_cost = (input_tokens / 1_000_000) * model.input_price_per_1m
    output_cost = (output_tokens / 1_000_000) * model.output_price_per_1m
    
    return round(input_cost + output_cost, 6)


def calculate_tts_cost(
    model_name: str,
    char_count: int,
) -> float:
    """Calculate estimated cost for TTS generation (based on characters).
    
    Args:
        model_name: Name of the TTS model.
        char_count: Number of input characters.
        
    Returns:
        Estimated cost in USD.
    """
    # Default to flash-tts if unknown
    if model_name not in MODEL_REGISTRY:
        model_name = "gemini-2.5-flash-preview-tts"
        
    model = MODEL_REGISTRY.get(model_name)
    if not model or model.category != "tts":
        return 0.0
        
    # TTS pricing is usually per 1M characters (input_price_per_1m used for chars)
    cost = (char_count / 1_000_000) * model.input_price_per_1m
    
    return round(cost, 6)


def get_available_models() -> list[ModelInfo]:
    """Get list of all available models.
    
    Returns:
        List of model info objects.
    """
    return list(MODEL_REGISTRY.values())
