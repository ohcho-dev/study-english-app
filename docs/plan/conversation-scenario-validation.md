# 대화 시나리오 검증 - 상세 기획서 (Latency Lab / RUN0)

> **Note**: 본 문서는 **Run0 (Voice Tech Baseline)**에 대한 기획서입니다.
> 현재 Admin UI에서는 **Latency Lab (Run0)**로 명명되어 있으며, WebRTC 기반의 본격적인 학습 시나리오는 **My Turn**으로 구분됩니다.

> **작성일**: 2026-02-08  
> **버전**: 1.0  
> **상태**: 검토 대기

---

## 1. 개요

### 1.1 목적
AI 기반 영어 회화 학습에서 "My Turn" 학습 시나리오의 기술적 실현 가능성을 검증하고, 다양한 대화 구조를 실험할 수 있는 플랫폼 구축.

> **"My Turn" 학습 시나리오란?**  
> 여러 AI 참가자들이 영어로 대화하는 것을 듣고, 내 차례(My Turn)가 되면 앞사람의 발화 패턴을 참고하여 직접 말해보는 학습 방식. 관찰 → 모방 → 반복을 통해 자연스러운 영어 회화를 내재화하는 것이 목표.

### 1.2 핵심 컨셉
- **관찰 → 모방 → 반복 → 내재화**: 다자 대화에서 앞사람의 발화 패턴을 듣고 따라하기
- **중계자 AI**: 대화 흐름 제어, 사용자에게 피드백 제공
- **다중 AI 참가자**: 다양한 페르소나의 AI들이 대화에 참여

### 1.3 범위
- Admin에서 대화 템플릿 설계 및 실험 실행
- 음성 기반 실시간 대화 (STT/TTS)
- 기술 베이스라인 측정 및 모니터링

---

## 2. 기술 스택

### 2.1 확정 기술

| 레이어 | 기술 | 선택 이유 |
|--------|------|----------|
| 실시간 통신 | **WebRTC** | 멀티플레이어 음성 경쟁 확장 대비 |
| STT | **Google Cloud Speech-to-Text** | 높은 정확도, 모바일 호환 |
| TTS | **Google Cloud Text-to-Speech** | 멀티보이스 지원, WaveNet 품질 |
| LLM | **Google Gemini** (LangChain) | 기존 사용 중 |
| 백엔드 | **FastAPI** | 기존 사용 중, WebSocket 지원 |
| 프론트엔드 | **Next.js** (Admin) | 기존 사용 중 |

### 2.2 WebRTC 구성

```
┌─────────────────────────────────────────────────┐
│              Signaling Server                   │
│            (FastAPI + WebSocket)                │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Client A│  │ Client B│  │ Server  │
   │ (User)  │  │ (User)  │  │ (AI TTS)│
   └─────────┘  └─────────┘  └─────────┘
```

---

## 3. 데이터베이스 설계

### 3.1 ER 다이어그램

```
┌──────────────────────────┐
│  ConversationTemplate    │
├──────────────────────────┤
│ id: UUID (PK)            │
│ name: VARCHAR(255)       │
│ description: TEXT        │
│ scene_context: TEXT      │◄─── 모든 AI 공유 상황 설명
│ topic_prompt: TEXT       │
│ conversation_mode: ENUM  │◄─── 턴제/자유난입
│ max_rounds: INT          │
│ # 자유난입 모드 설정       │
│ silence_threshold_ms: INT│◄─── 침묵 후 AI 발화 시작 (기본: 2000)
│ max_consecutive_turns:INT│◄─── 같은 AI 연속 발화 제한 (기본: 2)
│ user_priority: BOOLEAN   │◄─── 사용자 발화 시 AI 중단 (기본: true)
│ created_at: DATETIME     │
│ updated_at: DATETIME     │
└──────────────────────────┘
           │ 1:N
           ▼
┌──────────────────────────┐
│ ConversationParticipant  │
├──────────────────────────┤
│ id: UUID (PK)            │
│ template_id: UUID (FK)   │
│ participant_type: ENUM   │◄─── MODERATOR/AI/USER
│ name: VARCHAR(100)       │
│ persona: TEXT            │
│ system_prompt: TEXT      │
│ model_name: VARCHAR(50)  │
│ voice_name: VARCHAR(50)  │
│ speaking_order: INT      │
│ # TTS 학습 지원 설정       │
│ speech_rate: FLOAT       │◄─── 발화 속도 (0.5~2.0, 기본 1.0)
│ speech_pitch: FLOAT      │◄─── 음성 높낮이 (-20~+20)
│ pause_after_ms: INT      │◄─── 문장 간 쉼 (500~3000ms)
│ # LLM 대화 스타일 설정     │
│ vocabulary_level: ENUM   │◄─── beginner/intermediate/advanced
│ sentence_complexity: ENUM│◄─── simple/moderate/complex
│ use_filler_words: BOOLEAN│◄─── 필러 워드 사용 여부
│ grammar_strictness: ENUM │◄─── casual/standard/formal
│ feedback_detail: ENUM    │◄─── brief/normal/detailed
│ # 상호작용 설정            │
│ repeat_on_request: BOOL  │◄─── 재요청 시 반복
│ slow_down_on_struggle:BOL│◄─── 어려우면 자동 느리게
│ provide_hints: ENUM      │◄─── never/sometimes/always
│ correction_style: ENUM   │◄─── direct/indirect/recast
│ created_at: DATETIME     │
└──────────────────────────┘

┌──────────────────────────┐
│ ConversationSession      │
├──────────────────────────┤
│ id: UUID (PK)            │
│ template_id: UUID (FK)   │
│ status: ENUM             │◄─── ACTIVE/WAITING_USER/COMPLETED
│ conversation_mode: ENUM  │
│ current_round: INT       │
│ current_speaker_id: UUID │
│ created_at: DATETIME     │
│ completed_at: DATETIME   │
└──────────────────────────┘
           │ 1:N
           ▼
┌──────────────────────────┐
│ ConversationTurn         │
├──────────────────────────┤
│ id: UUID (PK)            │
│ session_id: UUID (FK)    │
│ participant_id: UUID(FK) │
│ round_index: INT         │
│ turn_index: INT          │
│ # 입력/출력               │
│ input_text: TEXT         │◄─── STT 결과
│ output_text: TEXT        │◄─── LLM 응답
│ audio_url: VARCHAR(255)  │
│ # 상세 로그               │
│ stt_transcript: TEXT     │◄─── STT 원본 인식 결과
│ stt_confidence: FLOAT    │◄─── STT 신뢰도 (0~1)
│ llm_model_used: VARCHAR  │◄─── 실제 사용된 LLM
│ tts_voice_used: VARCHAR  │◄─── 실제 사용된 TTS 음성
│ input_tokens: INT        │◄─── 입력 토큰 수
│ output_tokens: INT       │◄─── 출력 토큰 수
│ execution_time_ms: INT   │◄─── 실행 시간
│ created_at: DATETIME     │
└──────────────────────────┘

┌──────────────────────────┐
│ MeasurementConfig        │
├──────────────────────────┤
│ id: UUID (PK)            │
│ name: VARCHAR(100)       │
│ is_default: BOOLEAN      │
│ created_at: DATETIME     │
└──────────────────────────┘
           │ 1:N
           ▼
┌──────────────────────────┐
│ MeasurementPoint         │
├──────────────────────────┤
│ id: UUID (PK)            │
│ config_id: UUID (FK)     │
│ point_key: VARCHAR(20)   │◄─── t0, t1, t2, ...
│ point_name: VARCHAR(100) │
│ event_type: VARCHAR(50)  │◄─── user_end, stt_final, ...
│ order_index: INT         │
└──────────────────────────┘

┌──────────────────────────┐
│ MeasurementInterval      │
├──────────────────────────┤
│ id: UUID (PK)            │
│ config_id: UUID (FK)     │
│ interval_name: VARCHAR   │◄─── E2E, ASR, LLM, ...
│ start_point: VARCHAR(20) │
│ end_point: VARCHAR(20)   │
└──────────────────────────┘

┌──────────────────────────┐
│ SessionMetrics           │
├──────────────────────────┤
│ id: UUID (PK)            │
│ session_id: UUID (FK)    │
│ turn_id: UUID (FK)       │
│ config_id: UUID (FK)     │
│ timestamps: JSONB        │◄─── {t0: ..., t1: ..., ...}
│ latencies: JSONB         │◄─── {e2e: ..., asr: ..., ...}
│ retry_count: INT         │
│ error_code: VARCHAR(50)  │
│ created_at: DATETIME     │
└──────────────────────────┘

┌──────────────────────────┐
│ ConversationSessionLog   │◄─── 세션 종료 시 집계
├──────────────────────────┤
│ id: UUID (PK)            │
│ session_id: UUID (FK)    │
│ template_name: VARCHAR   │
│ conversation_mode: ENUM  │
│ total_rounds: INT        │
│ total_turns: INT         │
│ total_tokens: INT        │
│ total_input_tokens: INT  │
│ total_output_tokens: INT │
│ estimated_cost_usd: DEC  │
│ avg_e2e_latency_ms: INT  │
│ p95_e2e_latency_ms: INT  │
│ total_retries: INT       │
│ error_count: INT         │
│ session_summary: TEXT    │◄─── AI 생성 세션 요약
│ user_feedback: TEXT      │◄─── 사용자 피드백 (선택)
│ user_rating: INT         │◄─── 사용자 평점 (1-5)
│ created_at: DATETIME     │
└──────────────────────────┘
```

### 3.2 ENUM 정의

```python
class ConversationMode(str, Enum):
    TURN_BASED = "turn_based"      # 턴제
    FREE_FORM = "free_form"        # 자유난입

class ParticipantType(str, Enum):
    MODERATOR = "moderator"        # 중계자
    AI = "ai"                      # AI 참가자
    USER = "user"                  # 사용자

class SessionStatus(str, Enum):
    ACTIVE = "active"              # 진행 중
    WAITING_USER = "waiting_user"  # 사용자 입력 대기
    COMPLETED = "completed"        # 완료

class EventType(str, Enum):
    USER_SPEECH_END = "user_speech_end"
    STT_PARTIAL = "stt_partial"
    STT_FINAL = "stt_final"
    LLM_STREAM_START = "llm_stream_start"
    LLM_FINAL = "llm_final"
    TTS_AUDIO_START = "tts_audio_start"
    TTS_AUDIO_END = "tts_audio_end"

# 학습 지원 설정 ENUM
class VocabularyLevel(str, Enum):
    BEGINNER = "beginner"          # 초급 어휘
    INTERMEDIATE = "intermediate"  # 중급 어휘
    ADVANCED = "advanced"          # 고급 어휘

class SentenceComplexity(str, Enum):
    SIMPLE = "simple"              # 단문 위주
    MODERATE = "moderate"          # 중간 복잡도
    COMPLEX = "complex"            # 복문 포함

class GrammarStrictness(str, Enum):
    CASUAL = "casual"              # 일상 대화체
    STANDARD = "standard"          # 표준 문법
    FORMAL = "formal"              # 격식체

class FeedbackDetail(str, Enum):
    BRIEF = "brief"                # 간단한 피드백
    NORMAL = "normal"              # 보통 상세도
    DETAILED = "detailed"          # 자세한 설명

class HintFrequency(str, Enum):
    NEVER = "never"                # 힌트 제공 안함
    SOMETIMES = "sometimes"        # 가끔 힌트
    ALWAYS = "always"              # 항상 힌트

class CorrectionStyle(str, Enum):
    DIRECT = "direct"              # 직접 교정 ("It's 'went', not 'goed'")
    INDIRECT = "indirect"          # 간접 교정 ("Can you try again?")
    RECAST = "recast"              # 재구성 ("So you went there?")
```

### 3.3 기본 측정 구간 (Default Seed Data)

```python
DEFAULT_MEASUREMENT_POINTS = [
    {"point_key": "t0", "point_name": "발화종료", "event_type": "user_speech_end", "order": 0},
    {"point_key": "t1", "point_name": "STT완료", "event_type": "stt_final", "order": 1},
    {"point_key": "t2", "point_name": "LLM완료", "event_type": "llm_final", "order": 2},
    {"point_key": "t2_5", "point_name": "TTS준비", "event_type": "tts_ready", "order": 3},
    {"point_key": "t3", "point_name": "재생시작", "event_type": "audio_play_start", "order": 4},
]

DEFAULT_MEASUREMENT_INTERVALS = [
    {"interval_name": "E2E", "start_point": "t0", "end_point": "t3"},
    {"interval_name": "ASR", "start_point": "t0", "end_point": "t1"},
    {"interval_name": "LLM", "start_point": "t1", "end_point": "t2"},
    {"interval_name": "TTS", "start_point": "t2", "end_point": "t3"},
]
```

---

## 4. API 설계

### 4.1 템플릿 관리

```yaml
# 템플릿 CRUD
POST   /api/v1/conversations/templates
GET    /api/v1/conversations/templates
GET    /api/v1/conversations/templates/{id}
PUT    /api/v1/conversations/templates/{id}
DELETE /api/v1/conversations/templates/{id}

# 참가자 관리
POST   /api/v1/conversations/templates/{id}/participants
PUT    /api/v1/conversations/templates/{id}/participants/{pid}
DELETE /api/v1/conversations/templates/{id}/participants/{pid}
```

### 4.2 세션 관리

```yaml
# 세션 실행
POST   /api/v1/conversations/sessions
       Request: { template_id, config_id? }
       Response: { session_id, webrtc_config }

GET    /api/v1/conversations/sessions/{id}
PUT    /api/v1/conversations/sessions/{id}/next-turn
POST   /api/v1/conversations/sessions/{id}/user-input
       Request: { audio_base64 } or { text }
DELETE /api/v1/conversations/sessions/{id}  # 세션 종료
```

### 4.3 측정 설정

```yaml
# 측정 설정 CRUD
POST   /api/v1/conversations/measurement-configs
GET    /api/v1/conversations/measurement-configs
GET    /api/v1/conversations/measurement-configs/{id}
PUT    /api/v1/conversations/measurement-configs/{id}
DELETE /api/v1/conversations/measurement-configs/{id}

# 세션 메트릭 조회
GET    /api/v1/conversations/sessions/{id}/metrics
```

### 4.4 STT/TTS

```yaml
# STT (음성 → 텍스트)
POST   /api/v1/conversations/stt
       Request: { audio_base64, language_code }
       Response: { transcript, confidence, latency_ms }

# TTS (텍스트 → 음성)
POST   /api/v1/conversations/tts
       Request: { text, voice_name, language_code }
       Response: { audio_base64, audio_url, latency_ms }
```

### 4.5 WebRTC Signaling

```yaml
# WebSocket 엔드포인트
WS /api/v1/conversations/sessions/{id}/ws

# 메시지 타입
- join: 세션 참가
- offer: WebRTC SDP offer
- answer: WebRTC SDP answer
- ice-candidate: ICE candidate 교환
- turn-start: 턴 시작 알림
- turn-end: 턴 종료 알림
- user-speaking: 사용자 발화 중
- ai-speaking: AI 발화 중
```

---

## 5. 기능 명세

### 5.1 템플릿 관리

#### 5.1.1 템플릿 생성/수정

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | O | 템플릿 이름 |
| description | string | X | 설명 |
| scene_context | string | O | 공유 상황 설명 (모든 AI에게 전달) |
| topic_prompt | string | O | 대화 주제 프롬프트 |
| conversation_mode | enum | O | 턴제/자유난입 |
| max_rounds | int | X | 최대 라운드 수 (기본: 5) |

#### 5.1.3 AI 프롬프트 구성

AI가 받는 최종 프롬프트는 다음과 같이 조합됨:

```
[Scene Context]         ← 템플릿에서 설정 (공유)
+
[Topic Prompt]          ← 템플릿에서 설정 (공유)
+
[Individual Prompt]     ← 참가자별 system_prompt (개별)
+
[Conversation History]  ← 실시간 대화 기록
```

예시:
```
Scene Context:
"우리는 카페에서 친구들끼리 만나 취미에 대해
이야기하는 중입니다. 분위기는 편안하고 캐주얼합니다.
학습자는 영어를 배우는 중이니 천천히, 쉬운 표현으로 말해주세요."

Topic:
"오늘의 주제: 요즘 관심있는 취미"

Individual (Sarah):
"You are Sarah, a friendly college student who loves cooking.
Speak casually and use simple expressions."
```

#### 5.1.2 참가자 설정

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| participant_type | enum | O | MODERATOR/AI/USER |
| name | string | O | 표시 이름 (Sarah, Mike 등) |
| persona | string | O | 페르소나 설명 |
| system_prompt | string | O | 시스템 프롬프트 |
| model_name | string | O | AI 모델 |
| voice_name | string | O | TTS 음성 |
| speaking_order | int | O | 발화 순서 |

### 5.2 세션 실행

#### 5.2.1 턴제 모드 흐름

```
1. 세션 시작 → WebRTC 연결
2. Round 1:
   a. Moderator 발화 (TTS)
   b. AI 참가자들 순서대로 발화 (TTS)
   c. Moderator가 사용자에게 질문
3. 사용자 턴:
   a. 상태: WAITING_USER
   b. 사용자 음성 입력 (STT)
   c. 타임스탬프 기록
4. Round 2+:
   a. Moderator 피드백
   b. AI들 반응
   c. 반복
5. max_rounds 도달 또는 사용자 종료 → COMPLETED
```

#### 5.2.2 자유난입 모드 흐름

```
1. 세션 시작 → WebRTC 연결
2. VAD (Voice Activity Detection) 활성화
3. 누구든 발화 시작 감지 → 다른 참가자 음소거
4. 발화 종료 감지 → 다음 발화자 대기
5. 사용자 발화 감지 시:
   a. 즉시 STT 처리
   b. AI 응답 생성
   c. TTS 재생
6. 세션 종료
```

### 5.3 측정 구간 설정

#### 5.3.1 포인트 정의

| 필드 | 타입 | 설명 |
|------|------|------|
| point_key | string | 고유 키 (t0, t1, custom1 등) |
| point_name | string | 표시 이름 |
| event_type | enum | 이벤트 타입 |

#### 5.3.2 구간 정의

| 필드 | 타입 | 설명 |
|------|------|------|
| interval_name | string | 구간 이름 (E2E, ASR 등) |
| start_point | string | 시작 포인트 키 |
| end_point | string | 종료 포인트 키 |

### 5.4 판정 기준

| 지표 | Go (Scale) | Iterate | Stop |
|------|------------|---------|------|
| E2E 평균 | ≤ 3.0s | 3-5s | ≥ 5s |
| E2E p95 | ≤ 5.0s | 5-8s | ≥ 8s |
| 재시도 | ≤ 1회/턴 | 2회/턴 | > 2회/턴 |

---

## 5.5 학습 지원 설정 (서비스 기획)

학습자의 레벨과 학습 목표에 맞춰 AI의 발화 방식을 조절할 수 있습니다.

### 5.5.1 TTS 설정 (발화 스타일)

| 설정 | 설명 | 학습 효과 |
|------|------|----------|
| **발화 속도** (0.5x ~ 2.0x) | AI 음성 재생 속도 조절 | 초급자는 느리게, 고급자는 빠르게 |
| **음성 높낮이** (-20 ~ +20) | 목소리 톤 조절 | 다양한 화자 구분, 자연스러움 |
| **문장 간 쉼** (500 ~ 3000ms) | 문장 사이 일시 정지 | 이해 시간 확보, 따라말하기 연습 |

#### 사용 시나리오
```
[초급자 설정]
- 발화 속도: 0.7x
- 문장 간 쉼: 2000ms
→ 천천히 말하고 충분한 이해 시간 제공

[고급자 설정]
- 발화 속도: 1.2x
- 문장 간 쉼: 500ms
→ 원어민 수준의 빠른 대화 연습
```

### 5.5.2 LLM 대화 스타일 설정

| 설정 | 옵션 | 학습 효과 |
|------|------|----------|
| **어휘 난이도** | beginner / intermediate / advanced | 학습자 수준에 맞는 단어 사용 |
| **문장 복잡도** | simple / moderate / complex | 단문 → 복문 단계적 학습 |
| **필러 워드** | on / off | "umm", "well" 등 자연스러운 대화 연습 |
| **문법 엄격성** | casual / standard / formal | 일상 대화 vs 비즈니스 영어 |
| **피드백 상세도** | brief / normal / detailed | 간단한 칭찬 vs 상세한 교정 설명 |

#### 어휘 난이도 예시
```
[Beginner]
"I like to cook. It's fun. I make pasta."

[Intermediate]
"Cooking has become my favorite hobby lately. 
I especially enjoy making Italian dishes."

[Advanced]
"I've developed quite a passion for culinary arts. 
There's something therapeutic about crafting an elaborate meal from scratch."
```

### 5.5.3 상호작용 설정

| 설정 | 옵션 | 학습 효과 |
|------|------|----------|
| **재요청 시 반복** | on / off | "다시 말해줘" 요청 시 같은 내용 반복 |
| **자동 느리게** | on / off | 사용자가 어려워하면 자동으로 속도 낮춤 |
| **힌트 제공** | never / sometimes / always | 사용자가 막힐 때 표현 힌트 제공 |
| **교정 방식** | direct / indirect / recast | 오류 수정 스타일 선택 |

#### 교정 방식 예시
```
[사용자 발화] "I goed to the store yesterday."

[Direct - 직접 교정]
"It's 'went', not 'goed'. The past tense of 'go' is 'went'."

[Indirect - 간접 교정]  
"Hmm, can you think about the past tense of 'go'?"

[Recast - 재구성]
"Oh, you went to the store yesterday? What did you buy?"
```

---

## 5.6 실험 로그 시스템 (서비스 기획)

모든 대화 세션의 상세 데이터를 기록하여 분석 및 개선에 활용합니다.

### 5.6.1 턴별 상세 로그

각 발화마다 다음 정보를 기록합니다:

| 항목 | 설명 | 활용 |
|------|------|------|
| **STT 원본 결과** | 음성 인식 원문 | 인식 품질 분석 |
| **STT 신뢰도** (0~1) | 인식 정확도 점수 | 낮으면 재시도 유도 |
| **사용 모델** | 실제 사용된 LLM | 모델별 성능 비교 |
| **사용 음성** | 실제 사용된 TTS | 음성별 선호도 분석 |
| **토큰 수** | 입력/출력 토큰 | 비용 계산 |
| **실행 시간** | 각 단계별 소요 시간 | 병목 지점 파악 |

### 5.6.2 세션 종료 시 집계 로그

세션 완료 후 자동으로 생성되는 요약 데이터:

| 항목 | 설명 |
|------|------|
| **총 라운드/턴 수** | 대화 분량 |
| **총 토큰 (입력/출력)** | 전체 LLM 사용량 |
| **예상 비용 (USD)** | API 비용 추정치 |
| **평균 E2E 지연** | 반응 시간 평균 |
| **p95 E2E 지연** | 95% 백분위 지연 |
| **재시도 횟수** | STT 실패 후 재시도 |
| **에러 수** | 발생한 오류 |
| **AI 생성 요약** | 대화 내용 자동 요약 |
| **사용자 피드백** | 선택적 텍스트 피드백 |
| **사용자 평점** | 1~5점 만족도 |

### 5.6.3 로그 활용 시나리오

```
[기술 분석]
- E2E 지연이 높은 세션 필터링 → 병목 원인 분석
- STT 신뢰도가 낮은 음성 패턴 파악 → 음성 모델 개선

[학습 분석]
- 사용자가 자주 막히는 표현 패턴 파악
- 어휘 난이도별 학습 완료율 비교
- 교정 방식별 학습 효과 측정

[비용 최적화]
- 모델별 토큰 사용량 비교
- 세션당 평균 비용 추적
```

---

## 5.7 사용자 경험 (UX) 설계

### 5.7.1 학습자 여정

```
1. [세션 시작] 
   → 템플릿 선택 또는 자동 추천
   
2. [대화 진행]
   → AI들의 대화 청취
   → 내 차례에 발화
   → 실시간 피드백 수신
   
3. [세션 종료]
   → AI 요약 제공
   → 피드백 입력 (선택)
   → 다음 세션 추천
```

### 5.7.2 피드백 수집 포인트

| 시점 | 피드백 유형 | 목적 |
|------|-------------|------|
| 세션 중 | "다시 말해줘" 버튼 | 이해도 파악 |
| 세션 종료 | 만족도 평점 (1~5) | 전반적 만족도 |
| 세션 종료 | 텍스트 피드백 | 상세 의견 수집 |

---

## 6. UI 설계

### 6.1 Admin 메뉴 구조

```
AI Agent Lab
├── 📋 파이프라인 (기존)
├── 🗣️ 대화 시나리오 검증 (신규)
│   ├── 템플릿 관리
│   ├── 세션 실행
│   ├── 측정 설정
│   └── 결과 대시보드
└── 📊 실험 로그 (기존)
```

### 6.2 템플릿 관리 화면

```
┌─────────────────────────────────────────────────────────────┐
│ 대화 템플릿 관리                              [+ 새 템플릿] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📝 기본 정보                                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 템플릿 이름: [My Turn 취미 대화        ]                │ │
│ │ 설명:       [취미에 대해 이야기하는 다자 대화]          │ │
│ │ 대화 모드:  (●) 턴제  ( ) 자유난입                      │ │
│ │ 최대 라운드: [5]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🌍 공유 상황 설명 (Scene Context)                       │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ [우리는 카페에서 친구들끼리 만나 취미에 대해           ] │
│ │ [이야기하는 중입니다. 분위기는 편안하고 캐주얼합니다.  ] │
│ │ [학습자는 영어를 배우는 중이니 쉬운 표현으로 말해주세요] │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💬 대화 주제                                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ [오늘의 주제: 요즘 관심있는 취미에 대해 이야기해봅시다 ] │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👥 참가자 설정                           [+ 참가자 추가] │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 순서 │ 타입      │ 이름    │ 모델          │ 음성       │ │
│ │ ──── │ ───────── │ ─────── │ ───────────── │ ────────── │ │
│ │ 0    │ MODERATOR │ Host    │ gemini-2.5-pro│ en-US-A    │ │
│ │ 1    │ AI        │ Sarah   │ gemini-2.5-fl │ en-US-B    │ │
│ │ 2    │ AI        │ Mike    │ gemini-2.5-fl │ en-US-C    │ │
│ │ 99   │ USER      │ 학습자  │ -             │ -          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [취소]  [저장]  [세션 시작 →]  │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 세션 실행 화면

```
┌─────────────────────────────────────────────────────────────┐
│ 🗣️ 대화 세션                          Round 2/5  [종료]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 대화 로그                                               │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🎙️ Host: Today, let's talk about hobbies!              │ │
│ │                                                         │ │
│ │ 👩 Sarah: I've been into baking lately...              │ │
│ │          [▶️ 재생] E2E: 2.1s                            │ │
│ │                                                         │ │
│ │ 👨 Mike: Nice! For me, I enjoy hiking...               │ │
│ │          [▶️ 재생] E2E: 1.8s                            │ │
│ │                                                         │ │
│ │ 🎙️ Host: Great! Now, how about you?                    │ │
│ │                                                         │ │
│ │ 🟢 Your turn...                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                      [🎤 말하기]                         │ │
│ │                                                         │ │
│ │        클릭하여 발화를 시작하세요                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📊 현재 세션 메트릭                                     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ E2E 평균: 1.95s │ ASR 평균: 0.8s │ 재시도: 0회          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 측정 설정 화면

```
┌─────────────────────────────────────────────────────────────┐
│ 📏 측정 구간 설정                         [+ 새 설정 추가]  │
├─────────────────────────────────────────────────────────────┤
│ 설정 선택: [기본 설정 (Default) ▼]                          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📍 측정 포인트                           [+ 포인트 추가] │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 키    │ 이름     │ 이벤트 타입              │ 삭제      │ │
│ │ ───── │ ──────── │ ──────────────────────── │ ───────── │ │
│ │ t0    │ 발화종료 │ [user_speech_end      ▼] │ 🗑️        │ │
│ │ t1    │ STT완료  │ [stt_final            ▼] │ 🗑️        │ │
│ │ t2    │ LLM완료  │ [llm_final            ▼] │ 🗑️        │ │
│ │ t3    │ TTS시작  │ [tts_audio_start      ▼] │ 🗑️        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📐 측정 구간                              [+ 구간 추가]  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 구간명 │ 시작    │ 종료    │ 삭제                       │ │
│ │ ────── │ ─────── │ ─────── │ ───────                    │ │
│ │ E2E    │ [t0 ▼]  │ [t3 ▼]  │ 🗑️                         │ │
│ │ ASR    │ [t0 ▼]  │ [t1 ▼]  │ 🗑️                         │ │
│ │ LLM    │ [t1 ▼]  │ [t2 ▼]  │ 🗑️                         │ │
│ │ TTS    │ [t2 ▼]  │ [t3 ▼]  │ 🗑️                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🎯 판정 기준                                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ E2E 평균 목표: [3.0]s  │  E2E p95 목표: [5.0]s          │ │
│ │ 재시도 허용: [1]회                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                                        [취소]  [저장]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 구현 일정

### Phase 0: Voice Tech Baseline (D1-D4) = RUN0

> **참고**: Phase 0는 "RUN0"라고도 불립니다. 기술 베이스라인 측정을 위한 최소 구현 단계입니다.

| Day | 작업 | 담당 |
|-----|------|------|
| D1 | Google STT 연동 + TTS 멀티보이스 | Backend |
| D1 | 타임스탬프 로깅 API | Backend |
| D2 | 측정 구간 설정 UI | Frontend |
| D2 | 1차 측정 (10회) | QA |
| D3 | 병목 분석 + 개선 | Backend |
| D4 | 재측정 → 판정 | All |

### Phase 1: 템플릿 관리 (D5)

| 작업 | 담당 |
|------|------|
| DB 모델 + 마이그레이션 | Backend |
| 템플릿 CRUD API | Backend |
| Admin 템플릿 UI | Frontend |

### Phase 2: 세션 실행 - 턴제 (D6-D7)

| 작업 | 담당 |
|------|------|
| 세션 상태 관리 | Backend |
| 턴 순서 제어 로직 | Backend |
| Signaling Server (WebSocket) | Backend |
| 대화 UI | Frontend |

### Phase 3: WebRTC + 자유난입 (D8-D10)

| 작업 | 담당 |
|------|------|
| WebRTC 연결 구축 | Backend + Frontend |
| 음성 스트리밍 | Backend |
| VAD 연동 | Backend |
| 자유난입 모드 구현 | All |
| A/B 비교 실험 | All |

---

## 8. 테스트 계획

### 8.1 RUN 0 발화 스크립트

1. "Hi, can you hear me?"
2. "I'm testing a multi-person English conversation demo."
3. "I watched a video about Taylor Swift and New York."
4. "I need a table for ten people and three sessions."
5. "Wait—really? That's amazing!"

### 8.2 측정 항목 및 타임스탬프 표준

#### 타임스탬프 정의

| 타임스탬프 | 위치 | 설명 |
|------------|------|------|
| `t0_user_end` | 클라이언트 | Stop 버튼 클릭 시점 |
| `t1_asr_final` | 서버 | STT 결과 도착 |
| `t2_llm_final` | 서버 | LLM 최종 텍스트 생성 완료 |
| `t2_5_tts_ready` | 서버 | TTS 바이너리/URL 준비 완료 |
| `t3_audio_play_start` | 클라이언트 | 브라우저 재생 시작 |

#### 측정 구간

| 항목 | 계산 | 설명 |
|------|------|------|
| **E2E (user-perceived)** | t3 - t0 | ✅ 핵심 지표 |
| **Server E2E** | t2_5 - t0 | 네트워크/재생 변수 제외 |
| ASR Latency | t1 - t0 | STT 처리 시간 |
| LLM Latency | t2 - t1 | LLM 응답 시간 |
| TTS Latency | t2_5 - t2 | TTS 생성 시간 |
| 재시도 횟수 | 카운트 | STT 실패 후 재시도 |
| 에러율 | 실패/전체 | 전체 오류 비율 |

### 8.3 성공 기준

- E2E 평균 ≤ 3.0s
- E2E p95 ≤ 5.0s
- 재시도 ≤ 1회/턴

---

## 9. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| E2E 지연 초과 | 사용자 경험 저하 | 병목 분석 후 개선 |
| WebRTC 연결 불안정 | 대화 끊김 | TURN 서버 설정 |
| STT 오인식 | 학습 방해 | 재시도 UX + 수동 입력 |
| 자유난입 화자 분리 | 혼란 | VAD 튜닝 |

## 10. RUN0 기술 구현 주의사항

### 10.1 오디오 포맷 변환 ⚠️ 핵심

> 브라우저 녹음 포맷(WebM/Opus)을 STT가 바로 못 받는 경우가 많음.
> **서버에서 Linear16 WAV (16kHz, mono)로 변환 필수**

```python
# ffmpeg 사용 예시
import subprocess

def convert_to_linear16(input_path: str, output_path: str):
    subprocess.run([
        "ffmpeg", "-i", input_path,
        "-ar", "16000",      # 16kHz
        "-ac", "1",          # mono
        "-f", "wav",         # WAV format
        "-acodec", "pcm_s16le",  # Linear16
        output_path
    ], check=True)
```

### 10.2 RUN0 타임스탬프 표준

| 타임스탬프 | 위치 | 설명 |
|------------|------|------|
| `t0_user_end` | 클라이언트 | Stop 버튼 클릭 시점 |
| `t1_asr_final` | 서버 | STT 결과 도착 |
| `t2_llm_final` | 서버 | LLM 최종 텍스트 생성 완료 |
| `t2_5_tts_ready` | 서버 | TTS 바이너리/URL 준비 완료 |
| `t3_audio_play_start` | 클라이언트 | 브라우저 재생 시작 |

**파생 지표:**
- **E2E (user-perceived)** = t3 - t0 ✅ 핵심
- **Server E2E** = t2_5 - t0 (네트워크/재생 변수 제외)

### 10.3 API 엔드포인트 설계 단순 참고

```yaml
# 음성 처리
POST /api/v1/run0/voice
  Request: 
    - audio: File (webm/opus)
    - session_id: string (optional)
  Response:
    - session_id: string
    - transcript: string
    - reply_text: string
    - audio_url: string (or audio_base64)
    - timestamps:
        t1_asr_final: int
        t2_llm_final: int
        t2_5_tts_ready: int

# 클라이언트 타임스탬프 로깅
POST /api/v1/run0/log
  Request:
    - session_id: string
    - t0_user_end: int
    - t3_audio_play_start: int
```

> **왜 분리?** t3는 클라이언트에서만 아는 값이라 /log를 분리하는 게 안전.

### 10.4 로그 스키마 단순 참고

```python
class Run0Log:
    # 식별자
    run_id: str                    # "RUN0"
    pipeline_id: str               # "RUN0_VoiceBaseline"
    session_id: str
    participant_id: str | None     # 내부 테스트면 optional
    
    # 환경
    device_type: str               # "pc" / "mobile"
    browser: str | None            # optional
    variant: str                   # "A" / "B"
    
    # 오디오
    audio_duration_ms: int
    audio_encoding_in: str         # "webm_opus"
    audio_encoding_stt: str        # "linear16_16k_mono"
    
    # 타임스탬프 (ms)
    t0_user_end: int
    t1_asr_final: int
    t2_llm_final: int
    t2_5_tts_ready: int
    t3_audio_play_start: int
    
    # 결과
    asr_retry_count: int
    error_code: str | None
    transcript_len: int
    reply_len: int
    
    # 설정
    stt_provider: str              # "google"
    tts_provider: str              # "google"
    tts_voice: str                 # "en-US-Standard-C"
    llm_model: str                 # gemini model name
```

