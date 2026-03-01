"""Model registry - AI model configuration and cost calculation."""

from app.schemas.ai_lab import ModelInfo


# Model pricing (USD per 1M tokens) - Updated for 2026 estimates
MODEL_REGISTRY: dict[str, ModelInfo] = {
    # ========================================================================
    # Gemini 3 (Latest - Preview)
    # ========================================================================
    "gemini-3.1-pro-preview": ModelInfo(
        id="gemini-3.1-pro-preview",
        name="Gemini 3.1 Pro (Preview)",
        provider="google",
        input_price_per_1m=2.50,
        output_price_per_1m=10.00,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="최신 Gemini 3.1 Pro 프리뷰 모델. 복잡한 추론과 멀티모달 분석에 최적화.",
        use_cases=["복잡한 분석", "문서 이해", "코드 생성", "이미지/동영상 분석"],
        max_context_tokens=2_000_000,
        release_date="2026-02-19",
        deprecation_date=None,
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
        description="빠르고 저렴한 Gemini 3 Flash 모델.",
        use_cases=["빠른 응답", "대량 처리", "간단한 분석", "멀티모달 입력"],
        max_context_tokens=1_000_000,
        release_date="2025-12-17",
        deprecation_date=None,
    ),
    
    # ========================================================================
    # Gemini 2.5
    # ========================================================================
    "gemini-2.5-pro": ModelInfo(
        id="gemini-2.5-pro",
        name="Gemini 2.5 Pro (Deprecated: 2026-06-17)",
        provider="google",
        input_price_per_1m=1.50,
        output_price_per_1m=6.00,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="안정적인 프로덕션용 Pro 모델. (권장 교체: gemini-3.1-pro-preview)",
        use_cases=["프로덕션 배포", "정확한 피드백", "긴 문맥 처리"],
        max_context_tokens=2_000_000,
        release_date="2025-06-17",
        deprecation_date="2026-06-17",
    ),
    "gemini-2.5-flash": ModelInfo(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash (Deprecated: 2026-06-17)",
        provider="google",
        input_price_per_1m=0.10,
        output_price_per_1m=0.40,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="범용 실험용 모델. (권장 교체: gemini-3-flash-preview)",
        use_cases=["일반 실험", "파이프라인 테스트", "학습자 발화 분석"],
        max_context_tokens=1_000_000,
        release_date="2025-06-17",
        deprecation_date="2026-06-17",
    ),
    "gemini-2.5-flash-lite": ModelInfo(
        id="gemini-2.5-flash-lite",
        name="Gemini 2.5 Flash-Lite (Deprecated: 2026-07-22)",
        provider="google",
        input_price_per_1m=0.075,
        output_price_per_1m=0.30,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="경량화된 Gemini 2.5 모델.",
        use_cases=["대량 트래픽 처리", "단순 응답"],
        max_context_tokens=1_000_000,
        release_date="2025-07-22",
        deprecation_date="2026-07-22",
    ),
    
    # ========================================================================
    # Gemini 2.0 (Deprecated Soon)
    # ========================================================================
    "gemini-2.0-flash": ModelInfo(
        id="gemini-2.0-flash",
        name="Gemini 2.0 Flash (Deprecated: 2026-06-01)",
        provider="google",
        input_price_per_1m=0.10,
        output_price_per_1m=0.40,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="Gemini 2.0 주력 모델. (권장 교체: gemini-2.5-flash)",
        use_cases=["범용 작업", "실시간 처리"],
        max_context_tokens=1_000_000,
        release_date="2025-02-05",
        deprecation_date="2026-06-01",
    ),
    "gemini-2.0-flash-lite": ModelInfo(
        id="gemini-2.0-flash-lite",
        name="Gemini 2.0 Flash-Lite (Deprecated: 2026-06-01)",
        provider="google",
        input_price_per_1m=0.075,
        output_price_per_1m=0.30,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="경량화된 Gemini 2.0 모델. (권장 교체: gemini-2.5-flash-lite)",
        use_cases=["대량 트래픽 처리", "간단한 분류"],
        max_context_tokens=1_000_000,
        release_date="2025-02-25",
        deprecation_date="2026-06-01",
    ),

    
    # ========================================================================
    # Gemini 1.5
    # ========================================================================
    "gemini-1.5-pro": ModelInfo(
        id="gemini-1.5-pro",
        name="Gemini 1.5 Pro",
        provider="google",
        input_price_per_1m=1.25,
        output_price_per_1m=5.00,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="대부분의 작업에 준수한 성능을 보여주는 구세대 Pro.",
        use_cases=["일반 추론"],
        max_context_tokens=2_000_000,
    ),
    "gemini-1.5-flash": ModelInfo(
        id="gemini-1.5-flash",
        name="Gemini 1.5 Flash",
        provider="google",
        input_price_per_1m=0.075,
        output_price_per_1m=0.30,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="기본적인 텍스트 및 멀티모달 처리를 저비용으로 해결.",
        use_cases=["비용 절감", "빠른 테스트"],
        max_context_tokens=1_000_000,
    ),
    "gemini-1.5-flash-8b": ModelInfo(
        id="gemini-1.5-flash-8b",
        name="Gemini 1.5 Flash-8B",
        provider="google",
        input_price_per_1m=0.0375,
        output_price_per_1m=0.15,
        supports_multimodal=True,
        supports_audio_input=True,
        supports_audio_output=False,
        category="general",
        description="매우 가벼운 8B 파라미터 기반 Flash 모델. 가장 저렴함.",
        use_cases=["프론트엔드 기본", "단순 응답"],
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
    )
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
