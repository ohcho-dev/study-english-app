# 🎓 핵심 기능 2: 6인 그룹 순차 회화 시스템 (Round-Robin Conversation Engine)

> **기능 설명:** 1명의 관리자(Server)가 N명의 클라이언트(AI 5명 + User 1명)의 발언 권한을 제어
> **기술 목표:** 순차적 턴 관리, 앵커 AI 생성, 사용자 발화 평가 및 루프 제어

---

## 1. 시스템 개요

**중앙 집중형 상태 머신 (Centralized State Machine)**
- WebSocket으로 실시간 상태 동기화
- Gemini 3.0 Pro로 '모범 답안 생성' + '사용자 발화 평가'

---

## 2. 턴 관리자 (Turn Manager)

```python
class ClassroomSession:
    def __init__(self, topic):
        self.topic = topic
        self.participants = ["AI_1", "AI_2", "AI_3", "AI_4", "AI_5", "USER"]
        self.current_index = 0   # 0~5
        self.retry_count = 0     # 사용자 재시도 횟수
        self.max_retries = 2     # 최대 꼬리질문 횟수

    def next_turn(self):
        self.current_index += 1
        if self.current_index >= len(self.participants):
            return "SESSION_END"
        return self.participants[self.current_index]
```

---

## 3. 앵커링 (Anchoring) 전략

### 앵커 AI (AI_1) - Strict Mode
첫 번째 AI가 3문장 구조의 모범 답안 제시:

```
Role: You are the model student.

Constraint 1: Ensure the response is exactly 3 sentences.
Constraint 2: Structure must be [Opinion] -> [Personal Experience] -> [Reason].
Constraint 3: Use the keyword "{TOPIC}".
```

### 일반 AI (AI_2~5)
```
자연스럽게 대화해. 이전 맥락 유지.
```

---

## 4. 사용자 발화 평가 (Evaluation Pipeline)

### 평가 프롬프트
```
Analyze the user's audio based on the following criteria:
1. Structure: Does it contain at least 2-3 sentences? (Boolean)
2. Content: Is it relevant to the topic '{TOPIC}'? (Boolean)

Output Format (JSON):
{
  "is_passed": boolean,
  "deficiency": "too_short" | "off_topic" | "none",
  "follow_up_audio_script": "Generate a question asking for the reason (if failed)"
}
```

### 분기 처리 로직
```python
if evaluation.is_passed:
    session.next_turn()
else:
    session.retry_count += 1
    if session.retry_count < session.max_retries:
        # 꼬리질문 TTS 전송, 재입력 대기
        send_feedback(evaluation.follow_up_audio_script)
    else:
        # "Okay, good try." + 강제 다음 턴
        send_encouragement()
        session.next_turn()
```

---

## 5. WebSocket Protocol

### Server → Client Events

| Event | Payload | 설명 |
|-------|---------|------|
| `TURN_UPDATE` | `{ speaker, audio_url, text }` | AI 발언, 즉시 오디오 재생 |
| `USER_TURN_READY` | `{ topic_guide }` | 사용자 차례, 마이크 UI 활성화 |
| `FEEDBACK_ACTION` | `{ status, audio_url, hint }` | 꼬리질문 (FAIL 시) |
| `SESSION_CLOSE` | `{ summary }` | 수업 종료 |

### Client → Server Events

| Event | Payload | 설명 |
|-------|---------|------|
| `SEND_AUDIO` | Binary Blob | 사용자 녹음 파일 |

---

## 6. 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| Socket | python-socketio (Async) | 비동기 실시간 처리 |
| State Store | Python In-Memory → Redis | MVP → Scale-out |
| AI Input | Gemini Native Audio | STT 불필요 |
| AI Output | Google Cloud TTS | 사전 캐싱 적용 |
| Validation | Pydantic | Gemini JSON 응답 검증 |

---

## 7. 전체 플로우

```
[INIT] 주제 선정
    ↓
[AI_1] 앵커 AI - 3문장 구조 모범 답안 (Strict Mode)
    ↓
[AI_2~5] 일반 AI - 순차 발언 (맥락 유지)
    ↓
[USER] 사용자 차례
    │
    ├─ Pass → SESSION_END
    │
    └─ Fail → 꼬리질문 (최대 2회)
           │
           ├─ 재시도 성공 → TURN_COMPLETE
           └─ 재시도 한도 도달 → 강제 Pass + 격려 메시지
```

---

## 8. 개발 체크리스트

- [ ] ClassroomSession 상태 머신 구현
- [ ] python-socketio 서버 설정
- [ ] 앵커 AI 프롬프트 튜닝 (3문장 구조 강제)
- [ ] 사용자 발화 평가 Pydantic 스키마 정의
- [ ] 꼬리질문 루프 로직 구현 (max_retries=2)
- [ ] WebSocket 이벤트 프로토콜 구현
- [ ] Redis 세션 저장소 연동 (Scale-out 대비)
