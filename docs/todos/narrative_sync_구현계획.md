# Narrative Sync v0.2 — Expert Pipeline 구현 계획

기존 단일 오케스트레이터(`ScenarioDirector`)의 역할을 **Evaluator(진단)**, **Planner(전략 결정)**, **Conductor(실행 조율)** 3개 모듈로 분리하여 독립 배포/교체 가능한 구조를 만들고, 모듈 간 통신을 `schema_version`이 명시된 JSON 계약으로 수행합니다. 기존 basic 모드(ScenarioDirector)는 삭제하지 않고 유지합니다.

---

## User Review Required

> [!IMPORTANT]
> **파이프라인 모드 스위칭**: 템플릿에 `pipeline_mode` 필드를 추가하여 `"basic"` (기존) / `"v0.2"` (Evaluator→Planner→Conductor) 모드를 선택할 수 있게 합니다. `"basic"`이 기본값이므로 기존 기능에 영향이 없습니다.

> [!WARNING]
> **DB 마이그레이션 필요**: `pipeline_logs` 테이블 신규 추가 + `conversation_templates`에 `pipeline_mode`, `evaluator_prompt`, `planner_prompt`, `conductor_prompt` 컬럼 추가. 배포 시 Alembic 마이그레이션을 적용해야 합니다.

---

## 1. 현재 구현 상태 요약

### Template 관리
- `ConversationTemplate` 모델: `system_prompt`, `director_system_prompt`, `director_llm_model`, `scene_context`, `turn_sequence` 등 보유
- Admin에서 CRUD, 참여자 관리, 프롬프트 편집 지원

### My Turn 흐름 (현재 v0.1)
1. **사용자 발화** → `process_user_turn()` → STT → `ScenarioDirector.evaluate_turn()` (단일 LLM 호출)
2. **ScenarioDirector 역할**: 평가 + 다음 지시 + 다음 화자 결정 + 감정 감지를 하나의 프롬프트에서 모두 수행
3. **결과**: `DirectorOutput(evaluation, instruction, next_speaker, user_emotion)` → 턴 분기(PASS/FAIL/Clarification)

### 문제점
- 단일 프롬프트에 진단/전략/실행 역할이 모두 혼합 → 응답 시간 느림 (p95 최대 16.7s)
- 결과가 결정적이지 않음 (평가 점수화 없이 정성 평가만)
- 모듈별 독립 교체/튜닝 불가

---

## 2. 기존 코드 재사용 계획

| 기존 코드 | 재사용 | 비고 |
|-----------|--------|------|
| `ScenarioDirector.BASE_PROMPT` | ✅ Conductor 기본 프롬프트로 보존 | basic 모드 유지 |
| `ScenarioDirector.evaluate_turn()` | ❌ 호출 경로만 변경 | v0.2에서는 Evaluator→Planner→Conductor 체인으로 대체 |
| `MyTurnService.process_user_turn()` | ✅ 파이프라인 분기점 추가 | `pipeline_mode` 체크하여 basic/v0.2 분기 |
| `MyTurnService.process_ai_turn()` | ✅ 그대로 사용 | Conductor 출력을 `instruction`으로 전달 |
| 기존 WebSocket `manager` | ✅ 이벤트 확장 | 새 이벤트 타입 추가 |
| `SessionMetrics` | ✅ 확장 | 파이프라인별 latency 추가 |
| `ConversationTurn` 모델 | ✅ 그대로 | `PipelineLog`가 별도 테이블로 분리 |

---

## Proposed Changes

### Server — Data Contract (스키마 정의)

#### [NEW] [pipeline_schemas.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/schemas/pipeline_schemas.py)
v0.2 JSON 계약에 대응하는 Pydantic 모델 정의:
- `CommonMeta`: `schema_version`, `trace_id`, `session_id`, `turn_id`, `timestamp`
- `EvaluatorOutput`: `narrative_scores`, `aggregate`, `detected`, `fluency`, `diagnosis`
- `PlannerOutput`: `decision`, `persona_plan`
- `ConductorOutput`: `scripts[]`, `tts_requests[]`

---

### Server — DB 모델 변경

#### [MODIFY] [conversation.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/models/conversation.py)
- `ConversationTemplate`에 추가:
  - `pipeline_mode: String(20)` (기본값 `"basic"`, `"v0.2"` 가능)
  - `evaluator_prompt: Text` (Evaluator 커스텀 프롬프트)
  - `planner_prompt: Text` (Planner 커스텀 프롬프트)
  - `conductor_prompt: Text` (Conductor 커스텀 프롬프트)

#### [NEW] [pipeline_log.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/models/pipeline_log.py)
`PipelineLog` 테이블: 모듈별 실행 로그 저장
- `trace_id`, `session_id`, `turn_id`
- `module_name` (evaluator / planner / conductor)
- `schema_version`
- `input_json`, `output_json` (JSONB)
- `duration_ms`, `model_name`, `error_message`
- `created_at`

#### [NEW] Alembic migration
파이프라인 관련 DB 변경에 대한 마이그레이션 파일

---

### Server — Evaluator 모듈

#### [NEW] [evaluator_service.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/services/conversation/evaluator_service.py)
- `EvaluatorService` 클래스
- **입력**: `stt.final` 텍스트 + 세션 메타 (topic, active_pattern, target_level)
- **출력**: `EvaluatorOutput` JSON (narrative_scores, aggregate, diagnosis)
- Gemini Flash 사용 (`response_mime_type: "application/json"`)
- 에러 처리: JSON 파싱 실패 → 1회 재시도 → 룰 기반 최소 진단으로 degrade
- **기본 프롬프트**는 하드코딩, 템플릿 레벨 `evaluator_prompt`가 있으면 override

---

### Server — Planner 모듈

#### [NEW] [planner_service.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/services/conversation/planner_service.py)
- `PlannerService` 클래스
- **입력**: `EvaluatorOutput` + 세션 상태 (recent scores, last_strategy, streak)
- **출력**: `PlannerOutput` JSON (decision path, action_code, persona_plan)
- **Decision Table** 구현:
  - CRITICAL (score < 60): TRIGGER_HELPER
  - STANDARD (60-89): ADD_MODELING
  - ELITE (≥ 90 & low complexity): DENSITY_UP
- 룰 엔진 우선 (LLM 불필요), 필요 시 `planner_prompt` 사용하여 LLM 호출
- p95 ≤ 200ms 목표

---

### Server — Conductor 모듈

#### [NEW] [conductor_service.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/services/conversation/conductor_service.py)
- `ConductorService` 클래스
- **입력**: `PlannerOutput` + 페르소나 라이브러리 (템플릿 참여자 정보)
- **출력**: `ConductorOutput` (speaker별 script, instruction)
- 기존 `ScenarioDirector`의 스크립트 생성 로직을 기반으로 하되, 진단 로직은 제거
- Gemini Pro 사용 (풍부한 서사 생성)
- 발화 길이 제한: Helper 1-2문장(한국어), Modeling 3-5문장, Density Up 4-6문장
- **기본 프롬프트** + 템플릿 레벨 `conductor_prompt` override

---

### Server — 파이프라인 통합

#### [MODIFY] [my_turn_service.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/services/conversation/my_turn_service.py)
`process_user_turn()` 내부에서 `pipeline_mode` 분기:
```python
if template.pipeline_mode == "v0.2":
    # Evaluator → Planner → Conductor 파이프라인
    eval_output = await evaluator.evaluate(transcript, session_meta)
    plan_output = await planner.decide(eval_output, session_state)
    conductor_output = await conductor.generate_scripts(plan_output, participants)
    # 결과를 기존 흐름에 매핑
else:
    # 기존 ScenarioDirector (basic 모드)
    director_output = await director.evaluate_turn(...)
```

#### [MODIFY] [scenario_director.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/services/conversation/scenario_director.py)
- 기존 코드 변경 없이 유지 (basic 모드용)
- `director_system_prompt`를 `basic` 프롬프트로 편집 가능하게 변경 (이미 구현됨)

#### [MODIFY] [conversations.py](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/api/v1/conversations.py)
- 프롬프트 관리 API 추가:
  - `GET /templates/{id}/prompts` — 4가지 프롬프트 조회 (basic, evaluator, planner, conductor)
  - `PUT /templates/{id}/prompts` — 프롬프트 저장
- 파이프라인 로그 조회 API:
  - `GET /sessions/{id}/pipeline-logs` — 세션별 모듈 실행 로그
  - `GET /sessions/{id}/pipeline-logs?module=evaluator` — 필터링

#### [MODIFY] [conversation.py (schemas)](file:///Users/ochihyo/Documents/antigravity/study-english/apps/server/app/schemas/conversation.py)
- `TemplateBase`에 `pipeline_mode`, `evaluator_prompt`, `planner_prompt`, `conductor_prompt` 필드 추가
- 파이프라인 로그 응답 스키마 추가

---

### Admin — 세션 상세 페이지 파이프라인 로그 탭

#### [MODIFY] Session Detail Page (새 탭 추가)
- 기존 세션 상세 페이지에 **"Pipeline Logs"** 탭 추가
- 턴별로 Evaluator → Planner → Conductor 실행 기록 표시
- 각 모듈의 입출력 JSON을 collapsible 패널로 표시
- `schema_version`별 필터링
- `duration_ms` 시각화 (바 차트)
- 성능/학습 품질 지표 요약 (overall_score 추이, decision path 분포)

---

### Admin — 프롬프트 편집 UI

#### [MODIFY] Template 편집 페이지
- `pipeline_mode` 토글 (basic / v0.2)
- 4가지 프롬프트 편집 영역:
  1. **Basic** (기존 `director_system_prompt` — 읽기/쓰기)
  2. **Evaluator** (v0.2 전용)
  3. **Planner** (v0.2 전용)
  4. **Conductor** (v0.2 전용)
- 각 프롬프트에 기본값 표시 + 커스텀 override 지원

---

## 3. Phase별 구현 순서

| Phase | 내용 | 예상 시간 | 의존성 |
|-------|------|-----------|--------|
| **1** | Data Contract (Pydantic) + DB 모델 + 마이그레이션 | 2h | 없음 |
| **2** | Evaluator 서비스 구현 | 3h | Phase 1 |
| **3** | Planner 서비스 구현 (Decision Table) | 2h | Phase 1 |
| **4** | Conductor 서비스 구현 | 3h | Phase 1 |
| **5** | 파이프라인 통합 (`my_turn_service.py` 수정) + 프롬프트 API | 3h | Phase 2-4 |
| **6** | Admin — 파이프라인 로그 탭 UI | 3h | Phase 5 |
| **7** | Admin — 프롬프트 편집 UI | 2h | Phase 5 |
| **8** | 검증 (테스트 + 레이턴시 측정) | 2h | Phase 6-7 |

---

## Verification Plan

### Automated Tests

현재 `apps/server/tests/` 디렉토리에 기존 테스트 파일이 없습니다. 따라서 새로 작성합니다.

#### 1. Unit Test — Evaluator 출력 스키마 검증
- `tests/services/test_evaluator_service.py`에서 mock LLM 응답을 주입하여 `EvaluatorOutput` 파싱 검증
- 실행: `cd apps/server && poetry run pytest tests/services/test_evaluator_service.py -v`

#### 2. Unit Test — Planner Decision Table 검증
- `tests/services/test_planner_service.py`에서 다양한 `EvaluatorOutput` 점수 조합에 대한 Decision Table 분기 검증
  - score < 60 → CRITICAL / TRIGGER_HELPER
  - score 60-89 → STANDARD / ADD_MODELING
  - score ≥ 90 → ELITE / DENSITY_UP
- 실행: `cd apps/server && poetry run pytest tests/services/test_planner_service.py -v`

#### 3. Unit Test — Pipeline 스키마 Pydantic 검증
- `tests/schemas/test_pipeline_schemas.py`에서 JSON 예시로 모든 스키마의 직렬화/역직렬화 검증
- 실행: `cd apps/server && poetry run pytest tests/schemas/test_pipeline_schemas.py -v`

### Manual Verification

#### 1. 파이프라인 모드 전환 테스트
1. Admin에서 기존 템플릿 열기
2. `pipeline_mode`를 `v0.2`로 변경 + 저장
3. My Turn 세션 시작 → 발화 → AI 응답 확인
4. 세션 상세 페이지에서 **Pipeline Logs** 탭에 Evaluator/Planner/Conductor 기록 표시 확인
5. `pipeline_mode`를 `basic`으로 되돌린 뒤 → 기존 대화 흐름 정상 동작 확인

#### 2. 프롬프트 편집 테스트
1. Admin에서 템플릿 편집 페이지 열기
2. `pipeline_mode`를 `v0.2`로 변경
3. Evaluator/Planner/Conductor 프롬프트 각각 수정 → 저장
4. My Turn 세션 시작 → 수정된 프롬프트가 반영되는지 로그에서 확인

#### 3. E2E 레이턴시 측정
1. `pipeline_mode: v0.2`인 템플릿으로 My Turn 세션 실행
2. 5회 이상 발화 수행
3. 세션 상세 페이지에서 각 모듈별 `duration_ms` 확인
4. 목표: Evaluator ≤ 1.0s, Planner ≤ 0.2s, Conductor ≤ 1.5s

> [!TIP]
> 배포 전에 로컬에서 `poetry run uvicorn app.main:app --reload`로 서버를 실행하고, `pnpm dev`로 Admin을 실행하여 통합 테스트를 수행하세요.
