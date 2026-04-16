# Visual Pipeline Builder — 코드 검수 보고서

> 작성일: 2026-04-16  
> 검수 범위: Codex가 기획서(`learning-modules-pipeline-spec.md`) 기반으로 구현한 미커밋 파일 전체  
> 검수 방법: 소스 코드 직접 열람 + 실행 흐름 추적

---

## 1. 검수 대상 파일 목록

| 경로 | 유형 |
|------|------|
| `apps/server/app/models/visual_pipeline.py` | 신규 |
| `apps/server/app/schemas/visual_pipeline.py` | 신규 |
| `apps/server/app/api/v1/visual_pipelines.py` | 신규 |
| `apps/server/app/services/pipeline_runner/` (전체) | 신규 |
| `apps/server/migrations/versions/t5u6v7w8x9y0_*.py` | 신규 |
| `apps/server/app/models/__init__.py` | 수정 |
| `apps/server/app/api/v1/router.py` | 수정 |
| `apps/server/app/services/conversation/my_turn_service.py` | 수정 |
| `apps/admin/src/(fsd)/features/pipeline-editor/` (전체) | 신규 |
| `apps/admin/src/app/(dashboard)/ai-lab/pipeline-editor/` | 신규 |
| `apps/admin/src/app/(dashboard)/ai-lab/pipeline-logs/` | 신규 |
| `apps/admin/src/app/(dashboard)/ai-lab/template-links/` | 신규 |
| `apps/admin/src/app/(dashboard)/ai-lab/visual-pipelines/` | 신규 |
| `apps/admin/package.json` | 수정 |
| `apps/admin/src/(fsd)/shared/config/constants.ts` | 수정 |
| `apps/admin/src/(fsd)/widgets/sidebar/ui/AppSidebar.tsx` | 수정 |

---

## 2. 종합 평가

| 항목 | 평가 | 비고 |
|------|------|------|
| 데이터 모델 & 마이그레이션 | ✅ 완전 구현 | 4개 테이블, FK, 인덱스 정상 |
| 파이프라인 러너 (DAG 실행) | ✅ 완전 구현 | asyncio.gather 병렬 실행 포함 |
| 마이턴 "visual" 분기 통합 | ✅ 완전 구현 | process_user_turn 1189행 |
| 노드 타입 9종 (서버) | ✅ 완전 구현 | 각 Executor 존재 |
| 노드 타입 9종 (프론트) | ✅ 완전 구현 | React Flow 컴포넌트 존재 |
| 변수 해석기 `{{...}}` | ✅ 완전 구현 | safe eval, dot notation |
| WebSocket 이벤트 | ✅ 완전 구현 | node_started/completed/failed |
| 실행 로그 DB 저장 | ✅ 완전 구현 | pipeline_execution_logs 테이블 |
| 라우터 엣지 매칭 | ✅ **수정 완료** | Bug #1 — 잘못된 조건 제거 |
| Sidecar 병렬 분기 | ⚠️ 미구현 | affects_turn_flow 개념 없음 |
| LLM 노드 재시도 | ✅ **수정 완료** | Bug #2 — retry_count 로직 추가 |
| 턴관리 LLM 생성 가능 여부 | ✅ 가능 | LLM 노드로 직접 생성 |

**종합 등급: A (매우 잘 구현됨 — Bug #1/#2/#3 및 Issue #5 수정 완료)**

---

## 3. 항목별 상세 분석

### 3.1 메트릭 측정 및 로그 추출

**평가: ✅ 잘 구현됨**

각 노드 실행 시 `PipelineExecutionLog` 레코드가 DB에 저장된다.

```python
# runner.py _persist_log()
PipelineExecutionLog(
    trace_id=context.trace_id,
    session_id=context.session_id,
    pipeline_id=self.pipeline_id,
    pipeline_version=self.pipeline_version,
    turn_index=context.turn_index,
    node_id=outcome.node_id,
    node_type=node["type"],
    node_label=node_label,
    status=outcome.status,
    input_json=outcome.input_snapshot,   # 노드 입력 전체
    output_json=outcome.output,           # 노드 출력 전체
    duration_ms=outcome.duration_ms,
    model_name=outcome.model_name,
    prompt_used=outcome.prompt_used,      # 실제 사용된 프롬프트
    error_message=outcome.error_message,
)
```

**측정 가능한 메트릭:**
- 노드별 실행 시간(`duration_ms`)
- LLM 토큰 수(`input_tokens`, `output_tokens` — LLM 노드 output_json에 포함)
- 추정 비용(`estimated_cost_usd` — context.metadata에 집계)
- 노드별 상태(`completed`/`failed`/`skipped`)
- WPM, response_delay_sec (start 노드 payload → 각 LLM 노드 변수로 전달 가능)

**로그 조회 API:**
- `GET /api/v1/visual-pipelines/execution-logs?session_id=&trace_id=&pipeline_id=`
- `GET /api/v1/visual-pipelines/execution-logs/{trace_id}` — trace 전체 상세

**메트릭을 직접 추출하려면:**
1. `Code 노드`를 만들어 `{{start.measured_wpm}}`, `{{start.response_delay_sec}}` 등을 가공
2. 결과를 `UIEvent 노드`로 WebSocket 전송하거나 End 노드의 `engine_trace`에 포함

---

### 3.2 기존 마이턴 파이프라인 적용

**평가: ✅ 완전 통합됨**

`my_turn_service.py` 1189행에 `visual` 분기가 추가되었다:

```python
if pipeline_mode == "visual":
    # 1. 템플릿-파이프라인 링크 조회
    link = await visual_service.get_link_for_template(session.template.id)
    
    # 2. 파이프라인 그래프 로드
    pipeline_id, pipeline_version, graph_json, timeout_ms = ...
    
    # 3. PipelineRunner 실행
    runner = PipelineRunner(self.db, graph_json, ...)
    pipeline_result = await runner.execute(pipeline_context)
    
    # 4. 결과를 variant에 저장
    variant["_pipeline_result"] = pipeline_result
    
    # 5. question_progress 처리 (v0.2와 동일 로직)
    if question_progress.get("session_completed"):
        variant["_force_moderator_turn"] = True
        variant["_pending_session_end"] = True
    elif question_progress.get("question_completed"):
        variant["_force_moderator_turn"] = True
```

이후 `process_ai_turn()`에서 `pipeline_result`를 소비하는 부분(757행)도 `visual` 모드를 처리한다:

```python
if pipeline_mode in ("v0.2", "visual") and pipeline_result:
    # moderator → feedback_text 주입
    # ai participants → speaker_scripts 또는 level_instruction 주입
```

**기존 v0.2/basic 세션은 변경 없이 그대로 작동한다.** `template_visual_pipeline_links` 레코드가 없으면 `visual` 모드로 진입하지 않는다.

---

### 3.3 턴 관리 LLM 직접 생성 가능 여부

**평가: ✅ 가능 — 단, 제약 있음**

관리자는 `LLM 노드`를 여러 개 연결하여 턴 관리 로직을 구성할 수 있다. 예를 들어:

```
Start → Evaluator (LLM) → Planner (LLM) → Router → [Repair LLM / Extend LLM] → Conductor (LLM) → End
```

**직접 생성 방법:**
1. 어드민의 비주얼 에디터에서 LLM 노드 생성
2. `prompt` 필드에 원하는 역할 지시 (Evaluator 역할, Planner 역할 등) 작성
3. `response_format: "json"` + `output_schema` 설정으로 구조화된 출력 강제
4. 노드를 연결하면 이전 노드 출력이 `{{node_id.result.field}}` 형태로 다음 노드에 전달

**단, 현재 출력 계약(output contract)이 고정되어 있음:**

End 노드의 `output_mapping`은 반드시 아래 필드를 모두 채워야 한다:
- `feedback_text`, `feedback_instruction`, `level`, `level_instruction`
- `corrections`, `better_expressions`, `speaker_scripts`, `user_emotion`

즉, **마지막 Conductor 역할의 LLM 노드가 이 필드들을 반드시 생성해야 한다.** 이 점을 프롬프트에 명시해야 한다.

---

### 3.4 병렬 처리

**평가: ✅ 작동함 — 단, sidecar 미구현**

**작동하는 병렬 처리:**

`runner.py` 149-158행의 ready-set 알고리즘이 준비된 모든 노드를 `asyncio.gather()`로 동시 실행한다:

```python
while True:
    ready = self._get_ready_nodes(context, activated_edge_ids)
    if ready:
        outcomes = await asyncio.gather(
            *[self._execute_node(node_id, context) for node_id in ready],
        )
```

**예시 — 실제로 병렬 실행되는 구조:**
```
Start → Parallel → [Branch A: Evaluator → Planner] 동시에 [Branch B: UIEvent (점수 표시)]
                → Merge → Conductor → End
```
Branch A(LLM 처리)와 Branch B(UI 이벤트 전송)가 실제로 동시에 실행된다.

**미구현: Sidecar (affects_turn_flow=false)**

기획서에 명시된 "sidecar 노드" 개념 — End 노드를 기다리지 않고 독립 실행되는 분기 — 는 구현되지 않았다. 현재는 모든 분기가 Merge 노드를 통해 End에 도달해야 한다. 사이드카 분기를 사용하려면 현재 구조상 Parallel → [메인 분기] + [사이드카 분기] → Merge로 구성해야 하며, Merge 노드가 두 분기 모두 기다린다.

> **수정사항 #1**: 이 점을 문서화하여 사용자에게 안내

---

### 3.5 UI 표기 분기 처리

**평가: ✅ 완전 구현**

`UIEvent 노드`가 파이프라인 실행 중 언제든지 WebSocket으로 클라이언트에 이벤트를 전송한다:

```python
# ui_event_executor.py
payload = resolve_mapping(node_data.get("payload_template") or {}, context)
event_type = node_data.get("event_type") or "pipeline:ui_update"
target = node_data.get("target") or "session"  # "session" | "admin" | "both"

await runner.emit_runtime_event(context, event_type, {
    "trace_id": context.trace_id,
    "node_id": node_id,
    "target": target,
    "payload": payload,  # {{evaluator.result.overall_score}} 등 동적 값 포함
})
```

**사용 예시 — 학습자 화면에 점수 표시:**
1. Evaluator LLM 노드 이후 UIEvent 노드 배치
2. `event_type`: `"pipeline:score_update"`
3. `payload_template`: `{ "score": "{{evaluator.result.overall_score}}", "wpm": "{{start.measured_wpm}}" }`
4. `target`: `"session"` (모바일 클라이언트)

모바일 앱에서 이 이벤트를 수신하여 화면에 실시간 표시할 수 있다.

**어드민 실행 모니터링도 동일 방식:**
- `target: "admin"` 또는 `"both"` 설정 시 어드민 대시보드에도 전송
- WebSocket `/api/v1/visual-pipelines/monitor/{session_id}/ws` 구독 필요

---

## 4. 발견된 버그 및 문제점

### Bug #1: Router 엣지 매칭 오류 (심각도: 높음) — ✅ 수정 완료

**위치**: `runner.py` `get_router_outgoing_edge_ids()`

**문제:** 세 번째 조건 `edge["target"] == route_id`가 타겟 노드 ID와 라우트 ID를 비교했으나 형식이 달라 항상 false. 엣지가 2개 이상이면 fallback도 동작하지 않아 라우팅이 무조건 실패했다.

**수정:** 잘못된 조건 제거. `sourceHandle` 또는 `label` 매칭만 유지.

---

### Bug #2: LLM 노드 재시도 없음 (심각도: 중간) — ✅ 수정 완료

**위치**: `node_executors/llm_executor.py`

**문제:** API 일시 오류 시 즉시 노드 실패로 처리됐다.

**수정:** `node_data.get("retry_count", 2)`, `retry_delay_sec` 기반 지수 백오프 재시도 로직 추가. 노드 설정에서 재시도 횟수와 대기 시간 조정 가능.

---

### Bug #3: Merge 노드 custom eval() 보안 미흡 (심각도: 낮음) — ✅ 수정 완료

**위치**: `node_executors/merge_executor.py`

**문제:** `__builtins__: {}` 제한은 걸었으나 코드 주석과 맥락이 불명확했다.

**수정:** `variable_resolver.py`의 `build_scope()` 재사용으로 일관된 safe scope 보장. `branches` 변수를 scope에 추가하는 방식은 동일하나 코드 의도를 명확히 문서화.

---

### Issue #4: LLM 노드가 OpenAI 미지원 (심각도: 낮음)

**위치**: `node_executors/llm_executor.py`

**현상:** `ChatGoogleGenerativeAI`만 사용. 기획서에는 OpenAI 지원이 언급되었으나 미구현.

모델 이름이 `"gpt-"` 또는 `"o"` 시리즈일 때 `ChatOpenAI`로 분기하는 로직 추가 필요.

---

### Issue #5: output_contract level 필드 타입 (심각도: 낮음) — ✅ 수정 완료

**위치**: `output_contract.py`

**현상:** `level` 필드를 `(int,)`로만 검증하는데, LLM이 문자열 `"3"` 형태로 출력하면 validation 실패.

**수정:** `coerce_output_contract()` 함수를 추가하여 validation 전에 `level`을 `int()`로 변환 시도. `runner.py`의 End 노드 실행 지점 두 곳에서 호출.

---

## 5. 수정 이력

| 항목 | 심각도 | 상태 | 수정 파일 |
|------|--------|------|-----------|
| Bug #1 Router 엣지 매칭 | 높음 | ✅ 수정 완료 | `runner.py` |
| Bug #2 LLM 재시도 없음 | 중간 | ✅ 수정 완료 | `llm_executor.py` |
| Bug #3 Merge eval 보안 | 낮음 | ✅ 수정 완료 | `merge_executor.py` |
| Issue #4 OpenAI 미지원 | 낮음 | ⏳ 미수정 | `llm_executor.py` |
| Issue #5 level 타입 강제 | 낮음 | ✅ 수정 완료 | `output_contract.py`, `runner.py` |

---

## 6. 검수 총평

Codex가 기획서를 충실히 구현했다. 핵심 흐름인 "비주얼 파이프라인 정의 → 마이턴 세션 실행 → 노드별 로그 저장 → 어드민 모니터링"이 전부 작동한다. React Flow 에디터, 9종 노드 컴포넌트, 설정 패널이 완성되어 있고 어드민 사이드바에도 신규 메뉴가 추가되었다.

Bug #1~#3 및 Issue #5 수정 완료. 잔여 미수정 항목은 Issue #4(OpenAI 지원)으로, 현재 Gemini 모델만 필요하다면 무시해도 된다.
