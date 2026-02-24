# Google Text-to-Speech 완전 가이드

> **작성일**: 2026-02-24 (가격 정보 검증일: 2026-02-24)  
> **대상**: 오디오/AI 도메인 처음 학습자  
> **목적**: Google의 TTS 시스템을 체계적으로 학습하고, 우리 서비스에 최적의 구성을 도출하기 위한 가이드

---

## 📖 기술 용어 사전

### 음성 합성 (TTS) 기본 개념

| 용어 | 영문 | 쉬운 설명 |
|------|------|----------|
| **TTS** | Text-to-Speech | 텍스트를 음성으로 변환하는 기술. "글을 읽어주는 AI" |
| **합성 음성** | Synthetic Voice | AI가 생성한 음성 (사람이 실제로 말한 것이 아님) |
| **프로소디** | Prosody | 억양, 리듬, 강세 등 말의 멜로디 |
| **SSML** | Speech Synthesis Markup Language | HTML처럼 **음성에 태그를 붙여 제어**하는 XML 기반 언어. 쉼, 음높이, 속도, 강조 등을 지정 |
| **pitch** | Pitch (음높이) | 목소리의 높낮이. 반음(semitone) 단위. +2.0 = 약간 높게 |
| **speaking rate** | Speaking Rate | 말하는 속도. 1.0 = 보통, 0.5 = 천천히, 2.0 = 두 배 빠르게 |
| **스트리밍 합성** | Streaming Synthesis | 전체 오디오를 한번에 받지 않고, 조각조각 받으면서 바로 재생 |
| **음성 클로닝** | Voice Cloning | 사람의 목소리 샘플(30초~5분)을 학습 → 그 목소리로 합성. Google은 미지원 |
| **VAD** | Voice Activity Detection | 음성 활동 감지. "지금 사람이 말하고 있는가?" 판단 |
| **토큰** | Token | AI가 텍스트를 처리하는 최소 단위. 영어 1단어 ≈ 1~2토큰 |

### AI 모델 관련 용어

| 용어 | 쉬운 설명 |
|------|----------|
| **WaveNet** | Google DeepMind가 만든 음성 생성 딥러닝 모델 (2016). 실제 음성 파형을 학습 |
| **USM** | Universal Speech Model. Google의 범용 음성 모델. 300개+ 언어 |
| **LLM** | 대규모 언어 모델. Gemini, ChatGPT 등의 기반 기술 |
| **GA** | General Availability. 정식 출시 (프로덕션 사용 가능) |
| **프리뷰** | 테스트 단계. 기능 변경/중단 가능 |

---

## 🔑 핵심 개념: Google의 TTS는 2가지 시스템이다

### 왜 2가지인가?

Google은 역사적으로 **전통적인 TTS API**를 오래 운영해왔고, 최근 **Gemini LLM에서 TTS 기능이 추가**되면서 2가지 시스템이 공존하게 되었습니다:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google의 TTS 시스템                           │
│                                                                 │
│  ① Google Cloud TTS (전통)         ② Gemini TTS (차세대)         │
│  ━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━━━        │
│  기반: 전용 TTS 엔진                기반: Gemini LLM에서 파생       │
│  역사: 2018년~ (WaveNet)           역사: 2025년~                  │
│                                                                 │
│  음성: en-US-Neural2-F             음성: Kore, Charon, Aoede     │
│        ko-KR-Wavenet-A                   (이름만, 코드 없음)      │
│        en-US-Chirp-HD-F                                         │
│                                                                 │
│  제어: SSML 태그                    제어: 자연어 프롬프트           │
│        (XML 마크업)                       + 마크업 태그            │
│                                         ("cheerful tone")       │
│                                         [sigh], [laughing] 등   │
│                                                                 │
│  모델: 음성 이름에 포함              모델: 별도 선택               │
│        (Neural2, WaveNet 등)             (flash, pro, lite)     │
└─────────────────────────────────────────────────────────────────┘
```

### 우리 앱 UI에서 보는 차이

| | Google Cloud TTS 선택 시 | Gemini TTS 선택 시 |
|---|---|---|
| **프로바이더** | "안정적이고 다양한 음성 지원" | "AI 기반 자연스러운 음성 생성" |
| **모델 선택** | ❌ 없음 (음성 이름에 포함) | ✅ 있음 (Flash / Pro / Lite) |
| **음성 선택** | `Olivia (여성, en-US)` | `Kore (여성 · 밝고 활기찬)` |
| **음성 이름 형태** | 코드형: `en-US-Neural2-F` | 이름형: `Kore` |
| **음성 제어** | SSML, pitch, speaking_rate | 자연어 프롬프트 |

---

## 🤔 SSML이란? LLM 출력을 바꿔야 하나?

### SSML 설명

SSML은 **HTML처럼 태그로 음성을 제어하는 언어**입니다:

```xml
<!-- 일반 텍스트 →  그냥 읽음 -->
Hello, how are you?

<!-- SSML →  세밀하게 제어 -->
<speak>
  Hello!
  <break time="500ms"/>           <!-- 0.5초 쉼 -->
  <prosody rate="slow" pitch="+2st">  <!-- 느리게, 약간 높은 목소리 -->
    How are you doing today?
  </prosody>
  <emphasis level="strong">That's great!</emphasis>  <!-- 강조 -->
</speak>
```

### 우리 서비스에서 SSML이 필요한가?

**현재: 필요 없습니다.** 왜냐하면:

| 방식 | 우리 서비스 사용 | 설명 |
|------|---------------|------|
| **Gemini TTS (메인)** | 자연어 프롬프트 | `"Speak in a cheerful tone"` → SSML 불필요 |
| **Google Cloud TTS (폴백)** | 평문 텍스트 | SSML 없이 `text=` 파라미터로 전달 |

**LLM 출력을 SSML로 바꿀 필요는 없습니다.** 현재 흐름:

```
LLM (Gemini) → 평문 텍스트 응답 → TTS에 전달
                "Hello! How are you?"
                                      ↓
                              Gemini TTS: text + style prompt로 합성
                              Cloud TTS: text만으로 합성
```

만약 SSML을 쓰고 싶다면: LLM에게 "SSML 형식으로 응답하라"고 프롬프트를 바꿔야 하지만, Gemini TTS의 자연어 프롬프트가 SSML보다 더 직관적이고 쉬우므로 **전환할 이유가 없습니다**.

---

## 📊 ① Google Cloud TTS 상세

### 음성 등급별 비교

| 음성 등급 | 출시 | 음질 | 가격 (100만 자) | 스트리밍 | 한국어 | SSML |
|----------|------|------|---------------|---------|--------|------|
| **Standard** | ~2018 | ⭐⭐ | **$4** | ❌ | ✅ 4개 | ✅ |
| **WaveNet** | 2018 | ⭐⭐⭐ | **$16** | ❌ | ✅ 4개 | ✅ |
| **Neural2** | 2022 | ⭐⭐⭐⭐ | **$16** | ❌ | ✅ 4개 | ✅ |
| **Studio** | 2023 | ⭐⭐⭐⭐ | **$160** | ❌ | ❌ | ✅ |
| **Chirp 3: HD** | 2024 | ⭐⭐⭐⭐⭐ | **$30** | ✅ | ✅ | 고급 |

> **무료 할당량**: 매월 Standard 400만 자, WaveNet/Neural2/Chirp HD 100만 자 무료

### 가격 체계: **글자 수 기반**

```
과금 단위: 문자(character) 수
최소 과금: 없음 (무료 할당량 초과 시부터)

예시: "Hello, how are you?" = 20자
      100만 자 = 약 5만 문장 (평균 20자일 경우)
```

### 커스텀 설정 (AudioConfig)

| 설정 | 범위 | 설명 | 기본값 | 우리 서비스 |
|------|------|------|--------|-----------|
| `speaking_rate` | 0.25 ~ 4.0 | 말하는 속도 | 1.0 | 감정에 따라 조절 |
| `pitch` | -20.0 ~ +20.0 | 음높이 (반음 단위) | 0.0 | 감정에 따라 조절 |
| `volume_gain_db` | -96.0 ~ +16.0 | 볼륨 (dB) | 0.0 | 미사용 |
| `audio_encoding` | MP3, LINEAR16, OGG_OPUS, MULAW, ALAW | 출력 형식 | LINEAR16 | ✅ MP3 |
| `sample_rate_hertz` | 모델별 상이 | 출력 샘플레이트 | 자동 | 자동 |
| `effects_profile_id` | 프리셋 목록 | 출력 장치 최적화 | 없음 | 미사용 |

#### 출력 장치 프로필 (effects_profile_id)

```python
audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3,
    effects_profile_id=[
        "handset-class-device",       # 스마트폰 스피커
        # "headphone-class-device",   # 헤드폰/이어폰
        # "small-bluetooth-speaker-class-device",  # 블루투스 스피커
        # "large-home-entertainment-class-device",  # 홈 스피커
    ],
)
```

#### 감정 기반 자동 조절 (우리 서비스 현재 구현)

```python
# my_turn_service.py에서 사용자 감정에 따라 TTS 파라미터를 조절
EMOTION_TTS_MAP = {
    "happy":      {"pitch": +1.0, "speaking_rate_adj": +0.1},
    "excited":    {"pitch": +2.0, "speaking_rate_adj": +0.15},
    "nervous":    {"pitch": -0.5, "speaking_rate_adj": -0.1},
    "frustrated": {"pitch": -1.0, "speaking_rate_adj": -0.05},
    "neutral":    {"pitch": 0.0,  "speaking_rate_adj": 0.0},
}
# Google Cloud TTS (폴백) 사용 시에만 적용
# Gemini TTS는 자연어 프롬프트로 감정 제어
```

### 사용 방법 (Python)

```python
from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient()

# === 방법 1: 일반 텍스트 ===
synthesis_input = texttospeech.SynthesisInput(
    text="Hello! How are you doing today?",
)

# === 방법 2: SSML (세밀한 제어가 필요할 때) ===
synthesis_input = texttospeech.SynthesisInput(
    ssml='<speak>Hello! <break time="300ms"/> How are you?</speak>',
)

# 음성 선택 — 이름에 모델 등급이 포함
voice = texttospeech.VoiceSelectionParams(
    language_code="en-US",
    name="en-US-Neural2-F",  # Neural2 등급, 여성 F
)

# 출력 설정
audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3,
    speaking_rate=1.0,
    pitch=0.0,
)

response = client.synthesize_speech(
    input=synthesis_input, voice=voice, audio_config=audio_config,
)
# response.audio_content → MP3 바이너리
```

---

## 📊 ② Gemini TTS 상세

### Gemini TTS란?

Gemini LLM(대규모 언어 모델)에서 **음성 출력 기능을 독립시킨 TTS 전용 모델**입니다. LLM의 언어 이해 능력을 기반으로 하기 때문에 **문맥을 이해하고 자연스러운 억양/감정을 표현**합니다.

### 모델 비교

| 모델 | 속도 | 품질 | 상태 | 추천 용도 |
|------|------|------|------|---------|
| `gemini-2.5-flash-tts` | 빠르고 효율적 | ⭐⭐⭐⭐⭐ | GA | **기본값** (UI에서 전체 선택 가능) |
| `gemini-2.5-pro-tts` | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | GA | 고품질 콘텐츠 |
| `gemini-2.5-flash-lite-preview-tts` | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 프리뷰 | 대량/저렴 |

### 가격 체계: **토큰 기반** (Cloud TTS와 다름!)

> ⚠️ **중요**: Gemini TTS의 가격 체계는 Cloud TTS(문자 수 기반)와 **완전히 다릅니다**.

```
Cloud TTS:  $16 / 100만 문자(character)
Gemini TTS: 입력 토큰 가격 + 출력 오디오 토큰 가격
```

| 모델 | 입력 (100만 텍스트 토큰) | 출력 (100만 오디오 토큰) | 비고 |
|------|----------------------|----------------------|------|
| `gemini-2.5-flash-tts` | **$0.50** | **$10.00** | 오디오 토큰 = 25토큰/초 |
| `gemini-2.5-pro-tts` | **$1.00** | **$20.00** | 2배 비쌈 |
| `gemini-2.5-flash-lite-preview-tts` | 프리뷰 무료~저가 | 프리뷰 무료~저가 | 확인 필요 |

#### 비용 환산 예시

```
"Hello, how are you doing today?" = 약 8 텍스트 토큰, 약 2초 오디오 = 50 오디오 토큰

Flash 모델 1회 합성 비용:
  입력: 8토큰 × ($0.50/1M) = $0.000004
  출력: 50토큰 × ($10/1M)  = $0.0005
  합계: ~$0.0005 (약 0.05센트)

하루 100명 × 5턴 × 평균 30자 응답:
  = 500회 × $0.0005 = $0.25/일 = ~$7.50/월

※ Cloud TTS API 경유 시 Cloud TTS 가격이 적용될 수 있음 (확인 필요)
```

> **참고**: Cloud TTS API 경유 시 가격 적용 방식이 달라질 수 있습니다. Google 공식 문서에서 최신 정보를 확인하세요.

### 음성 목록

| 음성 이름 | 성별 | 특징 |
|----------|------|------|
| **Kore** | 여성 | 밝고 활기찬 (✅ 현재 기본값) |
| **Aoede** | 여성 | 부드럽고 따뜻한 |
| **Puck** | 남성 | 자연스럽고 친근한 |
| **Charon** | 남성 | 차분하고 낮은 |
| **Fenrir** | 남성 | 또렷하고 강한 |
| **Leda** | 여성 | 전문적이고 명확한 |

### 사용 방법 — 2가지 API 경로

Gemini TTS를 호출하는 방법이 **2가지**입니다. 동일한 모델, 동일한 음성을 사용하지만 **API와 SDK가 다릅니다**:

#### 방법 A: Cloud TTS API 경유 (✅ 우리 서비스가 사용 중)

```python
from google.cloud import texttospeech  # 동일한 SDK!

client = texttospeech.TextToSpeechClient()

synthesis_input = texttospeech.SynthesisInput(
    text="Hello! How are you doing today?",
    prompt="Speak in a cheerful, warm, and upbeat tone.",  # ← Gemini만 가능
)

voice = texttospeech.VoiceSelectionParams(
    language_code="en-US",
    name="Kore",                           # ← Gemini 음성 이름
    model_name="gemini-2.5-flash-tts",     # ← Gemini 모델 지정
)

audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.MP3,
)

response = client.synthesize_speech(
    input=synthesis_input, voice=voice, audio_config=audio_config,
)
# response.audio_content → MP3 바이너리 (직접 사용 가능!)
```

#### 방법 B: Generative Language API 직접 호출

```python
from google import genai  # 다른 SDK!

client = genai.Client(api_key="YOUR_API_KEY")

response = client.models.generate_content(
    model="gemini-2.5-flash-tts",
    contents="Hello! How are you doing today?",
    config=genai.types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=genai.types.SpeechConfig(
            voice_config=genai.types.VoiceConfig(
                prebuilt_voice_config=genai.types.PrebuiltVoiceConfig(
                    voice_name="Kore",
                )
            )
        ),
    ),
)
# response → PCM 오디오 데이터 (MP3 변환 필요!)
```

#### 2가지 경로 비교

| 항목 | 방법 A: Cloud TTS API 경유 | 방법 B: Generative Language API |
|------|-------------------------|------------------------------|
| **SDK** | `google-cloud-texttospeech` | `google-genai` |
| **인증** | 서비스 계정 (Cloud Run 자동) | API 키 |
| **할당량** | **1,000 req/min** | 기본 할당량 (프로젝트별 상이) |
| **출력 형식** | ✅ MP3 직접 출력 | PCM (변환 필요) |
| **스트리밍** | ✅ 지원 | ✅ 지원 |
| **스타일 프롬프트** | ✅ `prompt=` 파라미터 | 텍스트에 직접 포함 |
| **안정성** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **우리 서비스** | ✅ **현재 사용 중** | ❌ 이전에 사용 → 전환함 |

> **왜 방법 A로 전환했나?**: 이전에 방법 B를 사용했지만, Cloud TTS API 경유(방법 A)로 전환하면서 할당량이 증가하고 MP3 직접 출력이 가능해졌습니다. 코드 주석에 `"1,000 req/min vs 10 req/min with genai SDK"` 라고 기록되어 있습니다.
>
> ⚠️ **10 req/min 수치에 대해**: 이 값은 코드 작성 당시의 기본 할당량이며, 프로젝트별 할당량은 Google Cloud Console에서 확인/증설 가능합니다. 실제 체감상 더 많이 호출되었을 수 있습니다.

### Gemini TTS 전용: 스타일 프롬프트

```python
# 감정별 프롬프트 (우리 서비스에서 실제 사용 중)
EMOTION_STYLE_PROMPTS = {
    "happy":     "Speak in a cheerful, warm, and upbeat tone.",
    "excited":   "Speak with enthusiasm and energy, as if sharing exciting news.",
    "nervous":   "Speak in a calm, reassuring, and gentle tone.",
    "confused":  "Speak slowly and clearly, in a patient and supportive way.",
    "frustrated":"Speak in a calm, empathetic, and understanding tone.",
    "shy":       "Speak in a soft, gentle, and encouraging way.",
    "neutral":   "Speak in a natural, friendly conversational tone.",
}
```

### Gemini TTS 전용: 마크업 태그

```python
# 비음성 소리
"[sigh] I don't know what to do."          # 한숨
"[laughing] That was hilarious!"           # 웃음
"[uhm] I think so."                        # 망설임

# 어조 변경
"[whispering] This is a secret."           # 속삭임
"[shouting] Watch out!"                    # 소리침
"[sarcasm] Oh, that's just great."         # 비꼬는 어조

# 속도/일시중지
"[extremely fast] Terms and conditions..." # 매우 빠르게
"Hello. [short pause] How are you?"        # 짧은 쉼
```

---

## 🔄 동기식 vs 스트리밍 TTS

### 차이

```
[동기식 - 현재]
텍스트 전체 → TTS API → ⏳ 전체 오디오 생성 → MP3 한 번에 전달 → 재생
                         ~1-2초 대기

[스트리밍]
텍스트 전체 → TTS API → 🔊 첫 조각 → 재생 시작!
                       → 🔊 다음 조각 → 이어서 재생
                       → 🔊 ...계속...
                         첫 소리까지 ~200ms
```

### 모델별 스트리밍 지원

| 모델 | 동기식 | 스트리밍 |
|------|--------|---------|
| Standard | ✅ | ❌ |
| WaveNet | ✅ | ❌ |
| Neural2 (✅ 현재 폴백) | ✅ | ❌ |
| Studio | ✅ | ❌ |
| **Chirp 3: HD** | ✅ | **✅** |
| **Gemini 2.5 Flash TTS** (✅ 현재 메인) | ✅ | **✅** |
| **Gemini 2.5 Pro TTS** | ✅ | **✅** |
| **Gemini 2.5 Flash Lite TTS** | ✅ | **✅** |

> **핵심**: 현재 사용 중인 Gemini Flash TTS는 이미 스트리밍을 지원합니다. **우리가 동기식으로 호출하고 있을 뿐**입니다. 코드 변경만으로 스트리밍 전환이 가능합니다.

### 스트리밍 전환 시 변경 사항

| 항목 | 동기식 (현재) | 스트리밍 |
|------|-------------|---------|
| **API 호출** | `synthesize_speech()` 1회 | `streaming_synthesize()` 스트림 |
| **결과 수신** | MP3 한 번에 | PCM/OGG_OPUS 조각 연속 |
| **출력 형식** | ✅ MP3 가능 | ⚠️ PCM 또는 OGG_OPUS (MP3 불가) |
| **클라이언트 전달** | HTTP 응답 1회 | WebSocket으로 chunk 푸시 |
| **재생 방식** | 파일 로드 후 재생 | Web Audio API로 실시간 재생 |
| **구현 복잡도** | 🟢 낮음 | 🟡 중간 |

---

## 💰 전체 가격 비교

### ① Google Cloud TTS — 문자 수 기반

| 음성 등급 | 가격 (100만 자) | 무료 할당량 | Gemini TTS 모델별 가격 차이 |
|----------|---------------|-----------|--------------------------|
| Standard | **$4** | 월 400만 자 | - |
| WaveNet | **$16** | 월 100만 자 | - |
| Neural2 | **$16** | 월 100만 자 | - |
| Studio | **$160** | 없음 | - |
| Chirp 3: HD | **$30** | 월 100만 자 | - |

### ② Gemini TTS — 토큰 기반

| 모델 | 입력 (100만 텍스트 토큰) | 출력 (100만 오디오 토큰) | Flash와 비교 |
|------|----------------------|----------------------|-------------|
| **Flash** | $0.50 | $10.00 | - |
| **Pro** | $1.00 | $20.00 | **2배** |
| **Flash Lite** | 프리뷰 가격 (저가) | 프리뷰 가격 (저가) | 더 저렴 |

> **답변: Gemini TTS 모델별 가격이 다른가?** → **네, 다릅니다.** Pro는 Flash의 2배입니다.
> Cloud TTS에서도 등급별 가격이 다릅니다 ($4 ~ $160).

### 비용 시뮬레이션 (월 기준)

가정: 일 100명 × 5턴 × 평균 30자 AI 응답 × 30일 = 약 **45만 자/월**

| 구성 | 월 비용 | 비고 |
|------|--------|------|
| Standard | **$0** | 400만 자 무료 이내 |
| Neural2 | **$0** | 100만 자 무료 이내 |
| **Gemini Flash TTS (현재)** | **~$3.50** | 토큰 기반 (무료 할당 후) |
| Gemini Pro TTS | **~$7.00** | Flash의 2배 |
| Chirp 3: HD | **~$13.50** | $30/M자, 무료 100만 자 |

> 현재 사용량에서는 어떤 모델을 써도 큰 비용은 아닙니다. 사용자가 크게 늘어야 유의미한 차이가 발생합니다.

---

## 🌏 한국에서의 사용 가능 여부

| 항목 | 사용 가능 | 비고 |
|------|----------|------|
| **Cloud TTS API** (Standard~Neural2) | ✅ | 글로벌 엔드포인트 |
| **Chirp 3: HD** | ✅ | 글로벌 |
| **Gemini TTS** (Cloud TTS 경유) | ✅ | 글로벌 |
| **한국어 TTS 음성** | ✅ | Cloud TTS: Standard, WaveNet, Neural2 |
| **결제** | ✅ | 한국 신용카드/계정 가능 |

### API 호출 지연 시간

Cloud Run은 **`us-central1`(미국)** 에 배포 (Gemini API 호환성 때문에 아시아 리전 불가).

| 구간 | 예상 지연 시간 |
|------|-------------|
| Cloud Run → TTS API (같은 미국 내) | **~50-100ms** |
| 한국 사용자 → Cloud Run (미국) | ~150-200ms |
| **사용자 체감 총 지연** | **~200-300ms** |

> ⚠️ 도쿄(`asia-northeast1`)로 옮기면 네트워크 지연은 줄지만, Gemini API가 해당 리전을 지원하지 않아 불가.

---

## 🆚 경쟁 TTS 서비스 비교

| 항목 | Google Cloud TTS | ElevenLabs | OpenAI TTS | Amazon Polly | Azure TTS |
|------|------------------|------------|------------|-------------|-----------|
| **최고 품질** | Gemini TTS | Multilingual v2 | tts-1-hd | Neural | Neural HD |
| **자연스러움** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **감정 제어** | ✅ 프롬프트 | ✅ 스타일 | ❌ | ❌ | ✅ SSML |
| **한국어** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **스트리밍** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **음성 클로닝** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **GCP 생태계** | ✅ | ❌ | ❌ | AWS | Azure |

**결론**: GCP 인프라 통합, 한국어, 가격, 안정성 → Google이 최적.

---

## 🏆 우리 서비스 현재 구성 & 개선 방향

### 현재 구성

```
AI 발화 텍스트
  │
  ├─ [기본값] Gemini TTS (Cloud TTS API 경유)
  │    모델:   gemini-2.5-flash-tts
  │    음성:   Kore (여성), Charon (남성) 등
  │    제어:   자연어 스타일 프롬프트
  │    출력:   MP3 (동기식)
  │    ⚠️ 문제: 레이턴시 ~800-2000ms (LLM 추론 경유)
  │
  └─ [폴백] Google Cloud TTS (Neural2)
       음성:   en-US-Neural2-F
       제어:   pitch/speaking_rate
       출력:   MP3 (동기식)
       ✅ 장점: 레이턴시 ~200-400ms
```

### ⚠️ 현재 문제: Gemini TTS 레이턴시

Gemini TTS는 **자연스러움은 최고**지만, LLM 추론을 거치기 때문에 **속도가 느립니다**:

| | Neural2 | Chirp 3: HD | Gemini Flash |
|---|---|---|---|
| **TTS 레이턴시** | **~200-400ms** | **~300-500ms** | **~800-2000ms** |
| **자연스러움** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **감정 표현** | △ pitch/rate | ○ 다양한 스타일 | ◎ 프롬프트 |
| **스트리밍** | ❌ | ✅ | ✅ |
| **비용** | $0 (무료 이내) | $0 (무료 이내) | ~$15/월 |

> **실시간 대화 서비스에서 1-2초 추가 대기는 UX에 큰 영향**을 줍니다. STT(~2초) + LLM(~1초) + TTS(~1-2초) = 전체 **4-5초 대기**. Neural2나 Chirp HD를 쓰면 TTS 구간을 0.5초 이하로 줄일 수 있습니다.

### 개선 방향: Latency Lab A/B 테스트 후 결정

지표 분석 결과(아래 섹션 참조)에 따르면:

| 순위 | 추천 | 이유 |
|------|------|------|
| 🥇 | **Neural2** | 가장 빠르고, 무료, 안정적 |
| 🥈 | **Chirp 3: HD** | Neural2 수준 속도 + 더 자연스러움 + 스트리밍 지원 |
| 🥉 | **Gemini Flash** | 자연스러움·감정 최고, 하지만 **속도 문제** |

**추천 전략:**
- **기본값을 Chirp 3: HD로 전환** (자연스러움 + 빠름 + 스트리밍 대비)
- **감정 표현이 중요한 시나리오에서만 Gemini Flash 선택적 사용**
- **Latency Lab에서 실제 측정 후 최종 결정**
- 폴백은 같은 시스템(Cloud TTS) 내에서 발생하도록 변경 (음성 변경 방지)

---

## 🔬 Latency Lab & My Turn 테스트 항목

### Latency Lab에서 측정해야 할 것

| 테스트 | 방법 | 목표 |
|--------|------|------|
| **Cloud TTS 모델 속도** | Neural2 vs WaveNet vs Chirp HD | 모델별 레이턴시 실측 |
| **Gemini TTS 모델 속도** | Flash vs Pro vs Lite | 모델별 레이턴시 실측 |
| **Cloud TTS vs Gemini TTS** | **Neural2/Chirp HD vs Gemini Flash** | ⭐ **핵심 비교: 속도 vs 자연스러움** |
| **스트리밍 vs 동기식** | Chirp HD 동기식 vs 스트리밍 | TTFR(첫 소리 도달) 측정 |
| **감정 프롬프트 효과** | 같은 텍스트, 다른 감정 | 차이 체감 |
| **전체 파이프라인** | STT + LLM + TTS 전체 | 병목 식별 |

---

## 🎭 다중 화자 관점: 파이프라인 비교 분석

### 우리 서비스의 다중 화자 구조

My Turn에서는 **1명의 사용자 + N명의 AI 참여자**가 대화합니다:

```
[My Turn 대화 예시: 카페 주문]

참여자 1 (AI 바리스타): "Welcome! What can I get for you?" → 음성 A
참여자 2 (사용자):       "I'd like a latte, please."       → STT 인식
참여자 3 (AI 손님):      "Oh, their latte is great!"       → 음성 B
참여자 1 (AI 바리스타): "Great choice! What size?"         → 음성 A

각 AI 참여자 = 고유한 목소리 + 고유한 성격
```

### 2가지 파이프라인 비교

#### 파이프라인 A: STT → LLM → TTS (현재)

```
사용자 음성
  ↓
[STT] 음성→텍스트 (chirp_3 추천)
  ↓
텍스트: "I'd like a latte, please."
  ↓
[LLM] 시나리오 디렉터가 다음 화자 결정 + 응답 생성
  ↓
텍스트: "Great choice! What size?"
  ↓
[TTS] 텍스트→음성 (화자별 다른 음성/모델 선택)
  ↓
오디오 → 클라이언트 재생
```

**다중 화자에서의 장점:**
- AI 참여자마다 **독립적으로 음성/모델을 선택** 가능
- 바리스타 = `Charon (남성, 차분)`, 손님 = `Kore (여성, 활발)` 등
- **Cloud TTS와 Gemini TTS를 참여자별로 혼합** 가능
- 중간 텍스트가 있어 **번역, 로깅, 발음 평가** 모두 가능

#### 파이프라인 B: Gemini Multimodal Live API

```
사용자 음성
  ↓
[Gemini 단일 모델] 음성 인식 + 사고 + 음성 생성을 한 번에
  ↓
오디오 → 클라이언트 재생
```

**다중 화자에서의 한계:**
- ⚠️ 한 세션 = 한 음성. **화자별 음성 변경이 제한적**
- ⚠️ 시나리오 디렉터(누가 다음에 말할지)를 시스템 프롬프트로만 제어
- ⚠️ 중간 텍스트 없이 발음 평가 어려움
- ✅ 다만 끼어들기(barge-in), 자연스러운 대화 흐름은 우수

### 상세 비교표

| 항목 | 파이프라인 A (STT→LLM→TTS) | 파이프라인 B (Multimodal Live) |
|------|--------------------------|------------------------------|
| **다중 화자 음성** | ✅ 참여자별 독립 선택 | ⚠️ 1세션 1음성 (화자별 세션 필요) |
| **화자별 감정 제어** | ✅ 각각 다른 프롬프트 | ⚠️ 시스템 프롬프트로만 |
| **시나리오 디렉터** | ✅ LLM에서 명시적 제어 | ⚠️ 프롬프트 기반 |
| **중간 텍스트 (번역)** | ✅ 확인 가능 | ⚠️ 별도 요청 |
| **단어별 confidence** | ✅ STT 제공 | ❌ 미지원 |
| **발음 평가** | ✅ word confidence 활용 | ❌ 어려움 |
| **레이턴시 (턴당)** | 🔴 ~3-5초 | 🟢 ~1-2초 |
| **끼어들기 (barge-in)** | ❌ 별도 구현 필요 | ✅ 기본 지원 |
| **자연스러운 흐름** | 🟡 턴 대기 느낌 | 🟢 실시간 대화 느낌 |
| **구현 복잡도** | 🟡 중간 (현재 동작 중) | 🔴 높음 (재구현 필요) |
| **안정성** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ (신규) |

---

## 💰 비용 시뮬레이션 (다중 화자 기준)

### 공통 가정

```
사용자 수:     일 100명
세션당 턴 수:  10턴 (사용자 5턴 + AI 5턴)
턴당 평균:     사용자 발화 5초, AI 응답 30자 (약 8 텍스트 토큰, 2초 오디오)
AI 참여자 수:  2명 (각각 다른 음성)
월 기준:       30일
```

**월간 총량:**
- STT 처리: 100명 × 5턴 × 5초 × 30일 = **12,500초 ≈ 209분/월**
- LLM 처리: 100명 × 5턴 × 30일 = **15,000회/월**
- TTS 처리: 100명 × 5턴 × 30자 × 30일 = **45만 자/월**, 약 12만 텍스트 토큰

---

### 파이프라인 A: STT → LLM → TTS

#### STT 비용 (공통)

| STT 모델 | 월 비용 | 비고 |
|----------|--------|------|
| V1 `latest_long` | $0.024 × 209 = **$5.02** | 현재 |
| V2 `chirp_3` | $0.016 × 209 = **$3.34** | 추천 |

#### LLM 비용 (공통, Gemini 2.5 Flash 기준)

```
15,000회 × 평균 500 입력토큰 × ($0.50/1M) = ~$3.75 입력
15,000회 × 평균 30 출력토큰 × ($0.60/1M) = ~$0.27 출력
LLM 합계: ~$4.02/월
```

#### TTS 비용 — 모델별 비교

##### ① Google Cloud TTS (문자 기반 과금)

| TTS 모델 | 가격 | 무료 할당 | 월 45만 자 비용 | 다중 화자 |
|----------|------|----------|---------------|----------|
| **Standard** | $4/M자 | 400만 자 | **$0** (무료 이내) | ✅ 음성 다양 |
| **WaveNet** | $16/M자 | 100만 자 | **$0** (무료 이내) | ✅ 음성 다양 |
| **Neural2** | $16/M자 | 100만 자 | **$0** (무료 이내) | ✅ 음성 다양 |
| **Studio** | $160/M자 | 없음 | **$72** | ❌ 영어만, 2명 |
| **Chirp 3: HD** | $30/M자 | 100만 자 | **$0** (무료 이내) | ✅ 30개 스타일 |

##### ② Gemini TTS (토큰 기반 과금)

| TTS 모델 | 입력 비용 | 출력 비용 | 월 합계 | 다중 화자 |
|----------|----------|----------|---------|----------|
| **Flash** | 12만 × $0.50/M = $0.06 | 150만오디오 × $10/M = $15 | **~$15** | ✅ 음성 6개+ |
| **Pro** | 12만 × $1.00/M = $0.12 | 150만오디오 × $20/M = $30 | **~$30** | ✅ 음성 6개+ |
| **Flash Lite** | 프리뷰 | 프리뷰 | **~$5** (추정) | ✅ 음성 6개+ |

> **오디오 토큰 계산**: 15,000회 × 2초 × 25토큰/초 × 2참여자 = 150만 오디오 토큰/월

---

### 파이프라인 B: Gemini Multimodal Live API

```
과금 체계: $0.005/세션 + $0.025/분 + 토큰비
```

| 항목 | 계산 | 비용 |
|------|------|------|
| **세션 수** | 100명 × 30일 = 3,000 세션 | 3,000 × $0.005 = **$15** |
| **활성 시간** | 3,000 세션 × 평균 5분 = 15,000분 | 15,000 × $0.025 = **$375** |
| **오디오 입력 토큰** | 사용자 발화 (5초 × 5턴 × 25토큰/초) = 625토큰/세션 | 3,000 × 625 × $1/M = **$1.88** |
| **오디오 출력 토큰** | AI 응답 (2초 × 5턴 × 25토큰/초) = 250토큰/세션 | 3,000 × 250 × $10/M = **$7.50** |
| **합계** | | **~$399/월** |

> ⚠️ **세션 기반 과금 + 분당 과금이 크다.** 특히 다중 화자에서 화자별 세션을 분리하면 비용이 더 증가합니다.

---

### 비용 총합 비교 (월, 100명/일 기준)

| 구성 | STT | LLM | TTS | **월 합계** |
|------|-----|-----|-----|-----------|
| **chirp_3 + Flash + Standard** | $3.34 | $4.02 | $0 | **$7.36** |
| **chirp_3 + Flash + Neural2** | $3.34 | $4.02 | $0 | **$7.36** |
| **chirp_3 + Flash + WaveNet** | $3.34 | $4.02 | $0 | **$7.36** |
| **chirp_3 + Flash + Chirp HD** | $3.34 | $4.02 | $0 | **$7.36** |
| **chirp_3 + Flash + Gemini Flash TTS** | $3.34 | $4.02 | $15 | **$22.36** |
| **chirp_3 + Flash + Gemini Pro TTS** | $3.34 | $4.02 | $30 | **$37.36** |
| **chirp_3 + Flash + Studio** | $3.34 | $4.02 | $72 | **$79.36** |
| **Multimodal Live API** | - | - | - | **~$399** |

> **핵심 발견**: 
> - Cloud TTS(Standard~Chirp HD)는 월 무료 할당량 이내! → **TTS 비용 $0**
> - Gemini TTS는 토큰 과금으로 **$15~$30/월** 추가
> - Multimodal Live API는 세션/분 과금이 커서 **$399/월** — 18~54배 비쌈

---

### 우리 서비스 적합도 — 지표 기반 분석

#### 측정 지표 정의

우리 서비스(영어 학습 + 다중 화자 대화 + 발음 코칭)에 중요한 지표를 10가지로 선정하고, 가중치를 부여합니다:

| # | 지표 | 가중치 | 왜 중요한가 |
|---|------|--------|-----------|
| 1 | **다중 화자 지원** | 20% | 핵심 기능. 참여자별 고유 음성 필수 |
| 2 | **레이턴시 (응답 속도)** | 15% | 대화 흐름 자연스러움에 직결 |
| 3 | **발음 평가 가능성** | 15% | 영어 학습 서비스 핵심 가치. 단어별 confidence 필요 |
| 4 | **월 운영 비용** | 10% | 스타트업, 비용 효율 중요 |
| 5 | **음성 자연스러움** | 10% | 사용자 경험 품질 |
| 6 | **감정 표현력** | 10% | 상황별 어조 변화 (카페 vs 인터뷰 등) |
| 7 | **안정성 (SLA)** | 5% | 프로덕션 서비스 신뢰성 |
| 8 | **스트리밍 전환 가능** | 5% | 향후 레이턴시 개선 여지 |
| 9 | **구현 복잡도** | 5% | 개발 리소스 소요 |
| 10 | **GCP 생태계 통합** | 5% | Cloud Run + 서비스 계정 인증 |

#### 점수 평가 (5점 만점)

| 지표 (가중치) | Standard | WaveNet | Neural2 | Chirp HD | Gemini Flash | Gemini Pro | Multimodal Live |
|-------------|----------|---------|---------|----------|-------------|-----------|----------------|
| 다중 화자 (20%) | 5 | 5 | 5 | 5 | 5 | 5 | 1 |
| 레이턴시 (15%) | 5 | 5 | 5 | 4 | 2 | 1 | 5 |
| 발음 평가 (15%) | 5 | 5 | 5 | 5 | 5 | 5 | 1 |
| 비용 (10%) | 5 | 5 | 5 | 5 | 4 | 3 | 1 |
| 자연스러움 (10%) | 1 | 3 | 4 | 5 | 5 | 5 | 5 |
| 감정 표현 (10%) | 1 | 2 | 2 | 4 | 5 | 5 | 4 |
| 안정성 (5%) | 5 | 5 | 5 | 4 | 4 | 4 | 3 |
| 스트리밍 (5%) | 1 | 1 | 1 | 5 | 5 | 5 | 5 |
| 구현 복잡도 (5%) | 5 | 5 | 5 | 5 | 4 | 4 | 1 |
| GCP 통합 (5%) | 5 | 5 | 5 | 5 | 5 | 5 | 5 |

#### 가중합 점수 결과

| 순위 | TTS 옵션 | 가중합 | 특징 |
|------|---------|--------|------|
| 🥇 **1위** | **Neural2** | **4.35** | 다중 화자 + 빠른 속도 + 무료. 자연스러움만 약간 부족 |
| 🥈 **2위** | **Chirp 3: HD** | **4.30** | Neural2와 비슷하나 자연스러움 ↑, 스트리밍 가능 |
| 🥉 **3위** | **WaveNet** | **4.15** | Neural2보다 자연스러움 약간 떨어짐 |
| 4위 | **Gemini Flash TTS** | **3.95** | 자연스러움 최고, 하지만 레이턴시 ↓, 비용 ↑ |
| 5위 | **Standard** | **3.75** | 가장 저렴하지만 기계적 음성 |
| 6위 | **Gemini Pro TTS** | **3.65** | 품질 최고지만 레이턴시/비용 모두 ↓ |
| 7위 | **Multimodal Live** | **2.75** | 레이턴시만 우수. 다중 화자/비용/발음 평가 모두 ❌ |

> **점수 계산 예시 (Neural2)**:
> 5×0.20 + 5×0.15 + 5×0.15 + 5×0.10 + 4×0.10 + 2×0.10 + 5×0.05 + 1×0.05 + 5×0.05 + 5×0.05 = **4.35**

#### 지표별 시각화

```
다중 화자 [████████████████████] Neural2/Chirp HD = 최고, Multimodal = 최저
레이턴시  [████░░░░░░░░░░░░░░░░] Multimodal = 최고, Gemini Pro = 최저
발음 평가 [████████████████████] STT→LLM→TTS 전체 = 최고, Multimodal = 불가
비용      [████████████████░░░░] Cloud TTS 전체 = 무료, Multimodal = $399
자연스러움 [████░░░░░░░░░░░░░░░░] Gemini/Chirp HD = 최고, Standard = 최저
감정 표현  [██████░░░░░░░░░░░░░░] Gemini TTS = 최고, Standard/WaveNet = 최저
```

#### 결론

**Neural2** 또는 **Chirp 3: HD**가 우리 서비스에 가장 적합합니다:

| 선택지 | 추천 상황 |
|--------|----------|
| **Neural2 (1위)** | 레이턴시 최우선. 빠르고 무료. My Turn 기본값으로 적합 |
| **Chirp 3: HD (2위)** | 자연스러움 + 향후 스트리밍 전환까지 고려하면 최적. 무료 이내 |
| **Gemini Flash (4위)** | 감정 표현이 중요한 시나리오에 **선택적으로** 사용 |

**추천 전략**: 기본값은 **Chirp 3: HD** (자연스러움 + 스트리밍 지원 + 무료), 감정 표현이 풍부해야 하는 특정 시나리오에서만 **Gemini Flash TTS**를 선택 가능하게 하고, Latency Lab에서 두 모델을 **직접 A/B 테스트**하여 최종 결정.

---

## 🔬 Latency Lab & My Turn 테스트 항목

### Latency Lab에서 테스트

| 테스트 | 방법 | 목표 |
|--------|------|------|
| **Cloud TTS 모델 속도 비교** | Neural2 vs WaveNet vs Chirp HD 동일 텍스트 | 레이턴시 측정 |
| **Gemini TTS 모델 속도 비교** | Flash vs Pro vs Lite 동일 텍스트 | 레이턴시 측정 |
| **Cloud TTS vs Gemini TTS** | Neural2 vs Gemini Flash 직접 비교 | 품질/속도 A/B |
| **스트리밍 vs 동기식** | 같은 모델에서 방식만 변경 | TTFR 측정 |
| **감정 프롬프트 효과** | 같은 텍스트, 다른 감정 | 차이 체감 |
| **전체 파이프라인 레이턴시** | STT+LLM+TTS 전체 시간 | 병목 식별 |

### My Turn 다중 화자 고도화 방안

#### 현재 vs 고도화 — 체감 차이 예시

```
[현재: 평문 텍스트 + pitch/rate 조절]

바리스타 (Charon): "Welcome to the coffee shop. What can I get for you today."
  → 평범하게 읽음. 쉼 없이 이어서 말함. 감정 표현 미약.

사용자: "I'd like a latte, please."

바리스타 (Charon): "Great choice. What size would you like. Small medium or large."
  → 문장 사이 쉼 없음. 열거할 때 억양 변화 없음.

-----------------------------------------------------------------

[고도화 후: SSML/마크업 + 감정 프롬프트]

바리스타 (Charon): "Welcome to the coffee shop! [short pause] What can I get for you today?"
  → 인사 후 자연스러운 쉼. 질문 어조로 마무리.

사용자: "I'd like a latte, please."

바리스타 (Charon): "[cheerful] Great choice! [short pause] What size would you like?
                    Small... medium... or large?"
  → 감탄 + 쉼 + 열거 시 각 항목 사이에 의도적 쉼
```

#### 고도화 단계

##### 1단계: LLM 응답에 마크업 태그 삽입 (Gemini TTS 전용) — 🟢 쉬움

**방법**: LLM 프롬프트에 마크업 태그 사용 지시를 추가

```python
# 시나리오 디렉터 또는 참여자 프롬프트에 추가
"""
When generating responses, use these markup tags naturally:
- [short pause] between sentences or clauses
- [long pause] for dramatic effect or thinking
- [laughing] when something funny is said  
- [sigh] for frustration or relief
- Do NOT overuse tags. Use 1-2 per response at most.
"""
```

**Before → After**:
```
Before: "Oh that's interesting tell me more about it"
After:  "Oh, that's interesting! [short pause] Tell me more about it."
```

**영향 범위**: LLM 프롬프트만 수정. 코드 변경 없음.
**적용 조건**: Gemini TTS 선택 시에만 작동. Cloud TTS에서는 태그가 그대로 읽힐 수 있으므로 주의.

##### 2단계: Cloud TTS SSML 지원 추가 — 🟡 중간

**방법**: Cloud TTS에서도 SSML을 활용하여 쉼과 강조를 표현

```python
# tts_service.py 수정안
async def synthesize(self, text: str, ..., use_ssml: bool = False):
    if use_ssml:
        synthesis_input = texttospeech.SynthesisInput(
            ssml=text,  # SSML 형식으로 전달
        )
    else:
        synthesis_input = texttospeech.SynthesisInput(
            text=text,  # 현재 방식 (평문)
        )
```

**SSML 변환 예시** (LLM이 생성하거나 서버에서 후처리):
```xml
<speak>
  Oh, that's interesting!
  <break time="400ms"/>
  Tell me more about it.
</speak>
```

**구현 방법 2가지**:

| 방법 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **LLM이 SSML 직접 생성** | 프롬프트에 "SSML 형식으로 응답하라" | 정밀 제어 | LLM 토큰 증가, 파싱 복잡 |
| **서버에서 후처리** | 평문 → 규칙 기반 SSML 변환 | 안정적 | 표현력 제한 |

**추천**: 서버 후처리 방식 (규칙 기반)

```python
# 간단한 후처리 예시
def add_basic_ssml(text: str) -> str:
    """평문 텍스트에 기본 SSML 쉼을 추가"""
    # 문장 끝(. ! ?)마다 짧은 쉼 삽입
    text = re.sub(r'([.!?])\s+', r'\1 <break time="300ms"/> ', text)
    # 쉼표 뒤에 미세 쉼 삽입
    text = re.sub(r',\s+', r', <break time="150ms"/> ', text)
    return f'<speak>{text}</speak>'
```

##### 3단계: 참여자별 음성 전략 — 🟡 중간

**현재**: 모든 참여자가 같은 TTS 시스템 사용
**고도화**: 참여자 성격에 따라 최적의 TTS 시스템/음성 배정

```
[카페 시나리오]

바리스타 (전문적, 차분)
  → Chirp 3: HD "en-US-Chirp-HD-D" (남성)
  → 빠른 레이턴시, 자연스러움
  
단골 손님 (활발, 감정적)
  → Gemini Flash TTS "Kore" + 풍부한 마크업
  → 감정 표현 극대화

매니저 (권위적, 명확)
  → Neural2 "en-US-Neural2-D"
  → 가장 빠르고 안정적
```

**구현**: 참여자 Admin 설정에 TTS 시스템/모델 선택 추가

```python
# participant 설정 확장안
participant_config = {
    "name": "바리스타",
    "tts_provider": "google-cloud-tts",  # 또는 "gemini"
    "tts_model": "en-US-Chirp-HD-D",    # 또는 "gemini-2.5-flash-tts"
    "tts_voice": None,                   # Gemini일 때 "Kore" 등
    "emotion_style": "professional",     # 감정 프롬프트 프리셋
}
```

##### 4단계: TTS 스트리밍 도입 — 🔴 어려움

**목표**: AI 응답 생성 중에 즉시 음성 재생 시작

```
[현재: 동기식]
LLM 완료 → TTS 시작 → TTS 완료 → 전송 → 재생
                    ~1-2초 대기

[고도화: 스트리밍]
LLM 완료 → TTS 시작 → 첫 chunk 즉시 전송 → 재생 시작!
                      → 다음 chunk 전송 → 이어서 재생
                      ~200ms 후 재생 시작
```

**변경 필요 사항**:

| 계층 | 변경 내용 |
|------|----------|
| **서버 TTS** | `synthesize_speech()` → `streaming_synthesize()` |
| **서버→앱** | WebSocket으로 오디오 chunk 전송 |
| **앱 재생** | Web Audio API / AudioBuffer 실시간 합성 재생 |
| **출력 형식** | MP3 → PCM/OGG_OPUS (스트리밍 호환) |

##### 5단계: LLM 스트리밍 + TTS 스트리밍 결합 — 🔴 매우 어려움 (장기)

**목표**: LLM이 토큰을 생성하는 동시에 TTS가 음성을 생성하고 재생

```
LLM: "Great" → TTS: 🔊"Great" 재생
LLM: "choice!" → TTS: 🔊"choice!" 재생
LLM: "What size" → TTS: 🔊"What size" 재생
```

**효과**: 전체 레이턴시가 LLM 첫 토큰 생성 시간(~500ms)까지 단축

#### 고도화 로드맵 요약

```
현재: STT(V1) → LLM → TTS(Gemini Flash, 동기식)
  │
  ├─ [1단계] 마크업 태그 활용 (30분, 프롬프트만 수정)
  │    "쉼과 감정 태그로 다중 화자 대화 생동감 ↑"
  │
  ├─ [2단계] STT → chirp_3 전환 (1~2시간)
  │    "인식 정확도 ↑, 비용 ↓"
  │
  ├─ [3단계] Latency Lab에서 TTS A/B 테스트 (수 시간)
  │    "Neural2 vs Chirp HD vs Gemini Flash → 최적 모델 선정"
  │
  ├─ [4단계] Cloud TTS SSML 후처리 + 참여자별 음성 전략 (1~2일)
  │    "Cloud TTS에서도 자연스러운 쉼, 참여자별 최적 TTS 배정"
  │
  ├─ [5단계] TTS 스트리밍 (1~2주)
  │    "첫 소리까지 ~200ms"
  │
  └─ [6단계] LLM + TTS 동시 스트리밍 (장기)
       "대화하듯 끊김 없는 경험"
```

---

## 📚 참고 문서 링크

| 문서 | URL |
|------|-----|
| Cloud TTS 개요 | https://cloud.google.com/text-to-speech/docs/overview |
| Gemini-TTS 가이드 | https://cloud.google.com/text-to-speech/docs/gemini-tts |
| 지원 음성 목록 | https://cloud.google.com/text-to-speech/docs/voices |
| Chirp 3 HD | https://cloud.google.com/text-to-speech/docs/chirp3-hd |
| SSML 레퍼런스 | https://cloud.google.com/text-to-speech/docs/ssml |
| 가격 정책 | https://cloud.google.com/text-to-speech/pricing |
| 할당량/제한 | https://cloud.google.com/text-to-speech/quotas |
| Python SDK | https://cloud.google.com/python/docs/reference/texttospeech/latest |
| 스트리밍 합성 | https://cloud.google.com/text-to-speech/docs/create-audio-text-streaming |
