Narrative Sync v0.2 요구사항 정의서

## 0. 문서 목적 및 원칙

- **목적:** Narrative Sync v0.2(Expert Pipeline)를 구현하기 위한 *모듈 분리 아키텍처*의 개발 요구사항을 기술팀이 바로 착수 가능한 수준으로 정의한다.
- **설계 원칙**
    - **역할 단일화:** Evaluator는 *진단만*, Planner는 *전략 결정만*, Conductor는 *실행 조율만* 담당한다.
    - **Data Contract 우선:** 모듈 간 통신은 **스키마가 고정된 JSON 계약**을 통해서만 이뤄진다.
    - **Latency First:** 사용자 체감 대기 시간을 줄이기 위해 **Streaming + Parallel + Pre-fetching**을 기본값으로 한다.
    - **Deterministic Output:** Evaluator/Planner는 가능한 한 **결정적(deterministic)** 결과를 내도록 모델/프롬프트/파라미터를 제한한다.
    - **관측 가능성(Observability):** 모든 단계에 **trace_id 기반 로그**를 남기며, 사후 분석이 가능해야 한다.

## 1. 배경 및 문제 정의 (v0.1 한계)

- v0.1 단일 오케스트레이터(Director)가 다음을 동시에 수행하면서 성능 한계와 지연이 발생했다.
    - 장면 통제
    - 페르소나 관리
    - 유저 발화 정밀 진단
- 테스트에서 **LLM 응답이 최대 16.7초**까지 치솟아 실시간 대화 흐름이 붕괴했다.

## 2. v0.2 목표 (Success Criteria)

### 2.1 성능 목표

- **End-to-End(사용자 발화 종료 → 첫 AI 음성 시작) 목표:**
    - p50: **≤ 3.0s**
    - p95: **≤ 5.0s**
- **Evaluator 응답:** p95 **≤ 1.0s** (final 평가 JSON 기준)
- **Planner 응답:** p95 **≤ 200ms** (규칙/테이블 기반 권장)
- **Conductor 스크립트 생성:** p95 **≤ 1.5s** (prefetch 포함)

### 2.2 학습/진단 목표

- 유저 발화를 **A/B/C(또는 선택된 패턴 블록) 기준으로 정량 평가**하여, 다음 발화 전략이 일관되게 결정되어야 한다.
- `Score < 60 / 60–89 / ≥ 90` 수준의 분기가 **재현 가능**해야 한다.

## 3. 범위(Scope)

### 3.1 In Scope

- Expert Pipeline 3모듈(Evaluator/Planner/Conductor) 구현
- Streaming STT 기반 **부분 텍스트(interim) 이벤트 처리**
- 데이터 계약(JSON 스키마) 확정 및 버전 관리
- 분기 로직(Decision Table) 구현
- 로그/지표/대시보드용 최소 이벤트 스키마

### 3.2 Out of Scope (v0.2에서는 제외)

- STT 없이 오디오만으로 의미/톤을 완전 분석하는 멀티모달 대형 모델 상시 적용
- 완전한 “Narrative Blocks Engine(주제별 가변 패턴 생성)”의 본격 설계 및 운영(다음 단계에서 논의)

## 4. 시스템 구성 (High-level)

### 4.1 핵심 컴포넌트

- **Client**: 오디오 입력/출력, UI 표시, 세션 유지
- **STT Streaming Layer**: interim/final transcript 이벤트 발행
- **Evaluator**: 진단 전용 LLM(또는 규칙/경량 모델 혼합)
- **Planner**: 전략 결정(룰 엔진 + 필요 시 소형 LLM)
- **Conductor**: 페르소나 스크립트 생성 및 TTS 큐잉
- **TTS**: 페르소나 보이스로 음성 생성
- **Session Store**: 현재 주제, 레벨, 최근 앵커 표현, 히스토리(짧게)
- **Logging/Analytics**: trace 기반 이벤트 적재

### 4.2 동작 모드

- **Streaming + Parallel**
    - STT interim이 들어오는 동안 Evaluator(Partial)는 *선행 진단*을 수행한다.
    - 발화 종료(VAD/Final STT) 시점에는 이미 전략 후보가 준비되어 있어야 한다.

## 5. 공통 데이터 계약 (필수 필드)

모든 요청/응답에 공통으로 포함되어야 하는 메타.

```json
{
  "schema_version": "0.2.0",
  "trace_id": "uuid",
  "session_id": "string",
  "turn_id": "string",
  "timestamp": "2026-02-28T23:00:00+09:00",
  "locale": "ko-KR",
  "topic": "string",
  "target_level": "L1|L2|L3",
  "active_pattern": "ABC" 
}
```

- **schema_version:** 필수. 하위 호환성 관리.
- **trace_id:** 필수. STT→Evaluator→Planner→Conductor→TTS 전 구간 관통.

## 6. STT Streaming 이벤트 스펙

### 6.1 이벤트 타입

- `stt.interim` : 부분 텍스트 갱신
- `stt.final` : 최종 텍스트 확정
- `vad.start` / `vad.end` : 발화 시작/종료(가능 시)

### 6.2 STT 이벤트 Payload

```json
{
  "type": "stt.interim",
  "trace_id": "uuid",
  "session_id": "string",
  "turn_id": "string",
  "seq": 12,
  "text": "First, I wake up and...",
  "is_final": false,
  "confidence": 0.86,
  "timing": {
    "chunk_start_ms": 1200,
    "chunk_end_ms": 1800
  }
}
```

- **seq:** chunk 순서. 재전송/역순 처리 대비.
- **confidence/timing:** Partial fluency 추정에 활용.

## 7. Evaluator 요구사항 (진단 모듈)

### 7.1 역할 정의

- 입력된 STT를 **정량 지표(JSON)** 로 변환한다.
- *전략 결정* 및 *발화 생성*을 수행하지 않는다.

### 7.2 입력

- `stt.final` 텍스트(필수)
- `stt.interim` 텍스트(선택, Partial 평가 목적)
- 선택 메타: 말속도, 무음구간, filler 등(가능하면 제공)

### 7.3 출력: Evaluator Final JSON (필수)

#### 7.3.1 스키마 (v0.2 최소 필드)

```json
{
  "schema_version": "0.2.0",
  "trace_id": "uuid",
  "session_id": "string",
  "turn_id": "string",
  "narrative_scores": {
    "slot_a": {"score": 0, "is_missing": true, "evidence": ""},
    "slot_b": {"score": 8, "is_missing": false, "evidence": "checked work emails"},
    "slot_c": {"score": 0, "is_missing": true, "evidence": ""}
  },
  "aggregate": {
    "slot_avg": 2.7,
    "imitation_score": 2,
    "complexity_score": 3,
    "overall_score": 42
  },
  "detected": {
    "anchors": ["First"],
    "connectors": ["First"],
    "used_key_phrases": []
  },
  "fluency": {
    "pause_count": 2,
    "words_per_minute": 85
  },
  "diagnosis": {
    "primary_issue": "MISSING_SLOT_C",
    "secondary_issues": ["MISSING_SLOT_A", "LOW_IMITATION"],
    "recommended_action": "TRIGGER_HELPER"
  }
}
```

#### 7.3.2 필드 규칙

- 점수 범위: **0–10** (slot_a/b/c, imitation, complexity)
- `overall_score`: 0–100 환산(Planner 분기 기준에 사용)
- `recommended_action`은 Planner를 돕는 힌트이며, **Planner가 최종 결정권**을 가진다.

### 7.4 Partial Evaluator (Streaming 병렬용, 선택)

- 목적: STT가 끝나기 전에 **슬롯 충족 여부/앵커 감지**를 선행 파악해 Planner/Conductor를 워밍업.
- 출력 이벤트: `eval.partial`

```json
{
  "type": "eval.partial",
  "trace_id": "uuid",
  "turn_id": "string",
  "partial": {
    "active_slot": "slot_a",
    "slot_status": {"slot_a": true, "slot_b": false, "slot_c": false},
    "detected_anchors": ["First"],
    "confidence": 0.7
  }
}
```

- `eval.partial`은 **정확성보다 속도** 우선. 최종 평가는 `eval.final`을 사용.

****난이도 높을 경우 단계적 접근(Phased Approach)*** 

- *우선 **Streaming STT**부터 잡고, **Pre-fetching**은 Jamie의 첫 문장만 미리 생성해두는 수준에서 시작*

### 7.5 모델/프롬프트 요구사항

- **Strict JSON** 강제(파싱 오류 0 목표)
- Temperature 낮게(재현성)
- “진단만” 수행하도록 시스템 프롬프트 분리

### 7.6 에러 처리

- JSON 파싱 실패 시:
    - 1차: 자동 재시도(동일 입력, 더 강한 JSON 강제)
    - 2차: 룰 기반 최소 진단(예: 키워드/커넥터 탐지)으로 degrade
    - 에러 이벤트 `eval.error` 로 남기기

## 8. Planner 요구사항 (전략 모듈)

### 8.1 역할 정의

- Evaluator 결과를 받아 **다음 교육 전략(개입/모델링/난이도 상향)** 을 결정한다.
- 가능한 한 **룰 엔진/테이블**로 구현하여 응답시간을 최소화한다.

### 8.2 입력

- `eval.final` JSON
- 세션 상태(Session Store): 최근 n턴(권장 3턴) 점수 추이, 레벨, 직전 전략

### 8.3 출력: Strategy Command (필수)

```json
{
  "schema_version": "0.2.0",
  "trace_id": "uuid",
  "turn_id": "string",
  "decision": {
    "path": "CRITICAL|STANDARD|ELITE",
    "action_code": "TRIGGER_HELPER|ADD_MODELING|DENSITY_UP",
    "reason": ["slot_avg<6", "missing_slot_c"],
    "next_constraints": {
      "target_pattern": "ABC",
      "must_include": ["Overall"],
      "banned": []
    }
  },
  "persona_plan": {
    "speakers": ["Sujin"],
    "order": ["Sujin"],
    "tone": "supportive",
    "language": "ko-KR"
  }
}
```

### 8.4 Decision Table (초기 버전)

- **CRITICAL (Score < 60)**
    - 조건(예시): `slot_avg < 6` 또는 `primary_issue`가 MISSING_SLOT_A/C
    - 액션: `TRIGGER_HELPER`
    - 출력: Helper가 한국어로 결손 슬롯을 짚고 재도전 유도
- **STANDARD (60–89)**
    - 액션: `ADD_MODELING`
    - 출력: Jamie/Alex가 동일 패턴의 확장 예시 1회 + 짧은 칭찬
- **ELITE (≥ 90) & complexity 낮음**
    - 조건(예시): `overall_score >= 90` & `complexity_score < 5`
    - 액션: `DENSITY_UP`
    - 출력: Mark가 더 조밀한 문장(연결어/형용사/절) 모델링

### 8.5 상태 머신(세션)

- `level` (L1/L2/L3)
- `topic`
- `recent_anchor_phrases` (최근 AI 모델링 앵커 표현)
- `last_strategy_code`
- `streak`(연속 성공/실패) 기반 난이도 조절(선택)

## 9. Conductor 요구사항 (실행 오케스트레이터)

### 9.1 역할 정의

- Planner의 Strategy Command를 실행으로 변환한다.
- 선택된 페르소나에게 스크립트 생성 지침을 주고, TTS 생성과 출력 순서를 관리한다.

### 9.2 입력

- Planner `Strategy Command`
- Persona Library(페르소나 설정): 이름, 말투, 금칙어, 앵커 표현 정책

### 9.3 출력

- `conductor.script` (페르소나별 생성된 최종 텍스트)
- `tts.request` (TTS 큐잉)

### 9.4 페르소나/스크립트 생성 규칙

- 페르소나 텍스트는 **짧은 지시문 + 최종 발화문**으로 구성(실무 디버깅 용이)
- Conductor는 “진단”을 하지 않는다. (Evaluator 결과를 그대로 반영)
- 발화 길이 제한(초기 권장):
    - Helper 개입: 1–2문장(한국어) + 재도전 질문 1개
    - Modeling: 3–5문장(영어) + 핵심 커넥터 강조
    - Density Up: 4–6문장(영어) + 연결어 2개 이상

### 9.5 Pre-fetching(병렬 준비) 요구사항

- `eval.partial` 또는 `stt.interim`에서 앵커/슬롯 상태가 특정 조건을 만족하면 다음을 선행한다.
    - (예) Slot A 감지 시: Modeling 스크립트 초안 생성 시작
    - 발화 종료 시점: 이미 생성된 초안에서 최종 확정만 수행

## 10. 병렬 처리/실시간 워크플로 스펙

### 10.1 이벤트 버스(권장)

- WebSocket 또는 gRPC stream 기반
- 이벤트 타입 예시:
    - `stt.interim`, `stt.final`
    - `eval.partial`, `eval.final`
    - `plan.decision`
    - `conductor.script`
    - `tts.start`, `tts.end`

### 10.2 Latency Budget (권장 배분)

- STT finalizing: 0.8–1.5s
- Evaluator final: ≤ 1.0s
- Planner: ≤ 0.2s
- Conductor + TTS 시작: ≤ 1.3s
- 총합 p50 3s 목표를 위해 **prefetch**는 필수.

## 11. 로깅/데이터 적재(필수)

### 11.1 최소 이벤트 로그(스키마)

- 공통: `trace_id`, `session_id`, `turn_id`, `timestamp`
- 이벤트별:
    - STT: text 길이, confidence, chunk_count
    - Evaluator: slot_a/b/c, overall_score, primary_issue
    - Planner: action_code, path, reason
    - Conductor: persona list, script length
    - TTS: voice_id, audio_duration_ms
    - Latency: 단계별 duration_ms

### 11.2 저장 정책

- 원문 텍스트 저장 여부는 개인정보/정책에 따르되, 최소한 점수/지표는 저장한다.
- 디버깅 모드에서만 원문 저장(옵션).

## 12. 품질/테스트 요구사항

### 12.1 기능 테스트 케이스(필수)

- A/C 누락 단답: `TRIGGER_HELPER`가 안정적으로 발생
- ABC 완성 + 낮은 complexity: `DENSITY_UP` 발생
- JSON 파싱 실패: degrade 로직 정상 동작
- 스트리밍 중간에 네트워크 끊김: turn 종료/재시도 정책 확인

### 12.2 회귀 테스트

- 동일 입력에 대해 Evaluator 점수 분산이 과도하지 않아야 함(temperature 관리)

## 13. 보안/개인정보(기본)

- session_id/trace_id는 개인 식별정보를 포함하지 않는다.
- 로그에 사용자 오디오 원본을 저장할 경우 별도 동의/정책 필요(기본 OFF 권장).

## 14. 산출물(Deliverables)

기술팀이 v0.2 구현을 위해 제출해야 하는 산출물.

- [ ]  Evaluator 프롬프트(Strict JSON) 및 `eval.final` 스키마 구현
- [ ]  Planner 룰 엔진/Decision Table 구현 + `plan.decision` 스키마
- [ ]  Conductor 프롬프트 템플릿 + persona config 구조
- [ ]  이벤트 버스(WebSocket/gRPC) 이벤트 정의 및 핸들러
- [ ]  Latency instrumentation(단계별 duration_ms)
- [ ]  최소 로그 적재(데이터 계약 버전 포함)

## 15. 최종 승인 기준(Definition of Done)

- p95 기준 **E2E ≤ 5s**를 지정된 테스트 시나리오에서 달성
- Evaluator/Planner/Conductor 모듈이 **독립 배포/교체 가능**한 구조로 분리
- 모든 모듈 간 통신이 **schema_version이 명시된 JSON 계약**으로 동작
- 최소 로그/지표가 수집되어, 세션별 성능/학습 품질을 사후 분석 가능

## 16. 주요 다이어그램

### 16.1 시스템 아키텍처 (Modular Architecture)

관찰(STT/Meta) - 진단(Evaluator) - 전략(Planner) - 실행(Conductor)으로 이어지는 모듈화된 구조

![image.png](attachment:cbd2214f-4171-4906-9d6d-8c80e8138ec2:image.png)

---

### 16.2 데이터 흐름도 (Data Flow)

사용자의 발화가 어떻게 수치화되고, 그 수치가 어떻게 다음 화자의 결정으로 이어지는지 보여주는 상세 흐름

![image.png](attachment:faef22a3-2af6-43b9-86a2-3ca2be2c28cf:image.png)

---

### 16.3 사용 시나리오 (Sequence Diagram)

v1.0 테스트에서 발생했던 **'서사 누락 및 교정'** 상황에 대한 시스템의 대응 프로세스

![image.png](attachment:45a4b1d6-54c6-48f1-839a-bc11c0955cb1:image.png)

### (참고) 다음 단계

- 본 스펙 완료 후, *초급 사용자의 v0.1 이용 후기*를 입력으로 받아 **Narrative Blocks Engine(가변 패턴)** 요구사항을 확장 정의한다.

## 17. 레이턴시 최적화 및 모델 운영 전략

### **17.1 프롬프트 체이닝(Prompt Chaining) 설계안**

하나의 거대한 프롬프트는 LLM을 혼란스럽게 하고 응답을 늦춥니다. 이를 세 단계로 분리(Chaining)하여 각 단계의 결과물을 다음 단계의 '파라미터'로 넘깁니다.

1. **Step 1 (Evaluator):** 유저 텍스트 분석 → **JSON 데이터만 출력** (가장 빠른 모델 사용)
2. **Step 2 (Planner):** JSON 수치 + 교육 규칙(Rule-set) 비교 → **전략 결정** (매우 짧은 프롬프트)
3. **Step 3 (Conductor):** 전략 + 페르소나 설정 → **최종 발화문 생성** (가장 똑똑한 모델 사용)

### **17.2 모델 사용 최적화 (Cost vs. Performance)**

현재의 파이프라인(STT-LLM-TTS)을 유지하면서 최적의 효율을 내는 **'Tiered 모델 전략'**입니다.

| **구분** | **적용 모델 (추천)** | **주요 역할 및 이유** | **비용/성능 균형** |
| --- | --- | --- | --- |
| **STT** | **Latest Long (Gemini)** | 한국어/영어 혼용 인식률이 높고, 실시간 스트리밍(interim)에 최적화됨. | 고정 비용 |
| **Evaluator** | **Gemini 1.5 Flash (8b)** | 사용자의 발화를 A-B-C 구조로 정량 분석. 속도가 압도적이며 JSON 모드에 최적화됨. | **최저 비용** |
| **Planner** | **Gemini 1.5 Flash (8b)** 
*(또는 Rule Engine)* | Evaluator의 점수를 분석해 다음 액션(개입/진행/상향)을 결정. 매우 짧은 추론이므로 Flash로 충분함. | **최저 비용** |
| **Conductor** | **Gemini 1.5 Pro** | Planner의 전략에 맞춰 페르소나별 풍부한 서사 스크립트 생성. 문맥 유지력이 가장 뛰어남. | 중간 비용 |
| **TTS** | **Gemini TTS** | 생성된 텍스트를 각 페르소나의 보이스로 즉시 변환. LLM과의 파이프라인 연동성 우수. | 고정 비용 |

---

# v0.3을 고려한 v0.2의 확장성

- **가변적 패턴(Active Pattern) 수용:** 현재는 `active_pattern`이 `ABC`로 고정되어 있지만, 나중에는 `7-step-routine`이나 `Reason-Example-Result` 등으로 바뀔 수 있음
- **UI 브릿지 확보:** v0.2에서는 `Word Bricks(단어 카드)`를 직접 띄우지 않더라도, **Planner**가 내리는 명령(`action_code`)에 `SHOW_HINT` 같은 예약어를 미리 정의해야 함.
- **메타데이터의 보존:** **Evaluator**가 분석한 세부 지표(`slot_a_score` 등)를 버리지 않고 DB에 쌓아두어야, v0.3에서 사용자의 취약점을 분석해 맞춤형 단어 카드를 추출할 수 있음.

# 관련 미팅 계획서

### 미팅 목표(요구사항 정의서 기준)

- **합의해야 할 것(Decision):**
    1. v0.2 범위(In/Out) 최종 확정
    2. **Data Contract(JSON 스키마 + 버전관리 방식)** 확정
    3. **Streaming + Parallel + Prefetch** 구현 방식(우선순위/단계) 확정
    4. **Latency Budget** 배분과 측정 기준(정의, 로그) 확정
    5. 모듈별 **DoD(Definition of Done)** 및 1차 마일스톤 산출물 확정
- **미팅 산출물(Output):**
    - “결정사항 리스트 + 남은 오픈 이슈 + 담당자/기한” 1장
    - 스키마(v0.2.0) 초안 확정본 또는 “오늘 확정 못 한 필드” 목록

---

### 참석자 제안(역할 기반)

- Tech Lead(아키텍처/우선순위 결정)
- Backend/Infra(Streaming STT, 이벤트 버스, 저장소)
- ML/LLM(평가 JSON, 프롬프트, 결정성/파싱 안정성)
- Client(턴 종료 기준, UI 이벤트, 오디오 I/O)
- PM(당신) + (선택) QA/데이터(회귀/로그 적재)

---

### 사전 준비(미팅 전 30–60분)

- 요구사항 정의서에서 아래 항목을 **“결정 필요”** 표시로 하이라이트
    - Turn 종료 기준: `vad.end` vs `stt.final` 기준 및 타임아웃
    - `session_id/turn_id` 생성 규칙, 재시도 시 동일성 유지 규칙
    - Partial 평가 정확도 요구 수준(“속도 우선”의 허용 범위)
    - 원문 텍스트 저장 정책(기본 OFF의 운영 방식)
- 기술팀에 미리 공유할 질문 5개(아래 아젠다에 포함)

---

### 60분 미팅 아젠다(권장)

### 0) 컨텍스트 정렬 (5분)

- v0.1 병목(최대 16.7s)과 v0.2 목표(p50≤3s, p95≤5s) 재확인
- “모듈 분리 + Data Contract 우선 + Observability” 원칙 재확인

### 1) 범위 & 단계적 접근(Phased) 확정 (10분)

- In/Out 최종 확정
- 난이도 높을 경우 문서에 적힌 phased approach를 **공식 로드맵**으로 합의
    - Phase 1: Streaming STT + 최소 Prefetch(예: 첫 문장만)
    - Phase 2: eval.partial + 본격 Prefetch/Parallel
    - Phase 3: 대시보드/회귀테스트 강화

### 2) Data Contract & 이벤트 버스 (15분)

- 공통 메타 필드 확정: `schema_version/trace_id/session_id/turn_id/timestamp/locale/topic/target_level/active_pattern`
- 이벤트 타입 확정: `stt.interim/stt.final/vad.start/vad.end/eval.partial/eval.final/plan.decision/conductor.script/tts.start/tts.end`
- **중요 토론 포인트(질문):**
    - seq 역순/중복 수신 시 처리(정렬/드롭/재조립 규칙)
    - `turn_id`는 언제 확정되는지(발화 시작 vs 종료)
    - schema_version 변경 정책(서버/클라 호환)

### 3) 모듈별 책임 경계(Interface) 체크 (15분)

- Evaluator: 진단만, Strict JSON 0 파싱 오류 목표(실패 시 degrade)
- Planner: 룰 엔진 우선(≤200ms), action_code와 제약조건 명확화
- Conductor: 진단 금지, script 생성 + TTS 큐잉, 길이 제한 준수
- **중요 토론 포인트(질문):**
    - Planner Decision Table을 코드/설정 중 어디에 둘지(배포/수정 속도)
    - Conductor가 prefetch 초안을 어디까지 만들고, final에서 무엇을 덮어쓰는지

### 4) Latency Budget & 계측(Instrumentation) 합의 (10분)

- 단계별 duration_ms 정의(어디서 타이머 시작/끝)
- p50/p95 산출 방식(윈도우, 샘플 수, 제외 케이스)
- 최소 로그 스키마 확정 + 저장 위치/대시보드 후보

### 5) DoD / 산출물 / 다음 액션 (5분)

- Deliverables 체크리스트(문서 14장) 기준으로 “이번 스프린트 최소” 확정
- 오너/기한/리스크(특히 Streaming 안정성, JSON 파싱, 네트워크 끊김) 기록

---

### 미팅 중 “결정 로그” 템플릿(그대로 복붙)

- **결정 1:** (무엇) / (이유) / (대안) / (오너) / (완료일)
- **결정 2:** …
- **오픈 이슈:** (결정 못 한 것) / (추가 정보) / (담당) / (다음 논의일)
- **리스크:** (리스크) / (완화책) / (트리거 지표)

---

### 기술팀에 던질 핵심 질문 10개(우선순위 순)

1. 이벤트 버스는 WebSocket vs gRPC 중 무엇이 현실적인가? (현재 스택/운영 고려)
2. `vad.end`를 확보 못 하면 turn 종료를 어떻게 정의할 것인가?
3. `trace_id/session_id/turn_id` 생성 주체는 어디인가(Client/Server)?
4. interim chunk 재전송/역순 수신 시 처리 규칙은?
5. Evaluator Strict JSON 파싱 실패의 “재시도 정책”을 어디에서 책임질 것인가?
6. Planner Decision Table은 설정 파일로 분리 가능한가(운영 중 빠른 튜닝 목적)?
7. Prefetch는 어떤 조건에서 시작하고(예: slot_a 감지), 어디까지 생성할 것인가(첫 문장/전체 초안)?
8. 텍스트 원문 저장 OFF일 때도 디버깅 가능한 최소 로그는 무엇인가?
9. p95≤5s를 깨는 케이스를 자동으로 수집/리포팅하는 장치는 무엇인가?
10. 네트워크 끊김 시 turn 종료/재시도 정책(사용자 경험 포함)은?