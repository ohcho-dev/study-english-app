# 세션 종료 안정화 및 비용 관리

## 1. 문제 상황 (2026-02-10)

### 현상
- 사용자가 "세션 종료(Stop Session)" 버튼을 눌러도, 이미 스케줄된 AI 턴이 백그라운드에서 계속 실행됨.
- 예: AI 1이 말하고 난 직후 종료했으나, AI 2, AI 3가 이어서 발화함.
- **심각한 비용 문제**: 사용자가 의도하지 않은 AI 생성(LLM+TTS) 비용이 계속 발생함.
- UI 상으로는 "세션 종료됨"이라고 뜨지만, 서버에서는 계속 AI 턴을 처리하고 클라이언트로 메시지를 보냄.

### 원인
- `process_ai_turn` (AI 발화 생성) 및 `complete_turn` (다음 턴 결정) 함수 내에서 **현재 세션의 상태(Status)**를 체크하는 로직이 부재함.
- `run_ai_turn_background`가 비동기로 실행될 때, 실행 시점에 세션이 종료되었는지 확인하지 않음.
- WebSocket 연결이 끊겨도(세션 종료 요청 시), 서버 로직은 독립적으로 돌아가고 있음.

## 2. 해결 목표

### 세션 즉시 중단 (Hard Stop)
- 세션 상태가 `COMPLETED` 또는 `ERROR`인 경우, **어떤 AI 로직도 실행되지 않아야 함**.
- 진행 중이던 AI 턴이라도, LLM 호출 직전/직후, TTS 호출 직전/직후에 상태를 체크하여 **즉시 중단(Early Return)**해야 함.

### 자동 타임아웃 (Auto-Timeout)
- 사용자가 세션을 켜두고 자리를 비우거나, 브라우저를 끄지 않고 방치했을 때를 대비.
- 마지막 사용자 발화(또는 턴 활동)로부터 **5분**이 지나면 자동으로 세션을 종료.
- `last_activity_at` 타임스탬프를 세션 모델에 추가하고, 주기적(또는 이벤트 기반)으로 체크.

## 3. 구현 계획 (Action Items)

### A. 세션 상태 체크 강화 (우선순위: 매우 높음)
1.  **`MyTurnService.process_ai_turn`**:
    - 함수 진입 시점: `if session.status != SessionStatus.ACTIVE: return`
    - LLM 호출 직전: 재확인 (비동기 대기 시간이 있을 수 있으므로)
    - TTS 호출 직전: 재확인
2.  **`MyTurnService.complete_turn`**:
    - 함수 진입 시점: 상태 체크. 종료된 세션이면 다음 턴 스케줄링 하지 않음.
3.  **`MyTurnService.run_ai_turn_background`**:
    - 세션 로드 직후: 상태 체크.

### B. 자동 타임아웃 구현 (우선순위: 높음)
1.  **모델 변경**:
    - `ConversationSession` 모델에 `last_activity_at` 필드 추가 (기타 `updated_at` 활용 가능성 검토).
2.  **타임아웃 체크 로직**:
    - `process_user_turn` 등 모든 활동 시점에 `last_activity_at` 갱신.
    - 백그라운드 스케줄러(예: Celery 또는 FastAPI `utils.repeat_every`) 도입 검토, 혹은 간단하게 `active_sessions` 관리.
    - 또는, `complete_turn`에서 "다음 턴이 사용자 턴일 때" 타임아웃 스케줄링(예: `asyncio.sleep`이나 `call_later` 등)을 걸어두고, 사용자가 반응하면 취소하는 방식 고려. (서버 리소스 고려 필요)

## 4. 예상 효과
- 불필요한 AI 토큰 및 TTS 비용 절감.
- 사용자 경험 개선 (종료 했는데 혼자 떠드는 "좀비 세션" 제거).
