# Google Cloud Speech-to-Text 완전 가이드

> **작성일**: 2026-02-24  
> **대상**: 오디오/AI 도메인 처음 학습자  
> **목적**: Google Cloud STT의 모델, 기능, 오디오 설정을 체계적으로 학습하고, 실무 적용에 필요한 모든 커스텀 설정을 이해하기 위한 가이드

---

## 📖 기술 용어 사전

### 음성 인식 (STT) 기본 개념

| 용어 | 영문 | 쉬운 설명 |
|------|------|----------|
| **STT** | Speech-to-Text | 음성을 텍스트로 변환하는 기술. "AI가 받아쓰기를 해주는 것" |
| **전사(Transcription)** | Transcription | 음성을 텍스트로 받아적는 행위. STT의 결과물 |
| **NMT** | Neural Machine Translation | **신경망 기계 번역**. 딥러닝으로 학습한 번역 모델. 여기서는 음성 인식 모델의 학습 방식을 말함 |
| **USM** | Universal Speech Model | Google의 **범용 음성 모델**. 300개+ 언어에서 작동하는 초대형 AI. STT의 Chirp 시리즈에 적용됨 |
| **LLM** | Large Language Model | **대규모 언어 모델**. ChatGPT, Gemini 같은 AI의 기반 기술 |
| **GA** | General Availability | 정식 출시. 프로덕션에서 안심하고 사용 가능 |
| **프리뷰** | Preview | 테스트 단계. 기능 변경/중단 가능. SLA 보장 없음 |
| **동기식 인식** | Synchronous Recognition | 오디오를 보내고 결과를 **한 번에** 받는 방식. 60초 미만 오디오에 사용 |
| **스트리밍 인식** | Streaming Recognition | 오디오를 **실시간으로 보내면서** 결과도 실시간으로 받는 방식 |
| **화자 분리** | Speaker Diarization | 여러 사람의 목소리를 구별하여 "누가 말했는지" 태그를 달아주는 기능 |
| **Phrase Hints** | Phrase Hints (모델 적응) | STT에게 "이 단어들이 나올 가능성이 높아"라고 미리 알려주는 기능. 인식 정확도 향상용 |
| **신뢰도** | Confidence | STT가 "이 결과가 맞을 확률"을 0~1 사이로 알려주는 값. 1.0 = 100% 확신 |
| **BCP-47** | BCP-47 Language Code | 언어를 표기하는 국제 표준. 예: `en-US` = 미국 영어, `ko-KR` = 한국어 |

### 오디오 코덱 & 인코딩 용어

| 용어 | 쉬운 설명 | 비유 |
|------|----------|------|
| **코덱(Codec)** | COder/DECoder. 오디오 데이터를 **압축/복원**하는 방식 | 택배 상자 종류. 작은 상자(MP3)에 넣으면 손실, 큰 상자(WAV)는 그대로 |
| **인코딩(Encoding)** | 오디오를 특정 형식으로 **변환**하는 과정 | 한국어 → 영어로 번역하는 것처럼, 소리 → 디지털 데이터로 변환 |
| **컨테이너(Container)** | 오디오/비디오 데이터를 담는 **파일 형식** | 상자(WebM, MP4)와 내용물(Opus, AAC)은 별개 |
| **PCM** | Pulse Code Modulation. 압축 없는 **원본 디지털 오디오** | 사진의 RAW 파일. 크지만 정보 손실 없음 |
| **LINEAR16** | 16비트 PCM. Google STT가 선호하는 입력 형식 | 가장 깨끗한 입력 |
| **WAV** | PCM 데이터 + 44바이트 헤더를 합친 파일 형식 | PCM에 이름표를 붙인 것 |
| **WebM** | Google이 만든 웹용 미디어 컨테이너 | 택배 상자 종류 중 하나 |
| **Opus** | WebM 안에 들어가는 최신 오디오 코덱. 저지연에 최적 | 상자 안의 내용물 |
| **WEBM_OPUS** | WebM 컨테이너 + Opus 코덱. 브라우저 녹음의 기본 형식 | **우리 서비스에서 브라우저가 보내는 형식** |
| **MP3** | 가장 유명한 손실 압축 코덱. 파일 작고 호환성 최고 | **우리 서비스의 TTS 출력 형식** |
| **OGG** | 오픈소스 미디어 컨테이너. Opus/Vorbis 코덱 포함 가능 | WebM과 비슷한 역할 |
| **FLAC** | 무손실 압축. WAV만큼의 품질 + 절반 크기 | ZIP으로 압축하되 원본 100% 복원 |
| **샘플레이트 (Hz)** | 1초에 소리를 몇 번 측정하는지 | 비유: 초고속 카메라의 프레임 수. 높을수록 정밀 |
| **비트깊이 (bit)** | 각 샘플의 정밀도. 16bit = 65,536단계 | 색 깊이와 비슷. 8bit=256색, 16bit=65536색 |
| **모노/스테레오** | 모노 = 1채널, 스테레오 = 좌/우 2채널 | 음성 인식은 거의 항상 모노 |

---

## 🔌 통신 프로토콜 비교: HTTP vs WebSocket vs gRPC

STT 서비스를 이해하려면 데이터가 어떻게 오가는지 아는 것이 중요합니다:

### 비유로 이해하기

```
HTTP     = 편지 📮  → 보내고 답장 올 때까지 기다림. 한 번에 하나.
WebSocket = 전화 📞  → 연결하면 양쪽이 언제든 말할 수 있음. 실시간.
gRPC     = 전용선 🔗 → 고속 전용 회선. 구조화된 데이터를 빠르게. Google 내부 통신용.
```

### 상세 비교

| 항목 | HTTP (REST) | WebSocket | gRPC |
|------|-------------|-----------|------|
| **통신 방향** | 클라이언트 → 서버 → 응답 | 양방향 (언제든) | 양방향 (스트리밍) |
| **연결 방식** | 요청마다 연결/해제 | 한 번 연결, 유지 | 한 번 연결, 유지 |
| **데이터 형식** | JSON (텍스트) | JSON 또는 바이너리 | Protocol Buffers (바이너리) |
| **속도** | 보통 | 빠름 | 가장 빠름 |
| **오버헤드** | 높음 (매 요청 헤더) | 낮음 | 매우 낮음 |
| **브라우저 지원** | ✅ 완벽 | ✅ 완벽 | ❌ (서버 간 통신용) |
| **모바일 지원** | ✅ | ✅ | ✅ (라이브러리 필요) |
| **구현 난이도** | 🟢 쉬움 | 🟡 중간 | 🔴 어려움 |

### 우리 서비스에서의 사용

```
[모바일 앱] ←── HTTP ──→ [서버]  ←── HTTP ──→ [Google STT]    ← 현재 (동기식)
[모바일 앱] ←── WS ────→ [서버]  ←── HTTP ──→ [Google STT]    ← 현재 (시그널링)
[모바일 앱] ←── WS ────→ [서버]  ←── gRPC ──→ [Google STT]    ← 미래 (스트리밍)
```

| 구간 | 현재 | 스트리밍 도입 후 | 이유 |
|------|------|---------------|------|
| **앱 ↔ 서버 (시그널링)** | WebSocket | WebSocket | 턴 전환 이벤트 실시간 수신 |
| **앱 → 서버 (오디오)** | HTTP POST | WebSocket (chunk) | 실시간 오디오 조각 전송 |
| **서버 → Google STT** | HTTP REST | **gRPC 스트리밍** | Google STT가 gRPC만 스트리밍 지원 |
| **서버 → 앱 (중간 결과)** | 없음 | WebSocket | 실시간 자막 푸시 |

> **왜 gRPC?**: Google Cloud STT의 스트리밍 인식(`streaming_recognize`)은 **gRPC로만** 제공됩니다. HTTP REST로는 동기식/비동기식만 가능합니다. 서버↔Google 구간에서만 gRPC가 필요하고, 앱↔서버 구간은 기존 WebSocket을 활용합니다.

---

## ⚙️ 오디오 설정 완전 가이드 (커스텀 설정)

> 이전에 **`sampleRateHertz: 16000`을 하드코딩**했다가 브라우저 WebM(실제 48kHz)과 불일치하여 400 에러가 발생한 적이 있었습니다. 이 섹션에서 모든 설정 값을 상세히 설명합니다.

### 1. 샘플레이트 (sampleRateHertz)

**"1초에 소리를 몇 번 측정하는가"**

```
8,000Hz  ──── 전화통신. 최소 품질. 음성은 알아들을 수 있는 수준
16,000Hz ──── Google STT 권장. 음성 인식에 충분한 품질
22,050Hz ──── 중간 품질
24,000Hz ──── Gemini TTS 출력 기본값
44,100Hz ──── CD 음질
48,000Hz ──── 방송/전문가용. 브라우저 녹음(WebM/Opus)의 기본값 ← 우리 서비스
```

#### ⚠️ 중요한 규칙

```
1. 코덱에 맞는 샘플레이트를 사용할 것
   - WEBM_OPUS → 보통 48,000Hz (브라우저 기본)
   - LINEAR16  → 16,000Hz (STT 권장) 또는 원본 유지
   
2. 이미 녹음된 오디오의 샘플레이트를 억지로 바꾸지 말 것
   - 48kHz로 녹음된 것을 16kHz로 다운샘플링하면 음질 손상
   - 그보다는 원본 그대로 보내고 Google이 처리하게 하는 것이 좋음

3. Opus 코덱은 sampleRateHertz를 지정하지 않는 것이 좋음
   - Opus는 내부에 샘플레이트 정보를 가지고 있음
   - Google이 자동 감지하므로 생략하는 것이 안전
   - ✅ 우리 서비스가 이전에 이 문제를 겪고 수정한 부분
```

#### 우리 서비스의 설정 (수정 후)

```python
# ✅ 올바른 설정 (현재)
# WebM/Opus → sampleRateHertz 생략 (자동 감지)
request_body = {
    "config": {
        "encoding": "WEBM_OPUS",
        # sampleRateHertz: 생략! Google이 자동 감지
        "languageCode": "en-US",
    },
    "audio": {"content": audio_base64}
}

# ❌ 잘못된 설정 (이전 - 400 에러 발생)
request_body = {
    "config": {
        "encoding": "WEBM_OPUS",
        "sampleRateHertz": 16000,  # ← 실제 48kHz인데 16kHz로 지정 = 에러!
        "languageCode": "en-US",
    },
    "audio": {"content": audio_base64}
}
```

### 2. 인코딩 (encoding)

**"오디오가 어떤 형식으로 압축되어 있는가"**

Google Cloud STT가 지원하는 인코딩:

| 인코딩 | 설명 | sampleRateHertz 필수? | 권장 용도 |
|--------|------|---------------------|----------|
| **WEBM_OPUS** | WebM + Opus | ❌ 자동 감지 | ✅ **브라우저 녹음** |
| **LINEAR16** | 16bit PCM (무압축) | ✅ 필수 | 서버 변환 후 |
| **FLAC** | 무손실 압축 | ❌ 자동 감지 | 고품질 파일 |
| **OGG_OPUS** | OGG + Opus | ❌ 자동 감지 | 모바일 녹음 |
| **MP3** | MP3 | ❌ 자동 감지 | 일반 파일 |
| **MULAW** | 8bit 전화통신 | ✅ (8000Hz) | 전화 |
| **AMR** | 모바일 전화 | ✅ (8000Hz) | 구형 모바일 |
| **AMR_WB** | 광대역 모바일 | ✅ (16000Hz) | 모바일 |
| **ENCODING_UNSPECIFIED** | 자동 감지 | ❌ | 헤더 있는 파일 |

#### 각 인코딩별 sampleRateHertz 규칙

```
WEBM_OPUS     → 생략 (Opus가 자체 메타데이터 보유)
OGG_OPUS      → 생략 (동일)
FLAC          → 생략 (FLAC 헤더에 포함)
MP3           → 생략 (MP3 헤더에 포함)
LINEAR16      → 반드시 지정 (헤더 없는 raw 데이터)
MULAW/ALAW    → 반드시 지정 (헤더 없는 raw 데이터)
```

### 3. 채널 수 (audioChannelCount)

```
1 (모노)     → 기본값. 음성 인식은 대부분 모노로 충분
2 (스테레오)  → 좌/우 채널. 전화 녹음 등에서 사용
               enableSeparateRecognitionPerChannel: true 로 채널별 인식 가능
```

### 4. 모델 (model)

**"어떤 AI 모델로 음성을 인식하는가"**

| 모델 | API 버전 | 정확도 | 속도 | 비원어민 | 가격 |
|------|---------|--------|------|---------|------|
| `latest_long` | V1 | ⭐⭐⭐ | 빠름 | 보통 | $0.024/분 |
| `latest_short` | V1 | ⭐⭐⭐ | 가장 빠름 | 보통 | $0.024/분 |
| `telephony` | V1/V2 | ⭐⭐ | 빠름 | 보통 | $0.009/분 |
| `chirp_2` | **V2** | ⭐⭐⭐⭐⭐ | 보통 | **최고** | $0.016/분 |
| `chirp_3` | **V2** | ⭐⭐⭐⭐⭐ | 보통 | **최고** | $0.016/분 |

> **우리 서비스**: 현재 `latest_long` → **추천: `chirp_3`** (비원어민 영어에 강함, 33% 저렴, 다중 언어 자동 감지)

### 5. 인식 기능 (features) — 켜고 끌 수 있는 옵션들

| 설정 | 기본값 | 설명 | 우리 서비스 |
|------|--------|------|-----------|
| `enableWordTimeOffsets` | false | 단어별 시작/종료 시간 | ✅ 사용 중 |
| `enableAutomaticPunctuation` | false | 자동 구두점 (마침표, 쉼표 등) | ✅ 사용 중 |
| `enableWordConfidence` | false | **단어별** 신뢰도 (0~1) | ❌ → ✅ 추천 |
| `profanityFilter` | false | 비속어를 `***`로 대체 | ❌ → ✅ 추천 |
| `enableSpokenPunctuation` | false | "period" "comma"를 실제 구두점으로 | ❌ 불필요 |
| `enableSpokenEmoji` | false | "smiley face"를 😊로 | ❌ 불필요 |
| `maxAlternatives` | 1 | 대안 전사 결과 수 (최대 30) | 1 (기본) |
| `speechContexts` | [] | **Phrase Hints** (핵심 어휘 사전 제공) | ❌ → ✅ 추천 |

### 6. Phrase Hints (모델 적응) 상세

시나리오 관련 단어를 미리 알려주어 인식률을 높이는 기능:

```python
"speechContexts": [{
    "phrases": [
        # 시나리오: 카페 주문
        "I'd like a latte",
        "Can I get a cappuccino",
        "venti", "grande", "tall",
        "macchiato", "americano", "espresso",
        # 일반적으로 틀리기 쉬운 발음
        "actually", "definitely", "probably",
    ],
    "boost": 10.0  
    # boost 값 (0~20):
    #   0  = 힌트 무시
    #  10  = 보통 (권장)
    #  20  = 매우 강하게 우선
}]
```

**규칙:**
- 최대 **5,000개** phrases 가능
- 각 phrase는 **최대 100문자**
- 너무 많은 phrases는 역효과 (관련 없는 단어로 인식될 수 있음)
- **시나리오별 핵심 어휘 10~50개**가 최적


---

## 🔄 인식 요청 방식 (3가지)

Google Cloud STT는 오디오를 보내는 방식이 3가지입니다:

### 비교표

| 방식 | 최대 오디오 길이 | 결과 반환 | 실시간 | 사용 사례 |
|------|---------------|----------|--------|---------|
| **동기식 (Synchronous)** | 60초 | 오디오 전체 처리 후 **한 번에** | ❌ | ✅ **현재 우리 서비스** |
| **비동기식 (Asynchronous)** | 480분 (8시간) | 처리 완료 후 조회 | ❌ | 긴 미팅/강의 녹음 전사 |
| **스트리밍 (Streaming)** | 5분 (재연결 시 무제한) | **실시간으로 턴턴** | ✅ | 실시간 자막, 음성 비서 |

### 동기식 (현재 우리 서비스)

```
사용자가 녹음 완료 → WebM 파일 전체를 서버로 전송 → Google STT에 전달 → 전체 결과 한 번에 반환

[녹음 5초] ──── [전송 0.5초] ──── [STT 처리 1-2초] ──── 결과!
                                                        총 체감 시간: ~2초
```

### 비동기식 (Long Running)

```
긴 오디오 파일을 Cloud Storage에 업로드 → 처리 요청 → 처리 완료 시 결과 조회

[1시간 녹음 업로드] ──── [백그라운드 처리 수 분] ──── 결과 조회
                       작업 ID로 상태 확인 가능
```

### 스트리밍 (Streaming) ⭐ 향후 도입 추천

```
사용자가 말하는 동안 오디오 조각(chunk)을 실시간으로 전송 → 중간 결과가 실시간으로 반환

[말하기 시작] ──chunk1── 중간 결과: "Hello"
              ──chunk2── 중간 결과: "Hello how"
              ──chunk3── 중간 결과: "Hello how are"
              ──chunk4── 최종 결과: "Hello, how are you?"
              
총 체감 시간: ~0.2초 (첫 글자가 거의 즉시 나옴)
```

#### 스트리밍의 핵심 개념

| 용어 | 설명 |
|------|------|
| **Interim Results** (중간 결과) | 아직 확정되지 않은 결과. "I thin" → "I think" → "I think so" 처럼 계속 수정됨 |
| **Final Results** (최종 결과) | 확정된 결과. 더 이상 수정되지 않음 |
| **Chunk** (청크) | 오디오를 잘라서 보내는 조각. 보통 100ms~500ms 단위 |
| **Half-close** | 클라이언트가 "더 이상 보낼 오디오 없음"을 서버에 알리는 것 |
| **gRPC** | Google이 만든 실시간 양방향 통신 프로토콜. HTTP와 달리 지속적 연결 유지 |

#### 스트리밍 Python 코드 예시

```python
from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech

PROJECT_ID = "your-project-id"

client = SpeechClient()

# 1. 스트리밍 설정
streaming_config = cloud_speech.StreamingRecognitionConfig(
    config=cloud_speech.RecognitionConfig(
        auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
        language_codes=["en-US"],
        model="chirp_3",
        features=cloud_speech.RecognitionFeatures(
            enable_word_time_offsets=True,
            enable_automatic_punctuation=True,
        ),
    ),
    streaming_features=cloud_speech.StreamingRecognitionFeatures(
        interim_results=True,  # 중간 결과 활성화 (타이핑 효과)
    ),
)

# 2. 요청 제너레이터 (오디오를 chunk 단위로 전송)
def request_generator(audio_chunks):
    # 첫 번째 요청: 설정 전송
    yield cloud_speech.StreamingRecognizeRequest(
        recognizer=f"projects/{PROJECT_ID}/locations/global/recognizers/_",
        streaming_config=streaming_config,
    )
    # 이후 요청: 오디오 chunk 전송 (100ms~500ms 단위)
    for chunk in audio_chunks:
        yield cloud_speech.StreamingRecognizeRequest(audio=chunk)

# 3. 스트리밍 인식 실행
responses = client.streaming_recognize(
    requests=request_generator(audio_chunks)
)

# 4. 결과 실시간 처리
for response in responses:
    for result in response.results:
        transcript = result.alternatives[0].transcript
        if result.is_final:
            print(f"[최종] {transcript}")
            # → 확정된 결과. DB 저장, 번역 요청 등 후속 처리
        else:
            print(f"[중간] {transcript}")
            # → 화면에 실시간 표시 (타이핑 효과)
```

#### 스트리밍 vs 동기식 — 사용자 체감 비교

```
[동기식 - 현재]
사용자: (5초간 말함) → (2초 대기) → 결과 한 번에 표시
체감: "말 끝나고 기다려야 하네"

[스트리밍 - 향후]
사용자: (말하는 중) → 동시에 자막이 실시간으로 나타남
체감: "바로바로 보이니까 자연스럽다"
```

#### 스트리밍 도입 시 아키텍처 변경 사항

| 항목 | 현재 (동기식) | 스트리밍 |
|------|-------------|---------|
| **클라이언트→서버** | HTTP POST (파일 전체) | WebSocket (청크 스트림) |
| **서버→Google** | REST API 1회 호출 | gRPC 지속 연결 |
| **서버→클라이언트** | HTTP 응답 1회 | WebSocket (중간 결과 푸시) |
| **구현 복잡도** | 낮음 | 높음 (WebSocket + gRPC 관리) |
| **네트워크** | 단순 | 지속 연결 유지 필요 |

---

## 🏗️ 현재 My Turn 아키텍처와 STT의 관계

### 현재 구조: WebSocket(시그널링) + HTTP(STT)는 분리

My Turn에서 WebSocket을 사용하지만, **STT 자체는 스트리밍이 아닙니다**:

```
[모바일 클라이언트]                    [서버 (Cloud Run)]              [Google Cloud]
    │                                     │                              │
    ├── WebSocket 연결 (/ws) ──────────────┤                              │
    │   역할: 시그널링/이벤트 알림           │                              │
    │   • "AI 턴 시작"                     │                              │
    │   • "AI 발화 완료"                   │                              │
    │   • "당신 차례입니다"                  │                              │
    │                                     │                              │
    │   [사용자 녹음 시작]                   │                              │
    │   [사용자 녹음 완료]                   │                              │
    │                                     │                              │
    ├── HTTP POST /audio ─────────────────┤                              │
    │   WebM 파일 전체 전송 (동기식)         │                              │
    │                                     ├── HTTP POST ────────────────┤
    │                                     │   speech:recognize (V1)      │
    │                                     │   전체 오디오 한 번에 전송       │
    │                                     │                              │
    │                                     │◄── 결과 한 번에 반환 ──────────┤
    │                                     │                              │
    │◄── HTTP 응답 (transcript) ───────────┤                              │
    │                                     │                              │
    │◄── WebSocket: "AI 응답 중..." ───────┤── Gemini LLM 호출 ───────────┤
    │◄── WebSocket: {ai_audio, text} ─────┤── Gemini TTS 호출 ───────────┤
```

### 핵심 포인트

| 역할 | 사용 프로토콜 | 설명 |
|------|-------------|------|
| **시그널링 (이벤트)** | WebSocket | 턴 전환, AI 발화 알림, 세션 상태 |
| **오디오 업로드 (STT)** | HTTP POST | 녹음 완료 후 파일 전체 전송 |
| **STT API 호출** | HTTP REST | `speech:recognize` V1 동기식 |
| **TTS 응답 전달** | WebSocket | AI 음성 + 텍스트를 클라이언트에 푸시 |

### 스트리밍 STT 도입 시 변경되는 부분

```
[모바일 클라이언트]                    [서버 (Cloud Run)]              [Google Cloud]
    │                                     │                              │
    ├── WebSocket 연결 (/ws) ──────────────┤                              │
    │                                     │                              │
    │   [사용자 녹음 시작]                   │                              │
    │                                     │── gRPC 스트리밍 연결 ──────────┤
    │                                     │   streaming_recognize         │
    ├── WebSocket: audio chunk 1 ─────────┤                              │
    │                                     ├── gRPC: chunk 1 ─────────────┤
    │                                     │◄── 중간 결과: "Hello" ─────────┤
    │◄── WebSocket: {interim: "Hello"} ───┤                              │
    │                                     │                              │
    ├── WebSocket: audio chunk 2 ─────────┤                              │
    │                                     ├── gRPC: chunk 2 ─────────────┤
    │                                     │◄── 중간 결과: "Hello how" ─────┤
    │◄── WebSocket: {interim: "Hello how"}┤                              │
    │                                     │                              │
    │   [사용자 녹음 완료]                   │                              │
    ├── WebSocket: "recording_end" ────────┤                              │
    │                                     ├── gRPC: half-close ──────────┤
    │                                     │◄── 최종 결과 ─────────────────┤
    │◄── WebSocket: {final: "Hello, ..."}─┤                              │
```

> **변경 포인트**: 현재 HTTP POST로 파일 전체를 보내던 것이 → WebSocket으로 오디오 chunk를 실시간 전송하는 것으로 바뀜. 기존 WebSocket 시그널링 채널을 **오디오 전송에도 공용**하거나, **별도 채널을 추가**해야 함.

---

## ✅❌ 우리 서비스에서 스트리밍 STT 도입 시 장단점

### 장점

| 관점 | 장점 | 상세 설명 |
|------|------|----------|
| **체감 속도** | ⭐ 실시간 자막 표시 | 말하는 동안 텍스트가 나타남. 녹음 후 2초 대기 → 거의 0초 |
| **"말 끝남" 인식** | ⭐ Google이 자동 감지 | STT가 음성 활동을 모니터링하여 `is_final`을 반환. **별도 타이머 불필요** |
| **턴 전환 속도** | 사용자→AI 전환이 빠름 | `is_final` 즉시 → LLM 호출 시작 (녹음 업로드 대기 없음) |
| **UX 신뢰감** | "잘 듣고 있구나" 피드백 | 중간 결과가 보이면 사용자가 시스템이 작동 중임을 알 수 있음 |
| **긴 발화 지원** | 5분까지 (재연결 시 무제한) | 현재 동기식은 60초 제한 |
| **발음 피드백 실시간** | 단어 나올 때마다 확인 가능 | 말하면서 바로 인식 결과를 확인 → 자기 교정 가능 |

### 단점

| 관점 | 단점 | 상세 설명 | 심각도 |
|------|------|----------|--------|
| **"말 끝남" 오감지** | 쉼이 길면 중간에 끊김 | 학습자가 생각하느라 3초 멈추면 → Google이 "말 끝남"으로 판단할 수 있음 | 🔴 높음 |
| **Cloud Run 타임아웃** | 연결 유지 안정성 | Cloud Run의 request timeout(현재 3600초)은 있지만, 중간에 idle timeout이 발생할 수 있음 | 🔴 높음 |
| **gRPC 5분 제한** | 스트리밍 연결 최대 5분 | 5분 초과 시 재연결 필요. 대화 중간에 끊킬 수 있음 | 🟡 중간 |
| **중간 결과 불안정** | 텍스트가 계속 바뀜 | "I think" → "I think so" → "I think soap" → "I think so." 처럼 흔들림. 산만할 수 있음 | 🟡 중간 |
| **에러 복구 복잡** | 네트워크 끊김 시 | HTTP는 재시도 간단. 스트리밍은 연결 재수립 + 이전 오디오 유실 | 🔴 높음 |
| **구현 복잡도** | WebSocket + gRPC 이중 관리 | 클라이언트↔서버(WebSocket) + 서버↔Google(gRPC) 두 연결을 동기화해야 함 | 🟡 중간 |
| **모바일 배터리/데이터** | 지속 연결 비용 | WebSocket + gRPC 상시 연결은 모바일 배터리와 데이터 소모 증가 | 🟡 중간 |
| **디버깅 난이도** | 문제 추적 어려움 | 동기식은 요청/응답이 명확. 스트리밍은 어느 chunk에서 문제가 생겼는지 추적 어려움 | 🟡 중간 |

### "말 끝남" 인식 상세 분석

이 부분이 **영어 학습 서비스에서 가장 중요한 이슈**입니다:

| 상황 | 동기식 (현재) | 스트리밍 |
|------|-------------|---------|
| **녹음 버튼으로 제어** | ✅ 사용자가 직접 "녹음 시작/종료" | 가능하지만 스트리밍의 장점이 줄어듦 |
| **자동 종료 (VAD)** | 클라이언트에서 타이머 기반 | Google STT가 자동 감지 (VAD 내장) |
| **학습자 생각 시간** | ✅ 녹음 중이면 기다림 | ⚠️ 3초 침묵 → "말 끝"으로 오판할 수 있음 |
| **더듬거림** | ✅ 전체 녹음 후 분석 | ⚠️ 더듬는 중간에 "말 끝"으로 오판 |
| **설정 가능?** | N/A | `voice_activity_timeout` 조정 가능 |

> **VAD** (Voice Activity Detection): 음성 활동 감지. "지금 사람이 말하고 있는가?"를 판단하는 기술

#### 스트리밍에서 "말 끝남" 오판 방지 전략

```python
# 방법 1: voice_activity_timeout을 넉넉하게 설정
streaming_features=cloud_speech.StreamingRecognitionFeatures(
    interim_results=True,
    voice_activity_timeout=cloud_speech.StreamingRecognitionFeatures.VoiceActivityTimeout(
        speech_start_timeout=duration_pb2.Duration(seconds=30),  # 말 시작 대기
        speech_end_timeout=duration_pb2.Duration(seconds=5),     # 5초 침묵 후 종료 (기본 ~2초)
    ),
)

# 방법 2: 하이브리드 방식 (추천)
# - 스트리밍으로 중간 결과는 보여주되
# - "말 끝남"은 클라이언트의 녹음 중단 버튼으로만 판단
# - 녹음 중단 버튼 누르면 → half-close → 최종 결과 받기

# 두가지 방법 모두 적용 필요 (VAD 4초 + 녹음 중단 버튼)
```

### 종합 판단

| 평가 항목 | 점수 | 설명 |
|----------|------|------|
| **UX 개선 효과** | ⭐⭐⭐⭐⭐ | 체감 속도 극적 개선 |
| **구현 난이도** | ⭐⭐ (어려움) | WebSocket+gRPC 이중 관리 |
| **안정성 리스크** | ⭐⭐⭐ (중간) | Cloud Run 타임아웃, 5분 제한, 재연결 |
| **"말 끝남" 리스크** | ⭐⭐⭐ (중간) | 하이브리드 방식으로 완화 가능 |
| **도입 가치** | ⭐⭐⭐⭐ | 높음, 단 chirp_3 먼저 적용 후 2단계로 |

---

## 💰 스트리밍 vs 동기식: 비용은 달라지는가?

### 핵심 결론: **비용은 동일합니다**

Google Cloud STT는 **인식 방식(동기/비동기/스트리밍)에 관계없이 동일한 가격**을 적용합니다. 과금은 **처리한 오디오 시간(분)** 기준입니다.

| 항목 | 동기식 | 스트리밍 | 차이 |
|------|--------|---------|------|
| **STT API 비용** | $0.016/분 (chirp_3) | $0.016/분 (chirp_3) | **동일** |
| **과금 기준** | 전송한 오디오 길이 | 전송한 오디오 길이 | **동일** |
| **최소 과금 단위** | 15초 | 15초 | **동일** |

### 하지만 간접 비용이 달라질 수 있음

| 항목 | 동기식 | 스트리밍 | 영향 |
|------|--------|---------|------|
| **Cloud Run 인스턴스 사용 시간** | 요청 중에만 활성 | 연결 유지 동안 계속 활성 | 스트리밍이 약간 더 비쌈 |
| **네트워크 전송량** | 1회 전송 | 지속 연결 (오버헤드 적음) | 거의 동일 |
| **메모리 사용** | 요청 당 할당/해제 | 연결 당 지속 점유 | 스트리밍이 약간 더 사용 |
| **동시 연결 수** | 높을 수 있음 | gRPC 연결 수 제한 있음 | 스케일링 전략 다름 |

### 비용 시뮬레이션: 월 15,000분 기준

| 구성 | STT API | Cloud Run (예상) | 합계 |
|------|---------|-----------------|------|
| V1 `latest_long` + 동기식 (현재) | $360 | ~$30 | **~$390** |
| V2 `chirp_3` + 동기식 | **$240** | ~$30 | **~$270** |
| V2 `chirp_3` + 스트리밍 | **$240** | ~$45 (연결 유지) | **~$285** |

> 스트리밍은 Cloud Run 비용이 약간 증가하지만, chirp_3 전환만으로도 전체 비용은 현재보다 절감됩니다.

---

## 🔬 업그레이드 전략: chirp_3 vs 스트리밍

### chirp_3과 스트리밍은 양자택일이 아닌 조합

```
현재: V1 latest_long + 동기식
  │
  ├─ [1단계] chirp_3 + 동기식  ← 모델만 교체 (1~2시간)
  │     정확도 ↑, 비용 ↓, 구현 쉬움
  │
  └─ [2단계] chirp_3 + 스트리밍  ← 아키텍처 변경 (1~2주)
        체감 속도 ↑, 실시간 자막
```

### 업그레이드 지표 비교

| 지표 | chirp_3 먼저 (모델 교체) | 스트리밍 먼저 (방식 교체) |
|------|------------------------|------------------------|
| **구현 난이도** | 🟢 낮음 (config만 변경) | 🔴 높음 (WebSocket+gRPC) |
| **인식 정확도 개선** | ✅ 즉시 체감 | ❌ 모델 그대로면 동일 |
| **체감 속도 개선** | 🟡 약간 | ✅ 극적 (~2초→~0.2초) |
| **비용 변화** | 🟢 33% 절감 | ➡️ API 비용 동일, 인프라 약간 증가 |
| **기존 코드 영향** | 🟢 거의 없음 (SDK 전환) | 🔴 클라이언트+서버 리팩터링 |
| **롤백 용이성** | 🟢 config만 되돌리면 됨 | 🟡 아키텍처 변경이라 복잡 |
| **테스트 범위** | 🟢 결과 비교만 | 🔴 연결 안정성, 에러 복구 등 |

> **추천**: chirp_3 먼저 적용 (저위험, 즉시 효과) → 안정화 후 스트리밍 도입

---

## 🧪 Latency Lab 테스트 계획

Latency Lab(지연시간 실험실)에서 두 방식을 모두 제공하여 A/B 테스트:

### 테스트 구성

```
Latency Lab 실험실
├── [A] 현재 방식: V1 latest_long 선택 + 동기식/스트리밍 선택 불가
├── [B] 모델 업그레이드: V2 chirp_3 선택 + 동기식 선택
└── [C] 풀 업그레이드: V2 chirp_3 + 스트리밍 선택
```

### 1. 인식 정확도 테스트 (가장 중요)

| 테스트 항목 | 측정 방법 | 기대 결과 |
|------------|---------|----------|
| **WER (Word Error Rate)** | 동일 문장 읽기 → 정답과 비교 | chirp_3이 20~40% 개선 |
| **비원어민 발음** | 한국인 초/중/고급 학습자 3명 이상 | chirp_3이 확연히 우수 |
| **발음 어려운 단어** | "comfortable", "February", "entrepreneur" | 모델별 차이 측정 |
| **노이즈 환경** | 카페 소음, 지하철 배경음 | chirp_3이 노이즈에 강함 |
| **관용구/연결 발음** | "I'm gonna", "wanna", "shoulda" | 구어체 인식률 비교 |

### 2. 성능 지표 테스트

| 테스트 항목 | 측정 값 | A (현재) | B (chirp_3) | C (스트리밍) |
|------------|--------|---------|------------|------------|
| **첫 결과 도달 시간 (TTFR)** | ms | ~2,000 | ~2,000 | **~200** |
| **전체 결과 도달 시간** | ms | ~2,500 | ~2,500 | ~2,500 |
| **중간 결과 변경 횟수** | 회 | N/A | N/A | 3~5회 |
| **중간→최종 결과 차이율** | % | N/A | N/A | 측정 필요 |

### 3. 사용자 경험 테스트

| 테스트 항목 | 측정 방법 | 주의 사항 |
|------------|---------|----------|
| **체감 반응 속도 만족도** | 1~5점 설문 | A/B 비교 |
| **실시간 자막의 편의성** | 스트리밍 시 자막이 도움 되는지 | 산만할 수도 있음 |
| **발화 종료 감지** | "말 끝남"을 정확히 인식하는지 | 스트리밍에서 특히 중요 |
| **에러 시 사용자 경험** | 연결 끊김, 인식 실패 시 | 스트리밍이 복잡 |

### 4. 인프라/안정성 테스트

| 테스트 항목 | 측정 방법 | 위험도 |
|------------|---------|--------|
| **Cloud Run 호환성** | 스트리밍 연결이 타임아웃 안 되는지 | 🔴 높음 |
| **동시 접속 처리** | 10명 동시 스트리밍 시 서버 부하 | 🟡 중간 |
| **연결 끊김 복구** | WiFi 전환, 일시적 네트워크 끊김 | 🔴 높음 |
| **서버 메모리 사용량** | gRPC 연결당 메모리 점유 | 🟡 중간 |
| **장시간 연결 안정성** | 10분 이상 대화 시 연결 유지 | 🔴 높음 |

### 테스트 결과 기록 양식 (예시)

```
테스트 ID: STT-001
날짜: 2026-03-XX
테스터: (이름)
레벨: 초급/중급/고급
환경: 조용한 방 / 카페 / 이동 중

| 문장 | 정답 | A 결과 | B 결과 | C 결과 |
|------|------|--------|--------|--------|
| "I'd like a latte" | ... | ... | ... | ... |
| "Can I get a cappuccino" | ... | ... | ... | ... |

A 체감 점수: __/5
B 체감 점수: __/5  
C 체감 점수: __/5
```

---

## 🔍 현재 구현 분석

### 현재 사용 중인 설정 (`stt_service.py`)

| 항목 | 현재 값 | 비고 |
|------|--------|------|
| **API 버전** | V1 REST | `/v1/speech:recognize` |
| **인증** | API 키 | `key=API_KEY` 쿼리 파라미터 |
| **모델** | `latest_long` | V1의 범용 모델 |
| **인코딩** | WEBM_OPUS (1차) → LINEAR16 (폴백) | WebM 직접 → WAV 변환 폴백 |
| **기능** | 단어 타이밍, 자동 구두점 | `enableWordTimeOffsets`, `enableAutomaticPunctuation` |
| **요청 방식** | 동기식 (`speech:recognize`) | 60초 미만 오디오 |
| **SDK** | httpx 직접 호출 | google-cloud-speech SDK 미사용 |

---

## 🔴 개선이 필요한 항목

### 1. STT V2 API & Chirp 모델 (가장 큰 업그레이드)

**현재**: V1 API + `latest_long` 모델  
**권장**: V2 API + `chirp_2` 또는 `chirp_3` 모델

| 항목 | V1 `latest_long` | V2 `chirp_2` | V2 `chirp_3` |
|------|-------------------|--------------|--------------|
| **정확도** | 좋음 | 우수 | 최고 |
| **기술 기반** | 전통적 ASR | USM (범용 음성 모델) | USM 최신 |
| **지원 언어** | 125+ | 100+ | 100+ |
| **다중 언어 인식** | ❌ | ❌ | ✅ (자동 감지) |
| **비원어민 인식** | 보통 | **뛰어남** | **최고** |
| **가격** | $0.024/분 | $0.016/분 | $0.016/분 |

> **Chirp가 우리 서비스에 유리한 이유**: 한국인의 영어 발음(비원어민)을 인식하는 것이 핵심. Chirp는 다양한 악센트에 대해 학습되어 비원어민 인식률이 높음.

### 2. google-cloud-speech SDK 전환

**현재**: `httpx`로 REST API 직접 호출 + API 키  
**권장**: `google-cloud-speech` SDK (이미 `pyproject.toml`에 `^2.36.1` 설치됨)

```python
# 현재 (httpx + REST + API 키)
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(
        f"{self.API_URL}?key={self.api_key}", json=request_body,
    )

# 권장 (google-cloud-speech SDK)
from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech

client = SpeechClient()
config = cloud_speech.RecognitionConfig(
    auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
    language_codes=["en-US"],
    model="chirp_2",
    features=cloud_speech.RecognitionFeatures(
        enable_word_time_offsets=True,
        enable_automatic_punctuation=True,
        enable_word_confidence=True,
    ),
)
response = client.recognize(
    config=config, content=audio_bytes,
    recognizer=f"projects/{PROJECT_ID}/locations/global/recognizers/_",
)
```

### 3. Phrase Hints 추가 (즉시 적용 가능)

시나리오 핵심 어휘를 STT에 전달하여 인식 정확도 향상:

```python
# V1 API에서 즉시 적용 가능
"speechContexts": [{
    "phrases": ["latte", "cappuccino", "americano", "venti", "grande"],
    "boost": 10.0
}]
```

### 4. 단어 수준 신뢰도 (`enableWordConfidence`)

```python
"enableWordConfidence": True

# 응답 예시 - 발음 평가에 활용 가능
{
    "word": "cappuccino",
    "startTime": "1.2s",
    "endTime": "1.8s",
    "confidence": 0.65  # ← 불명확한 발음
}
```

### 5. 욕설 필터 (`profanityFilter`)

```python
"profanityFilter": True  # 비속어 → *** 대체
```

---

## 🌏 한국에서의 사용 가능 여부

| 항목 | 사용 가능 | 비고 |
|------|----------|------|
| **Cloud STT V1** | ✅ | 글로벌 엔드포인트 |
| **Cloud STT V2** | ✅ | 글로벌 또는 리전별 |
| **Chirp 2/3 모델** | ✅ | 한국어(ko-KR)도 지원 |
| **스트리밍 인식** | ✅ | WebSocket/gRPC |
| **결제** | ✅ | 한국 계정 사용 가능 |
| **데이터 처리 위치** | ⚠️ | 글로벌 처리, 한국 리전 지정 불가 |

---

## 💰 가격 비교

### 비용 시뮬레이션 (월간)

가정: 일 100명 × 평균 5분 대화 × 30일 = **월 15,000분**

| 모델 | 월 비용 |
|------|--------|
| V1 `latest_long` | $360 ($0.024 × 15,000) |
| V2 `chirp_2` | **$240** ($0.016 × 15,000) |
| V2 `chirp_3` | **$240** ($0.016 × 15,000) |

> Chirp 모델이 더 정확하면서도 **33% 저렴**합니다!

---

## 🏆 우리 서비스 최적 구성 추천

### 즉시 적용 가능 (V1 API 코드 변경만)

| 항목 | 현재 | 추천 | 효과 |
|------|------|------|------|
| **Phrase Hints** | 미사용 | 시나리오 핵심 어휘 전달 | 인식 정확도 ↑ |
| **단어 신뢰도** | 미사용 | `enableWordConfidence: true` | 발음 평가 가능 |
| **욕설 필터** | 미사용 | `profanityFilter: true` | 학습 환경 보호 |

### 중기 업그레이드 (SDK 전환)

| 항목 | 현재 | 추천 | 효과 |
|------|------|------|------|
| **SDK** | httpx REST | google-cloud-speech SDK | 안정성 ↑ |
| **API 버전** | V1 | V2 | Chirp 모델 사용 가능 |
| **모델** | `latest_long` | `chirp_2` | 비원어민 인식률 ↑, 비용 33% ↓ |

### 장기 업그레이드 (아키텍처 변경)

| 항목 | 현재 | 추천 | 효과 |
|------|------|------|------|
| **인식 방식** | 동기식 | 스트리밍 | 체감 속도 10x ↑ |
| **실시간 자막** | 없음 | 중간 결과 표시 | UX 대폭 개선 |

---

## 📚 참고 문서 링크

| 문서 | URL |
|------|-----|
| Cloud STT 개요 | https://cloud.google.com/speech-to-text/docs/overview |
| 가격 정책 | https://cloud.google.com/speech-to-text/pricing |
| 모델 비교 | https://cloud.google.com/speech-to-text/docs/transcription-model |
| 오디오 인코딩 | https://cloud.google.com/speech-to-text/docs/encoding |
| 모델 적응 (Phrase Hints) | https://cloud.google.com/speech-to-text/docs/adaptation |
| 화자 분리 | https://cloud.google.com/speech-to-text/docs/multiple-voices |
| 단어 신뢰도 | https://cloud.google.com/speech-to-text/docs/word-confidence |
| 스트리밍 인식 | https://cloud.google.com/speech-to-text/docs/streaming-recognize |
| 지원 언어 | https://cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages |
| V2 마이그레이션 | https://cloud.google.com/speech-to-text/docs/migration |
| Python SDK | https://cloud.google.com/python/docs/reference/speech/latest |
