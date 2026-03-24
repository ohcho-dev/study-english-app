---
name: my-turn-template
description: "My Turn 대화 템플릿을 설계하고 JSON으로 생성하는 스킬. 사용자가 영어 학습 시나리오 주제를 주면 v0.2 파이프라인(Evaluator→Planner→Conductor) 프롬프트, 참여자 구성, 레벨 정의, 모델 설정을 포함한 완전한 TemplateCreate JSON을 출력한다. 템플릿 만들어줘, 시나리오 설계해줘, My Turn 템플릿, 영어 연습 템플릿, 새 학습 시나리오, conversation template 등의 표현에 반응한다. DB 저장은 하지 않고 JSON만 출력한다."
---

# My Turn Template Generator

사용자가 영어 학습 주제를 제시하면, v0.2 파이프라인 기반의 완전한 My Turn 대화 템플릿 JSON을 설계하여 출력한다.

## 작동 방식

1. 사용자에게 주제/시나리오를 확인한다
2. 주제에 맞는 참여자, 프롬프트, 레벨 정의를 설계한다
3. TemplateCreate JSON을 출력한다 (DB 저장은 하지 않음)

## 핵심 원칙

이 시스템은 **어드민 실험실**이다. 코드는 범용이고, 시나리오별 로직은 전부 프롬프트로 처리한다. 하드코딩된 동사 목록, 시제 순서 같은 것은 프롬프트 안에만 존재해야 한다. Planner/Conductor/Evaluator는 모두 AI이므로 프롬프트로 충분히 제어 가능하다.

## 설계 전 확인사항

사용자에게 다음을 질문하거나 대화에서 추론한다:

- **학습 목표**: 시제 연습, 일상 회화, 비즈니스 영어, 발음 교정 등
- **참여자 구성**: 1:1 튜터링 vs 그룹 대화 (보통 모더레이터 + AI 1명 + 학생)
- **난이도 범위**: 초급~고급, 몇 단계로 나눌지
- **언어 혼합**: 한국어 설명 포함 여부, 발음 가이드 포함 여부

---

## TemplateCreate JSON 구조

```json
{
  "name": "템플릿 이름",
  "description": "설명",
  "mode": "turn_based",
  "system_prompt": "전체 세션의 핵심 원칙 및 규칙",
  "topic": "주제 키워드",
  "difficulty": 3,
  "estimated_minutes": 15,
  "first_speaker": "moderator_first",
  "scene_context": "영어로 작성. AI 참여자 전원이 공유하는 장면 설명",
  "pipeline_mode": "v0.2",
  "evaluator_prompt": "Evaluator 프롬프트",
  "planner_prompt": "Planner 프롬프트",
  "conductor_prompt": "Conductor 프롬프트",
  "evaluator_llm_model": "gemini-2.0-flash",
  "planner_llm_model": "gemini-2.0-flash",
  "conductor_llm_model": "gemini-2.0-flash",
  "level_definitions": [],
  "participants": []
}
```

---

## 참여자 설계 규칙

### 기본 3인 구성 (추천)

| # | 이름 | 타입 | order_index | 역할 |
|---|------|------|-------------|------|
| 0 | 한국어 이름 | moderator | 0 | 한국어 설명/교정 |
| 1 | 영어 이름 | ai | 1 | 영어 모델링/피드백 |
| 2 | Student (Me) | user | 2 | 학습자 |

### 참여자 JSON 필드

```json
{
  "participant_type": "moderator | ai | user",
  "name": "민쌤",
  "persona": "캐릭터 설명. Conductor가 스크립트 생성 시 참조함",
  "voice_id": "en-US-Journey-F",
  "voice_settings": {"speaking_rate": 1.0, "pitch": 0.0, "volume_gain_db": 0.0},
  "order_index": 0,
  "greeting_message": "첫 인사 메시지. 세션 시작 시 자동 발화됨",
  "llm_model": "gemini-2.0-flash",
  "stt_model": null,
  "stt_mode": null,
  "tts_model": "ko-KR-Neural2-B",
  "tts_provider": "google_cloud"
}
```

### TTS 주의사항

- **한국어+영어 혼합 화자**: `voice_id`를 `en-US-*`로 설정해야 영어 발음이 자연스러움. `ko-KR-*`은 영어가 콩글리시로 들림
- **TTS 지연**: 텍스트 길이에 비례. 긴 문장은 TTS 13-30초 지연 유발. 각 스크립트는 1-2문장 MAX
- **특수문자 금지**: TTS가 따옴표, 괄호, 콜론, 이모지를 읽음. 스크립트 텍스트에서 제외
- Journey 보이스는 고품질이지만 느림. Neural2가 속도/품질 밸런스 좋음

### STT 설정 (학습자용 user 참여자)

```json
{
  "stt_model": "chirp_3",
  "stt_mode": "streaming"
}
```

---

## 파이프라인 프롬프트 작성 가이드

### 핵심: speaker_name 매칭

Conductor JSON 출력의 `speaker_name`이 DB의 participant `name`과 **정확히 일치**해야 한다. 불일치 시 LLM fallback이 발동되어 스크립트가 무시됨. Conductor 프롬프트에 정확한 이름을 명시해야 한다.

### Evaluator 프롬프트 작성

Evaluator는 학습자의 발화를 평가한다. 출력은 반드시 다음 JSON 구조를 따라야 한다:

```
출력 JSON 구조:
{
  "narrative_scores": {
    "slot_a": {"score": 0-10, "is_missing": false, "evidence": "..."},
    "slot_b": {"score": 0-10, "is_missing": false, "evidence": "..."},
    "slot_c": {"score": 0-10, "is_missing": false, "evidence": "..."}
  },
  "aggregate": {
    "slot_avg": 0.0-10.0,
    "imitation_score": 0-10,
    "complexity_score": 0-10,
    "overall_score": 0-100
  },
  "diagnosis": {
    "primary_issue": "NONE | MISSING_SLOT_A | MISSING_SLOT_B | MISSING_SLOT_C | LOW_IMITATION",
    "secondary_issues": [],
    "recommended_action": "CONTINUE | TRIGGER_HELPER | ADD_MODELING | DENSITY_UP"
  }
}
```

slot_a/b/c의 의미는 시나리오별로 재정의 가능하다. 예:
- 시제 연습: slot_a=시제 정확도, slot_b=문장 완성도, slot_c=자연스러움
- 일상 회화: slot_a=맥락 적절성, slot_b=표현 다양성, slot_c=유창성

overall_score가 가장 중요한 값이며 Planner의 레벨 결정에 직접 사용된다.

### Planner 프롬프트 작성

Planner는 Evaluator 결과와 세션 상태를 받아 다음 전략을 결정한다.

**핵심 입력:**
- Evaluator 점수 (overall_score 0-100)
- custom_state (시나리오별 자유 형식 dict — 이전 턴에서 Planner가 출력한 값)
- 최근 대화 히스토리
- 현재 레벨

**핵심 출력 (JSON):**
```json
{
  "new_level": 1,
  "path": "LEVEL_HOLD | LEVEL_UP | LEVEL_DOWN | LEVEL_JUMP",
  "reasons": ["결정 이유"],
  "focus_area": "집중 영역",
  "custom_state": { "시나리오별 자유 형식 추적 데이터" }
}
```

**custom_state가 핵심이다.** 시나리오별 진행 상태(현재 동사, 연습 문장 수, 주제 전환 등)를 Planner LLM이 직접 관리한다. 첫 턴에서는 custom_state가 비어있으므로, "비어있으면 대화 히스토리를 보고 초기화하라"는 지시를 반드시 포함해야 한다.

**레벨 변경과 시나리오 내 진행은 독립 규칙으로 분리하라.** 예: 시제 연습에서 "동사 전환"과 "시제 전환"은 별개 규칙. Planner가 두 가지를 혼동하지 않도록 명확히 분리해야 한다.

**LLM 실패 시 rule-based fallback 동작:**
- score < 40 → LEVEL_DOWN (-1)
- 40-89 → LEVEL_HOLD (0)
- ≥ 90 → LEVEL_UP (+1)
- custom_state는 유지되지 않음 (빈 값으로 저장됨)

따라서 Planner LLM이 반드시 성공하도록 프롬프트를 간결하고 명확하게 작성하는 것이 중요하다.

### Conductor 프롬프트 작성

Conductor는 Planner 결과를 받아 각 참여자의 대사(스크립트)를 생성한다.

**핵심 출력 (JSON):**
```json
{
  "feedback_text": "모더레이터의 피드백",
  "scripts": [
    {"speaker_name": "민쌤", "text": "한국어 텍스트", "instruction": "", "language": "ko-KR"},
    {"speaker_name": "Emma", "text": "English text", "instruction": "", "language": "en-US"}
  ],
  "corrections": ["문법 교정 (화면 표시 전용, TTS 안 읽음)"],
  "better_expressions": ["더 나은 표현 (화면 표시 전용, TTS 안 읽음)"],
  "user_emotion": "neutral",
  "return_to_user_after": false
}
```

**speaker_name은 참여자 이름과 정확히 일치해야 한다.** 이 부분을 프롬프트에 명시하라.

**TTS 규칙을 프롬프트에 포함하라:**
- 따옴표, 괄호, 대괄호, 별표, 콜론, 이모지 사용 금지
- 각 참여자 스크립트는 1-2문장 MAX
- corrections와 better_expressions는 화면에만 표시되고 TTS로 읽히지 않음

**Scenario State 활용:** Planner가 custom_state에 저장한 값(현재 동사, 시제 등)이 Conductor에 전달된다. Conductor는 이 값을 참조하여 스크립트를 생성해야 한다.

---

## 레벨 정의 작성 가이드

```json
[
  {
    "level": 1,
    "name": "레벨 이름 (한국어)",
    "description": "레벨 설명",
    "instruction": "이 레벨에서 AI가 따라야 할 구체적 지시. Conductor에 전달됨"
  }
]
```

- 보통 5-10단계가 적절
- instruction은 Conductor가 스크립트 생성 시 참조하는 값
- instruction에 한국어 설명을 포함하면 민쌤(모더레이터)이 활용 가능
- instruction이 TTS로 직접 읽히지 않도록 Conductor 프롬프트에서 제어해야 함

---

## 모델 선택 가이드

| 용도 | 추천 모델 | 이유 |
|------|-----------|------|
| Evaluator | gemini-2.0-flash | 빠르고 JSON 안정적 |
| Planner | gemini-2.0-flash | custom_state JSON 처리 안정성 필요 |
| Conductor | gemini-2.0-flash | 스크립트 생성 품질과 속도 밸런스 |
| 참여자 LLM | gemini-2.0-flash | Conductor 스크립트 매칭 실패 시 fallback용 |

gemini-2.5-flash-lite는 JSON 파싱 실패율이 높으므로 파이프라인에 비추천.
gemini-2.5-flash는 품질은 좋지만 E2E 지연이 크게 증가하므로 속도가 중요한 경우 비추천.

---

## 출력 형식

최종 출력은 **유효한 TemplateCreate JSON** 한 블록이다. JSON 앞뒤에 설계 의도 설명을 간단히 덧붙여도 좋지만, JSON 자체가 메인 결과물이다.

사용자가 "이 JSON을 POST /api/v1/conversations/templates 에 보내면 템플릿이 생성됩니다"라고 안내한다.

---

## 흔한 실수와 해결법 (디버깅에서 배운 교훈)

1. **Conductor speaker_name 불일치** → LLM fallback 발동 → 스크립트 무시됨. 프롬프트에 정확한 이름 명시
2. **level_instruction이 TTS로 읽힘** → Conductor fallback에서 발생. 코드에서 수정됨. 프롬프트에서도 instruction을 text에 넣지 말라고 명시
3. **Planner가 시제/동사를 안 바꿈** → custom_state에 tense_sentence_count 같은 세부 카운터 필요. "2-3문장 후 전환" 규칙을 명확히
4. **Planner가 너무 빨리 레벨 올림** → "independent rules" 패턴으로 분리 (레벨 변경 vs 시나리오 내 진행)
5. **Evaluator 점수 0점** → JSON 출력 형식이 코드 기대와 불일치. 위의 정확한 JSON 구조를 프롬프트에 포함
6. **민쌤이 영어로 말함** → Conductor 프롬프트에 "모더레이터는 반드시 한국어로" 명시. persona에도 명시
7. **같은 문장 반복** → Conductor에 "history에 있는 문장과 다른 새로운 문장" 지시 필요
