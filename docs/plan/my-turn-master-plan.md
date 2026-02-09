# My Turn 대화 시스템 - 마스터 구현 계획서

> **작성일**: 2026-02-09  
> **버전**: 2.0  
> **상태**: 검토 대기

---

## 1. 프로젝트 개요

### 1.1 목적

"My Turn" 학습 시나리오의 **완전한 다자 대화 시스템** 구축.

> **My Turn이란?**  
> 여러 AI와 Moderator가 참여하는 대화에서, 사용자가 자신의 차례(My Turn)에
> 앞사람의 패턴을 참고하여 발화하는 학습 방식.

### 1.2 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **WebRTC 기반** | 실시간 양방향 음성 통신 |
| **턴 기반 + 자유난입** | 두 가지 대화 모드 지원 |
| **Admin 설정 가능** | 모든 동작을 관리자가 제어 |
| **레이턴시 최적화** | E2E ≤ 3초 목표 |

---

## 2. 현재 상태 분석

### 2.1 완료된 항목 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| DB 모델 (템플릿, 세션, 참여자) | ✅ | 기본 구조 완료 |
| STT 서비스 (Google Cloud) | ✅ | HTTP 방식 |
| TTS 서비스 (Google Cloud) | ✅ | 멀티보이스 지원 |
| LLM 연동 (Gemini) | ✅ | 동작 확인 |
| 기본 Admin UI | ✅ | 템플릿/세션 관리 |
| 음성 녹음 (MediaRecorder) | ✅ | 파일 업로드 방식 |

### 2.2 미완료/수정 필요 항목 ❌

| 항목 | 현재 상태 | 목표 |
|------|----------|------|
| **WebRTC** | ❌ 미구현 | 실시간 스트리밍 |
| **참여자 정보 LLM 주입** | ❌ 미구현 | 모든 참여자 정보 포함 |
| **턴 관리 시스템** | ❌ 미구현 | 순서 기반 발화 제어 |
| **첫 발화자 설정** | ❌ 미구현 | Admin에서 설정 가능 |
| **사용자 이름** | ❌ 미구현 | 세션 시작 시 입력 |
| **자동 greeting** | ❌ 미구현 | Moderator/AI 첫 인사 |

---

## 3. 시스템 아키텍처

### 3.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin (Next.js)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │ 템플릿 관리  │  │  세션 실행   │  │  메트릭 대시보드  │     │
│  └─────────────┘  └──────────────┘  └─────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             │ WebRTC + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Server (FastAPI)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Signaling Server (WebSocket)               │   │
│  │  - SDP Offer/Answer                                   │   │
│  │  - ICE Candidates                                     │   │
│  │  - 턴 상태 동기화                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                               │
│  ┌────────────┐  ┌──────────┴─────────┐  ┌────────────┐    │
│  │  STT 서비스 │  │   대화 오케스트레이터  │  │ TTS 서비스 │    │
│  │  (스트리밍) │◄─┤   (턴 관리/LLM)     ├─►│ (멀티보이스)│    │
│  └────────────┘  └────────────────────┘  └────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 WebRTC 구성

```
[Client (Browser)]                    [Server]
       │                                  │
       │◄─────── WebSocket ──────────────►│ Signaling
       │                                  │
       │◄══════ WebRTC Audio ════════════►│ Real-time Audio
       │  (실시간 양방향 오디오 스트림)     │
       │                                  │
```

### 3.3 데이터 흐름 (턴제 모드)

```
1. 세션 시작
   Client ─── WS: start_session ───► Server
   Client ◄── WS: session_started ── Server (참여자 정보 포함)

2. WebRTC 연결
   Client ◄──► WebRTC Signaling ◄──► Server

3. Moderator 인사
   Server: Greeting TTS 생성 → WebRTC 스트리밍
   Client: 오디오 재생
   Server ─── WS: turn_complete ───► Client

4. AI 발화
   Server: LLM 응답 → TTS → WebRTC 스트리밍
   Client: 오디오 재생
   Server ─── WS: user_turn ───► Client (녹음 버튼 활성화)

5. 사용자 발화
   Client: WebRTC로 오디오 스트리밍
   Server: 실시간 STT → 텍스트 수신
   Server ─── WS: transcript ───► Client (실시간 표시)
   
6. 반복...
```

---

## 4. 기능 명세

### 4.1 참여자 시스템

#### 4.1.1 참여자 유형

| 유형 | 역할 | 발화 시점 |
|------|------|----------|
| **Moderator** | 진행자 | 세션 시작, 상황 전환 |
| **AI** | 대화 상대 (1~N명) | 턴 순서에 따라 |
| **User** | 학습자 | 자신의 턴에 |

#### 4.1.2 참여자 속성 (Admin 설정)

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 표시 이름 |
| `type` | enum | moderator/ai/user |
| `persona` | text | 성격/역할 설명 |
| `system_prompt` | text | LLM 시스템 프롬프트 |
| `voice_id` | string | TTS 음성 |
| `speak_order` | int | 발화 순서 |
| `greeting_message` | text | 첫 인사 (선택) |
| `avatar_url` | string | 아바타 이미지 |

### 4.2 대화 시작 설정

#### 4.2.1 첫 발화자 (Admin 설정)

| 옵션 | 설명 |
|------|------|
| `moderator_first` | Moderator가 상황 안내 |
| `ai_first` | AI가 먼저 인사 |
| `user_first` | 사용자가 먼저 시작 |

#### 4.2.2 턴 모드

| 모드 | 설명 |
|------|------|
| `turn_based` | 정해진 순서대로 발화 |
| `free_form` | 누구나 자유롭게 (VAD 기반) |

### 4.3 턴 관리

#### 4.3.1 상태 관리

```typescript
interface TurnState {
  sessionId: string;
  currentTurnNumber: number;
  currentSpeaker: Participant;
  waitingFor: 'moderator' | 'ai' | 'user';
  isUserTurn: boolean;
  canRecord: boolean;
}
```

#### 4.3.2 상태 전이

```
SESSION_START
    │
    ▼
┌─────────────────┐
│ MODERATOR_TURN  │ ──► Greeting TTS 재생
└────────┬────────┘
         ▼
┌─────────────────┐
│    AI_TURN      │ ──► LLM 응답 → TTS
└────────┬────────┘
         ▼
┌─────────────────┐
│   USER_TURN     │ ──► 녹음 활성화, STT
└────────┬────────┘
         │
         ├──► AI_TURN (반복)
         │
         ▼
┌─────────────────┐
│   COMPLETED     │
└─────────────────┘
```

### 4.4 LLM 컨텍스트 구성

```python
def build_llm_context(session, current_speaker):
    return f"""
[Scene Context]
{template.scene_context}

[Participants]
{format_participants(session.participants)}

[Current Speaker]
You are {current_speaker.name}. {current_speaker.persona}

[User Information]
User name: {session.user_name}

[Conversation History]
{format_history(session.turns)}

[Your Individual Prompt]
{current_speaker.system_prompt}
"""
```

---

```python
def build_llm_context(session, current_speaker):
    return f"""
[Scene Context]
{template.scene_context}

[Participants]
{format_participants(session.participants)}

[Current Speaker]
You are {current_speaker.name}. {current_speaker.persona}

[User Information]
User name: {session.user_name}

[Conversation History]
{format_history(session.turns)}

[Your Individual Prompt]
{current_speaker.system_prompt}
"""
```

### 4.5 UI/UX 전략 (Phase 2+)

기존 `run0` 페이지와의 충돌을 방지하고 개발 효율성을 높이기 위해 다음과 같이 페이지를 분리합니다.

| 페이지 | 경로 | 목적 | 특징 |
|--------|------|------|------|
| **Latency Lab (Run0)** | `/conversations/run0` | 기술 검증 및 벤치마킹 | HTTP 방식, 레이턴시/메트릭 중심, WebRTC 미사용 |
| **My Turn (New)** | `/conversations/my-turn` | 실제 학습 시나리오 경험 | WebRTC 기반, 실시간/턴제 UI, 화려한 인터랙션 |

**템플릿 관리 전략**:
- **단일 소스 (Single Source)**: `Target Templates`는 공유합니다.
- **실행 모드 분리**: 템플릿 목록에서 "기술 테스트(Run0)"와 "시나리오 학습(My Turn)" 버튼을 분리하여 실행합니다.

#### 4.5.1 템플릿 관리 화면 (`/conversations/templates`)
- **통합 관리**: Run0용과 My Turn용 템플릿을 구분하지 않고 통합 관리합니다.
- **속성 확장**: 기존 템플릿 모델에 `turn_mode`, `first_speaker` 등 My Turn 전용 속성이 추가됩니다. (기존 Run0는 이 속성을 무시하거나 기본값 사용)

#### 4.5.2 템플릿 상세/편집 화면
- **확장된 폼**: My Turn 기능(턴 모드, 발화 순서 등)을 설정할 수 있는 필드를 추가합니다.
- **호환성 유지**: 기존 Run0 테스트를 위해 필수적인 필드(System Prompt, Voice ID 등)는 유지합니다.

---

## 5. 구현 계획

### 5.1 Phase 1: 기반 고도화 (D1-D2)

> **목표**: HTTP 방식 유지하면서 핵심 기능 완성

| 작업 | 우선순위 | 예상 시간 |
|------|---------|----------|
| 참여자 정보 LLM 주입 | P0 | 1h |
| 사용자 이름 입력 UI | P0 | 30m |
| 첫 발화자 설정 (Admin) | P0 | 1h |
| 자동 greeting 재생 | P1 | 1h |
| 턴 상태 관리 | P1 | 2h |
| 현재 발화자 표시 UI | P1 | 30m |

**산출물**:
- 참여자 정보가 LLM에 정상 주입
- 세션 시작 시 자동 인사
- 턴 순서에 따른 UI 제어

### 5.2 Phase 2: WebRTC 기반 구축 (D3-D5)

> **목표**: 실시간 음성 스트리밍 구현

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| WebSocket Signaling 서버 | Backend | 4h |
| WebRTC 연결 구현 | Frontend | 4h |
| 클라이언트 → 서버 오디오 스트리밍 | Full Stack | 4h |
| 서버 → 클라이언트 TTS 스트리밍 | Full Stack | 4h |
| 스트리밍 STT 연동 | Backend | 3h |

**산출물**:
- WebRTC 기반 실시간 오디오 스트리밍
- 녹음 완료 전에도 STT 시작 (레이턴시 감소)

### 5.3 Phase 3: 턴 관리 완성 (D6-D7)

> **목표**: 완전한 턴제 대화 시스템

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| 턴 순서 DB 스키마 | Backend | 2h |
| 턴 순서 설정 UI | Frontend | 3h |
| 서버 턴 오케스트레이터 | Backend | 4h |
| 클라이언트 턴 동기화 | Frontend | 3h |

**산출물**:
- Admin에서 턴 순서 정의 가능
- 자동 턴 전이
- 사용자 턴에만 녹음 활성화

### 5.4 Phase 4: 자유난입 모드 (D8-D10)

> **목표**: VAD 기반 자유 대화

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| VAD (Voice Activity Detection) | Backend | 4h |
| 화자 분리 로직 | Backend | 4h |
| 자유난입 모드 UI | Frontend | 3h |
| 침묵 감지 → AI 발화 | Backend | 3h |

**산출물**:
- 턴 순서 없이 자연스러운 대화
- 침묵 시 AI가 자동 발화

### 5.5 Phase 5: 최적화 및 고도화 (D11-D14)

| 작업 | 담당 | 예상 시간 |
|------|------|----------|
| 레이턴시 측정/분석 | All | 2h |
| TURN 서버 설정 | DevOps | 2h |
| 힌트 시스템 구현 | Full Stack | 4h |
| 피드백/발음 점수 | Full Stack | 6h |
| 분기 대화 지원 | Full Stack | 8h |

---

## 6. 데이터베이스 변경

### 6.1 수정할 테이블

```sql
-- conversation_templates
ALTER TABLE conversation_templates ADD COLUMN
  first_speaker VARCHAR(20) DEFAULT 'moderator',
  turn_mode VARCHAR(20) DEFAULT 'turn_based';

-- conversation_participants
ALTER TABLE conversation_participants ADD COLUMN
  greeting_message TEXT,
  avatar_url VARCHAR(255);

-- conversation_sessions
ALTER TABLE conversation_sessions ADD COLUMN
  user_name VARCHAR(100),
  current_turn_number INT DEFAULT 0,
  current_speaker_type VARCHAR(20);
```

### 6.2 새로운 테이블

```sql
-- 턴 순서 정의 (Fixed 모드용)
CREATE TABLE turn_sequences (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES conversation_templates(id),
  order_number INT NOT NULL,
  participant_id UUID REFERENCES conversation_participants(id),
  expected_action TEXT,
  hint_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. API 변경

### 7.1 새로운 엔드포인트

```yaml
# WebSocket Signaling
WS /ws/session/{session_id}
  Events:
    - start_session
    - session_started
    - webrtc_offer
    - webrtc_answer
    - ice_candidate
    - turn_changed
    - transcript (실시간 STT)
    - session_completed

# 세션 시작 (사용자 이름 포함)
POST /api/v1/conversations/sessions
  body: { template_id, user_name, difficulty }

# 턴 순서 설정
GET/PUT /api/v1/conversations/templates/{id}/turn-sequence
```

### 7.2 수정된 엔드포인트

```yaml
# 음성 처리 (참여자 정보 포함)
POST /api/v1/conversations/run0/voice
  response 추가:
    - next_speaker: string
    - is_session_complete: boolean
    - participants_context: object
```

### 7.3 상세 서버 로직 (Phase 2+)

#### 7.3.1 WebSocket 이벤트 핸들러 (`/ws/session/{id}`)

| 이벤트 명 | 방향 | 설명 | 페이로드 예시 |
|---|---|---|---|
| `start_session` | Client→Server | 세션 시작 요청 | `{ "user_name": "Hero" }` |
| `session_started` | Server→Client | 초기화 완료 및 참여자 정보 전송 | `{ "participants": [...], "sessionId": "..." }` |
| `webrtc_offer` | Client→Server | WebRTC 연결 요청 (SDP) | `{ "sdp": "...", "type": "offer" }` |
| `webrtc_answer` | Server→Client | WebRTC 연결 응답 (SDP) | `{ "sdp": "...", "type": "answer" }` |
| `ice_candidate` | Bidirectional | NAT 통과를 위한 후보군 교환 | `{ "candidate": "...", "sdpMid": "..." }` |
| `turn_changed` | Server→Client | 현재 발화자 변경 알림 | `{ "turnNumber": 1, "speaker": { "id": "...", "name": "AI1" } }` |
| `user_turn` | Server→Client | 사용자 발화 차례 시작 (녹음 활성화) | `{ "hint": "Say hello to AI" }` |
| `ai_speaking` | Server→Client | AI 발화 시작 알림 | `{ "text": "Hello, how are you?" }` |

#### 7.3.2 Turn Orchestrator (State Machine)

1.  **초기화 (`INIT`)**: DB 로드, 첫 턴 결정.
2.  **발화 전 처리 (`PRE_TURN`)**:
    *   `User`: `user_turn` 이벤트 전송.
    *   `AI/Moderator`: LLM/TTS 파이프라인 트리거.
3.  **발화 진행 (`SPEAKING`)**:
    *   **AI**: LLM 스트리밍 응답 → TTS → WebRTC 오디오.
    *   **User**: WebRTC 오디오 수신 → 실시간 STT → VAD 침묵 감지.
4.  **발화 후 처리 (`POST_TURN`)**: 대화 기록 저장, 다음 턴 결정, `turn_changed` 브로드캐스트.

#### 7.3.3 WebRTC 데이터 흐름

*   **Audio In (User)**: 브라우저 마이크 → WebRTC → Python Server (`aiortc`) → VAD Filter → Google STT.
*   **Audio Out (AI)**: Google TTS → PCM Audio → WebRTC → 브라우저 스피커.

---

## 8. 타임라인

```
Week 1 (D1-D7)
├── D1-D2: Phase 1 - 기반 고도화
├── D3-D5: Phase 2 - WebRTC 구축
└── D6-D7: Phase 3 - 턴 관리 완성

Week 2 (D8-D14)
├── D8-D10: Phase 4 - 자유난입 모드
└── D11-D14: Phase 5 - 최적화
```

---

## 9. 성공 기준

| 지표 | 목표 |
|------|------|
| E2E 레이턴시 (평균) | ≤ 3.0초 |
| E2E 레이턴시 (p95) | ≤ 5.0초 |
| WebRTC 연결 성공률 | ≥ 99% |
| STT 정확도 | ≥ 90% |

---

## 10. 다음 단계

**Phase 1부터 순차 진행.**

1. 참여자 정보 LLM 주입
2. 사용자 이름 입력
3. 첫 발화자 설정
4. ...

**승인 시 Phase 1 구현을 시작합니다.**
