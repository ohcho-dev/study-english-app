# 1st Session 템플릿 (cd4ec1ea-c6b6-429f-a3e5-3fac4757a512) 파이프라인 진단 보고서

## 개요 업데이트 (AS-IS → TO-BE)

| 변경 항목 | AS-IS | TO-BE |
|-----------|-------|-------|
| Runtime payload 전달 | Evaluator/Planner/Conductor가 지연시간·question metadata를 전달받지 못하고 LLM이 추측에 의존 | `question_id`, `question_unit_index`, `question_completed`, `intervention_seq`, `response_delay_sec` 등을 payload+프롬프트에 포함해 LLM이 정확한 상태를 읽도록 함 |
| Prompt 투명성 | 세션 기록에 실제 LLM 입력이 남지 않아 재현/디버깅이 어려움 | WARN 로그와 PipelineLog.input_json에 `prompt_text`를 저장해 실제 문자열을 확인 가능 |
| Conductor intervention 노출 | `engine_trace`에만 개입 문구가 남아 실제 발화와 달라짐 | `engine_trace.intervention_emitted_text`를 AI 컨텍스트와 발화에 주입해 로그와 실제 사용자 보기와 일치 |
| Question progress 활용 | Planner의 `question_completed`/`question_id` 등이 저장되지 않아 질문 종료를 추적할 수 없음 | `_merge_question_progress`로 통합해 `SessionState`/variant에 저장, Moderator 강제 전환에 활용 |

## 핵심 질문 요약 (2025-04-XX 기준)
| 번호 | 질문 | 최신 결론 | 근거 |
|-----|------|-----------|------|
|5.1|Planner의 `question_completed`가 질문 이동에 사용되는가?|예. Planner output에서 `question_completed=true` 시 `_force_moderator_turn` 플래그를 세워 다음 `complete_turn`에서 Moderator를 강제로 호출.|`_merge_question_progress`와 variant 저장, `complete_turn` 강제 로직 (`apps/server/app/services/conversation/my_turn_service.py:1208-1350`, `340-470`).|
|5.2|Conductor output이 실제 AI Tutor 발화에 반영되는가?|예. `speaker_scripts`가 없을 때도 `engine_trace.intervention_emitted_text`를 컨텍스트/발화에 주입하도록 변경.|컨텍스트 삽입 및 LLM 바이패스 (`apps/server/app/services/conversation/my_turn_service.py:660-760`).|
|5.3|v0.1 프롬프트여도 v0.2 스키마가 강제되는가?|그렇다. 템플릿이 `pipeline_mode="v0.2"`인 이상 Evaluator/Planner/Conductor 모두 v0.2 모델을 사용. 다만 실제 프롬프트/로그에는 v0.1 사양이 그대로 들어간다.|스키마 정의 (`apps/server/app/schemas/pipeline_schemas.py`).|
|5.4|`response_delay_sec`가 Evaluator/Planner/Conductor 입력에 포함되는가?|포함. `eval_input_payload` 등 runtime payload에 넣고 프롬프트에도 추가.|`apps/server/app/services/conversation/my_turn_service.py:1135-1270`.|
|5.5|Evaluator/Planner/Conductor 로그가 턴별로 동기화되는가?|동일 `trace_id`/`turn_index`로 저장되고 `prompt_text`까지 남기므로 세션 기록에서 실제 LLM 입력을 확인 가능.|PipelineLog 입력 변경 (`apps/server/app/services/conversation/my_turn_service.py:1174-1296`).|
|5.6|`scripts: []`인데도 Tutor 발화가 나오는 이유?|스마트 개입 문구가 `engine_trace`에만 있는 경우 해당 문장을 직접 발화하도록 확장했으므로 현재는 일치.|LLM 바이패스 조건 (`apps/server/app/services/conversation/my_turn_service.py:736-760`).|

## 상세 분석
### A. Planner/Conductor 메타데이터 흐름
1. **Question Progress 저장**
   - Evaluator/Planner/Conductor 결과를 `_merge_question_progress`로 통합해 `SessionState.custom_state['question_progress']`, variant(`_question_progress`), `_pipeline_result`, API 응답에 포함.
   - question_completed가 true면 variant에 `_force_moderator_turn`을 넣고 다음 턴을 Moderator로 강제.
2. **Conductor 개입 반영**
   - `engine_trace.intervention_emitted_text`가 있으면 AI 컨텍스트에 `[CONDUCTOR INTERVENTION]` 블록을 추가하고, 스크립트가 없을 때 해당 문구로 곧바로 발화하도록 바이패스를 확장.
3. **프롬프트/로그 투명성**
   - Evaluator/Planner/Conductor가 마지막 프롬프트 문자열을 `last_prompt`로 저장하고, PipelineLog.input_json에 `prompt_text`로 기록. 로그에서도 WARN 레벨로 동일 프롬프트를 출력.

### B. 상태 및 질문 이동
1. **Moderator 강제 전환**
   - `_force_moderator_turn`이 true면 `complete_turn`에서 Moderator를 다음 화자로 설정, 사용자 앞에서 질문을 닫도록 처리.
2. **Intervention Seq**
   - Conductor `engine_trace.intervention_seq`를 question_progress에 저장해 다음 턴 컨텍스트에 재사용. 아직 누적 증분 로직은 없으므로 필요 시 추가 구현 가능.
3. **Evaluator 엔진 트레이스**
   - `question_id`, `response_delay_sec` 등을 payload에 포함했으나, Planner/Conductor의 출력 `engine_trace`가 동일 값을 보장하려면 추후 코드 병합이 필요함.

### C. 실행 경로
1. **실제 발화**
   - 스크립트가 있으면 그대로 사용, 없으면 Conductor intervention 문구를 사용(Moderator 제외). 따라서 Conductor 로그와 실제 발화가 일치.
2. **`return_to_user_after`**
   - 여전히 false지만, question_completed 플래그로 Moderator 후 사용자 차례가 오도록 보장.

### D. 레거시 필드
1. **Score/Level 노출**
   - v0.2 스키마 필수 필드라 계속 남아 있다. 필요시 API/프론트에서 조건부로 숨겨야 함.
2. **진단 값**
   - Evaluator engine_trace의 stop type이 좀 더 정확한 신호이므로, v0.1 UI에서 해당 값을 우선 노출하도록 권장.

### E. 남은 개선 과제
1. **전용 v0.1 파이프라인 모드**: 필요한 필드만 쓰는 슬림 모드를 도입해 legacy 스키마를 분리.
2. **Intervention 누적**: question_progress에 누적 카운터나 히스토리를 저장해 다중 개입 로직을 지원.
3. **UI 필터**: first-session 템플릿에서 Score/Level/ABC 패턴 숨기기.
4. **엔진 트레이스 병합**: Planner/Conductor가 evaluator 엔진 메타를 확실하게 계승하도록 코드 레벨에서 병합 로직 추가.
5. **지연 지표 활용**: Planner/Conductor 프롬프트 지시를 조정해 response_delay 데이터를 더욱 적극적으로 활용하도록 가이드.
