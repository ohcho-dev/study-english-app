# My Turn 다자 대화 시스템 기능 명세

> **작성일**: 2026-02-09  
> **버전**: 1.0  
> **상태**: Draft

---

## 1. 개요

### 1.1 My Turn이란?

"My Turn"은 **여러 참여자가 순서대로 발화하는 턴제 대화 시스템**입니다.

```
┌──────────────────────────────────────────────────────┐
│  참여자 구성 예시                                     │
├──────────────────────────────────────────────────────┤
│  👩‍💼 Moderator (Lily) - 진행자, 상황 안내             │
│  ☕ AI (Sarah) - 바리스타                             │
│  👤 User (철수) - 학습자                              │
│  👨‍🍳 AI (Mike) - 다른 직원 (선택적)                  │
└──────────────────────────────────────────────────────┘
```

### 1.2 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **턴 기반** | 정해진 순서대로 발화 |
| **유연한 참여자** | 1명~N명의 AI 참여자 |
| **설정 가능** | 모든 동작을 Admin에서 설정 |

---

## 2. 참여자 시스템

### 2.1 참여자 유형

| 유형 | 역할 | 발화 시점 |
|------|------|----------|
| **Moderator** | 진행자, 상황 안내 | 시작 시, 전환 시 |
| **AI** | 대화 상대 (1~N명) | 턴 순서에 따라 |
| **User** | 학습자 | 자신의 턴에 |

### 2.2 참여자 속성 (Admin 설정)

```yaml
participant:
  name: "Sarah"           # 표시 이름
  type: "ai"              # moderator | ai | user
  persona: "친절한 바리스타" # AI 성격 설명
  voice_id: "en-US-Wavenet-F"  # TTS 음성
  avatar_url: "/avatars/sarah.png"  # 아바타 이미지
  greeting_message: "Hi! Welcome to our cafe!"  # 첫 인사
  speak_order: 2          # 발화 순서 (1부터 시작)
```

---

## 3. 대화 시작 플로우

### 3.1 첫 발화자 설정 (Admin)

> **누가 먼저 말하는가?**

| 옵션 | 설명 | 사용 사례 |
|------|------|----------|
| **Moderator First** | 진행자가 상황 안내 | "지금부터 카페 주문을 연습합니다" |
| **AI First** | AI가 먼저 말함 | 바리스타: "Hi, what can I get for you?" |
| **User First** | 사용자가 먼저 | 고객이 먼저 말해야 하는 상황 |

### 3.2 시작 플로우 예시

```
[세션 시작]
    │
    ▼
┌─────────────────────────────────────┐
│ 1️⃣ Moderator (Lily)                │
│ "You're at a coffee shop.           │
│  Order an iced americano."          │
│ 🔊 TTS 자동 재생                    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2️⃣ AI (Sarah)                      │
│ "Hi there! Welcome to Blue Sky Cafe.│
│  What can I get for you today?"     │
│ 🔊 TTS 자동 재생                    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3️⃣ User Turn (녹음 활성화)         │
│ 🎤 "I'd like an iced americano"     │
└─────────────────────────────────────┘
```

---

## 4. 턴 관리 시스템

### 4.1 턴 순서 정의 (Admin)

```yaml
turn_sequence:
  mode: "fixed"  # fixed | dynamic | free_form
  sequence:
    - type: "moderator"     # 1번: Moderator 안내
    - type: "ai"
      participant_id: "sarah"  # 2번: Sarah
    - type: "user"          # 3번: 사용자
    - type: "ai"
      participant_id: "sarah"  # 4번: Sarah 응답
    # ... 반복 또는 종료
```

### 4.2 턴 모드

| 모드 | 설명 | 사용 사례 |
|------|------|----------|
| **Fixed** | 정해진 순서 고정 | 카페 주문 (정해진 대화) |
| **Dynamic** | AI가 상황에 따라 판단 | 자연스러운 대화 |
| **Free Form** | 누구나 자유롭게 | 토론, 자유 대화 |

### 4.3 현재 발화자 추적

```typescript
interface TurnState {
  currentSpeaker: ParticipantId;
  turnNumber: number;
  waitingFor: 'user' | 'ai' | 'moderator';
  canUserSpeak: boolean;  // 사용자 녹음 버튼 활성화 여부
}
```

---

## 5. 다중 AI 참여자

### 5.1 여러 AI 구분

```
시나리오: "레스토랑에서 식사"

👩‍💼 Lily (Moderator): "You're at a restaurant..."
👩‍🍳 Emma (Host): "Welcome! Table for one?"
👨‍🍳 Mike (Waiter): "Hi, I'll be your server. May I take your order?"
👤 User: "..." (학습자)
```

### 5.2 AI별 컨텍스트 공유

```yaml
# 모든 AI가 알아야 할 정보
shared_context:
  场景: "레스토랑"
  user_name: "철수"
  difficulty: 2
  
# AI별 개인 컨텍스트
sarah_context:
  role: "바리스타"
  knows_user_order: true
  
mike_context:
  role: "매니저"
  enters_scene_at: turn_5  # 5번째 턴에 등장
```

---

## 6. Admin 설정 UI

### 6.1 템플릿 설정 화면

```
┌─────────────────────────────────────────────────┐
│ 📝 템플릿 편집: 카페에서 주문하기               │
├─────────────────────────────────────────────────┤
│                                                 │
│ ▶ 기본 정보                                     │
│   이름: [카페에서 주문하기        ]             │
│   난이도: [★★☆☆☆]                             │
│   예상 시간: [5] 분                             │
│                                                 │
│ ▶ 시작 설정                                     │
│   첫 발화자: [◉ Moderator ○ AI ○ User]         │
│   턴 모드:   [◉ Fixed ○ Dynamic ○ Free]        │
│                                                 │
│ ▶ 참여자 (3명)                                  │
│   ┌──────────────────────────────────────┐      │
│   │ 1. 👩‍💼 Lily (Moderator)   [편집][삭제]│      │
│   │ 2. ☕ Sarah (AI)          [편집][삭제]│      │
│   │ 3. 👤 User (학습자)       [편집][삭제]│      │
│   │ [+ 참여자 추가]                      │      │
│   └──────────────────────────────────────┘      │
│                                                 │
│ ▶ 턴 순서 (5턴)                                 │
│   1. Moderator: 상황 안내                       │
│   2. Sarah: 인사                                │
│   3. User: 주문                                 │
│   4. Sarah: 확인                                │
│   5. User: 결제 요청                            │
│   [+ 턴 추가]                                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.2 참여자 편집 모달

```
┌────────────────────────────────────┐
│ 👤 참여자 편집                     │
├────────────────────────────────────┤
│ 이름: [Sarah                  ]    │
│ 유형: [◉ AI ○ Moderator ○ User]   │
│                                    │
│ 페르소나:                          │
│ ┌────────────────────────────────┐ │
│ │ 친절하고 밝은 바리스타.        │ │
│ │ 고객에게 항상 미소를 짓는다.   │ │
│ └────────────────────────────────┘ │
│                                    │
│ 첫 인사:                           │
│ [Hi! Welcome to our cafe!     ]    │
│                                    │
│ 음성: [en-US-Wavenet-F ▼]          │
│ 아바타: [이미지 업로드]            │
│                                    │
│ 발화 순서: [2] 번째                │
│                                    │
│ [취소]              [저장]         │
└────────────────────────────────────┘
```

---

## 7. 추가 기능

### 7.1 힌트 시스템

| 기능 | 설명 |
|------|------|
| **표현 힌트** | 사용자 턴에 예시 표현 제공 |
| **단어 힌트** | 어려운 단어 뜻 제공 |
| **문장 구조 힌트** | "I'd like..." 형태로 안내 |
| **자동 힌트** | 침묵 시 자동 표시 |

### 7.2 피드백 시스템

```yaml
feedback_options:
  pronunciation_score: true      # 발음 점수
  grammar_check: true            # 문법 체크
  natural_expression: true       # 더 자연스러운 표현 추천
  vocabulary_alternatives: true  # 동의어 제안
```

### 7.3 분기 대화

```
사용자가 "I don't have cash" 라고 말하면:
  → AI: "No problem, we accept cards too!"
  → 새로운 분기 시작

사용자가 "Just an americano" 라고 말하면:
  → AI: "Would you like it hot or iced?"
  → 추가 질문 분기
```

### 7.4 감정/톤 설정

```yaml
participant_emotions:
  sarah:
    default: "friendly"
    when_busy: "hurried but polite"
    when_error: "apologetic"
```

### 7.5 배경/상황 설정

```yaml
scene:
  background_video: "/videos/cafe_morning.mp4"
  ambient_sound: "/audio/cafe_ambience.mp3"
  time_of_day: "morning"
  customer_count: "busy"  # affects AI behavior
```

---

## 8. 데이터베이스 변경사항

### 8.1 새로운/수정 필드

```python
# conversation_templates 테이블 추가 필드
first_speaker: Enum('moderator', 'ai', 'user')  # 첫 발화자
turn_mode: Enum('fixed', 'dynamic', 'free_form')  # 턴 모드
max_turns: Optional[int]  # 최대 턴 수

# conversation_participants 테이블 추가 필드
avatar_url: Optional[str]  # 아바타 이미지
speak_order: int  # 발화 순서
greeting_message: Optional[str]  # 첫 인사
persona_for_llm: Optional[str]  # LLM용 상세 설명

# conversation_sessions 테이블 추가 필드
current_turn: int  # 현재 턴 번호
current_speaker_id: UUID  # 현재 발화자
user_name: str  # 사용자 이름
```

### 8.2 새로운 테이블

```python
# 턴 순서 정의 (Fixed 모드용)
class TurnSequence(Base):
    template_id: UUID
    turn_number: int
    participant_id: UUID
    expected_action: Optional[str]  # 예상 동작/발화
    hint_text: Optional[str]  # 힌트
```

---

## 9. API 변경사항

### 9.1 새로운 엔드포인트

```yaml
# 세션 시작 시 사용자 이름 포함
POST /api/v1/conversations/sessions
  body: { template_id, user_name, difficulty }

# 다음 턴 가져오기
GET /api/v1/conversations/sessions/{id}/next-turn
  response: { speaker, is_user_turn, hint }

# 턴 순서 설정
PUT /api/v1/conversations/templates/{id}/turn-sequence
  body: [{ turn_number, participant_id, hint }]
```

### 9.2 수정된 음성 처리

```yaml
POST /api/v1/conversations/run0/voice
  body:
    audio_file: ...
    session_id: ...
    user_name: "철수"  # 추가
  response:
    transcript: "..."
    reply_text: "..."
    reply_speaker: "Sarah"  # 누가 응답했는지
    next_speaker: "user"    # 다음 발화자
    is_session_complete: false
```

---

## 10. 구현 우선순위

| 우선순위 | 기능 | 복잡도 | 시간 |
|---------|------|--------|------|
| 🔴 P0 | 참여자 정보 LLM 주입 | 낮음 | 30분 |
| 🔴 P0 | 사용자 이름 입력 | 낮음 | 20분 |
| 🔴 P0 | 첫 발화자 설정 | 중간 | 45분 |
| 🟡 P1 | 자동 greeting 재생 | 중간 | 1시간 |
| 🟡 P1 | 턴 순서 UI | 중간 | 1시간 |
| 🟡 P1 | 현재 발화자 표시 | 낮음 | 30분 |
| 🟢 P2 | 분기 대화 | 높음 | 3시간 |
| 🟢 P2 | 힌트 시스템 | 중간 | 2시간 |
| 🟢 P2 | 피드백/점수 | 높음 | 4시간 |

---

## 11. 다음 단계

위 기능 중 **P0 (필수)** 항목부터 순차 구현:

1. 참여자 정보 LLM 주입
2. 사용자 이름 입력
3. 첫 발화자 설정 (Admin)
4. 자동 greeting 재생

**승인 시 P0부터 구현 시작합니다.**
