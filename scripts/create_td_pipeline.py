#!/usr/bin/env python3
"""
TD-v1 Judge → Route → Render 파이프라인 생성 + 템플릿 연결 스크립트
(My Turn 세션용 — 실패 패턴 감지 → 우선순위 해석 → 개입 렌더링 → 응답 조립)

사용법:
    cd apps/server
    # 파이프라인만 생성
    poetry run python ../../scripts/create_td_pipeline.py

    # 파이프라인 생성 + 템플릿 목록 보기
    poetry run python ../../scripts/create_td_pipeline.py --list-templates

    # 파이프라인 생성 + 특정 템플릿에 자동 연결
    poetry run python ../../scripts/create_td_pipeline.py --template-id <UUID>

    # graph_json만 출력
    poetry run python ../../scripts/create_td_pipeline.py --dump-json
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

# ─── 설정 ─────────────────────────────────────────────────────────────────────

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"
PIPELINE_NAME = "TD-v1 Judge → Route → Render v2"
PIPELINE_DESCRIPTION = (
    "실패 패턴 감지(Judge) → 우선순위 해석(Code) → 개입 생성(Renderer) → 응답 조립(Conductor)\n"
    "벤치마크 TD-v1 기준 7개 실패 패턴 / 5개 모듈 / 후보집 기반 최소 개입\n"
    "v2: declared_outputs 추가, thinking_budget=0(속도 최적화), 참조 버그 수정"
)
TIMEOUT_MS = 60000

# ─── 프롬프트 ──────────────────────────────────────────────────────────────────

FAILURE_JUDGE_PROMPT = """\
당신은 영어 발화 실패 패턴을 분석하는 전문 평가자입니다.

## 실패 패턴 정의 (우선순위 순)

### 1. Repair Need (최우선)
- 기본 시제·의미 붕괴로 즉각 수정 없이 대화 진행이 불가한 경우
- 예) "I go there yesterday and seen him"

### 2. Start Delay
- first_response_delay_sec > 3.0 이거나 asked_for_repeat = true
- 시작 자체에 어려움

### 3. Structure Collapse
- 주어+동사 이후 구조가 무너진 경우: "I feel...", "It's like..."
- feeling/state 질문에서 "I feel..." 형태 → Structure Collapse 우선
- Translation Trap(한국어 어순 직역)도 이 카테고리

### 4. Empty Start
- 의미 있는 발화 전혀 없음 (감탄사·웃음·무응답)

### 5. Vocab Hunting
- "um...", "uh...", "how do you say...", "what is the word..." 패턴

### 6. Over-Control / Freeze
- 자기검열로 시도 흔적이 있지만 멈추는 상태 (Empty Start와 구분)

## 우선순위 규칙
1. Repair Need > Start Delay > Structure Collapse > Empty Start > Vocab Hunting > Over-Control
2. feeling/state 질문에서 "I feel..." / "I think..." 중단 → Structure Collapse 우선
3. first_response_delay_sec > 3.0 이고 Repair Need 아니면 → Start Delay 우선 고려

## 입력 데이터
입력은 JSON으로 제공됩니다. 모든 필드를 종합해 판단하세요.

## 출력 (JSON만, 마크다운 코드블록 없이)
{
  "primary_failure_pattern": "<패턴명>",
  "confidence": <0.0~1.0>,
  "reason": "<판단 근거 1~2문장>",
  "secondary_candidates": ["<패턴명>"]
}\
"""

RENDERER_PROMPT = """\
당신은 영어 회화 학습 AI 튜터의 개입 렌더러입니다.
선택된 모듈과 후보 문구 bank를 기반으로, 학습자의 발화 실패에 대한 최소한의 개입 문구 1개를 선택하거나 경미하게 변형합니다.

## 모듈별 개입 원칙

- **Start**: 짧은 문장 시작 후보 제시. 2~4단어.
- **Extend**: 학습자 발화에 이어붙일 연결어. 완성 문장 X.
- **Repair**: 직접 수정 없이 clarification 요청. 의문문 1개.
- **Structure Shift**: 학습자가 말하려던 내용에 맞는 완성된 짧은 문장 1개.
- **Simplify**: 더 쉬운 단어/구조 유도 힌트.

## 규칙
1. 반드시 candidate_bank 안에서 선택하거나 최소 변형만 허용
2. 새로운 문장 자유 창작 금지
3. 설명 없이 개입 문구 1개만 반환

## 출력 (JSON만, 마크다운 코드블록 없이)
{
  "intervention_emitted": "<개입 문구>",
  "intervention_type": "<type 값>",
  "candidate_key": "<key 값>"
}\
"""

CONDUCTOR_PROMPT = """\
당신은 영어 회화 학습 세션의 AI 진행자(Conductor)입니다.
이전 단계에서 실패 패턴이 감지되고 개입 전략이 결정되었습니다.
이 정보를 바탕으로 학습자에게 전달할 최종 피드백과 세션 지속을 위한 정보를 생성합니다.

## 각 필드 작성 지침

- **feedback_text**: 학습자에게 자연스럽게. 개입 문구(intervention_text)를 녹여서. 1~2문장.
- **feedback_instruction**: 이 피드백을 어떤 톤으로 전달할지 (calm / encouraging / brief / firm). 1문장.
- **level**: 1~5 정수. 학습자 현재 수준.
- **level_instruction**: level에 맞는 영어 난이도 지침. 1문장.
- **corrections**: 발화 오류 수정 목록. 없으면 [].
  형식: [{"original": "...", "corrected": "...", "reason": "..."}]
- **better_expressions**: 더 자연스러운 표현 제안. 없으면 [].
  형식: [{"original": "...", "better": "...", "note": "..."}]
- **speaker_scripts**: 참여자별 대화 이어가기 스크립트 힌트. 없으면 {}.
- **user_emotion**: neutral / frustrated / engaged / confused / shy 중 하나.
- **engine_trace**: 내부 추적용. failure_pattern, selected_module, intervention_type 포함.

## 출력 (JSON만, 마크다운 코드블록 없이)
반드시 required 필드를 모두 포함하세요.\
"""

# ─── 코드 노드: 우선순위 해석 + 모듈 선택 ─────────────────────────────────────

PRIORITY_RESOLVER_CODE = '''\
async def execute(inputs):
    PRIORITY_ORDER = [
        "Repair Need",
        "Start Delay",
        "Structure Collapse",
        "Empty Start",
        "Vocab Hunting",
        "Translation Trap",
        "Over-Control / Freeze",
    ]

    FAILURE_TO_MODULE = {
        "Start Delay": "Start",
        "Empty Start": "Extend",
        "Repair Need": "Repair",
        "Structure Collapse": "Structure Shift",
        "Translation Trap": "Structure Shift",
        "Vocab Hunting": "Simplify",
        "Over-Control / Freeze": "Start",
    }

    CANDIDATE_BANK = {
        "Start": [
            {"key": "start_i_think", "type": "sentence_head", "text": "I think..."},
            {"key": "start_maybe", "type": "sentence_head", "text": "Maybe..."},
        ],
        "Extend": [
            {"key": "extend_because", "type": "connector", "text": "because ..."},
            {"key": "extend_and", "type": "connector", "text": "and ..."},
        ],
        "Repair": [
            {"key": "repair_again", "type": "clarification_request", "text": "Can you say that again?"},
            {"key": "repair_mean", "type": "clarification_request", "text": "Do you mean ...?"},
        ],
        "Structure Shift": [
            {"key": "ss_music", "type": "structure_candidate", "text": "Music makes me feel better."},
            {"key": "ss_decision", "type": "structure_candidate", "text": "I made a decision."},
        ],
        "Simplify": [
            {"key": "simp_easy_word", "type": "simplify_prompt", "text": "Use a simpler word."},
            {"key": "simp_basic_verb", "type": "simplify_prompt", "text": "Try have / get / make."},
        ],
    }

    primary = inputs.get("primary_failure_pattern") or ""
    secondary = inputs.get("secondary_candidates") or []
    if isinstance(secondary, str):
        secondary = []
    confidence = float(inputs.get("confidence") or 0)
    response_delay_sec = float(inputs.get("response_delay_sec") or 0)

    resolved_pattern = primary
    applied_rules = []

    # Rule 1: Start Delay override — 응답 지연이 3초 초과이고 Repair Need가 아니면
    if response_delay_sec > 3.0 and primary not in ("Repair Need",):
        if primary != "Start Delay":
            resolved_pattern = "Start Delay"
            applied_rules.append("start_delay_override")

    # Rule 2: 신뢰도 낮을 때 secondary 중 우선순위 높은 패턴으로 교체
    if confidence < 0.6 and secondary:
        def _idx(p):
            try:
                return PRIORITY_ORDER.index(p)
            except ValueError:
                return 99
        p_idx = _idx(resolved_pattern)
        for cand in secondary:
            c_idx = _idx(cand)
            if c_idx < p_idx:
                resolved_pattern = cand
                applied_rules.append("secondary_override:" + cand)
                p_idx = c_idx

    selected_module = FAILURE_TO_MODULE.get(resolved_pattern, "Start")
    candidate_bank = CANDIDATE_BANK.get(selected_module, [])

    return {
        "resolved_pattern": resolved_pattern,
        "selected_module": selected_module,
        "candidate_bank": candidate_bank,
        "resolver_trace": {
            "original_pattern": primary,
            "resolved_pattern": resolved_pattern,
            "applied_rules": applied_rules,
            "confidence": confidence,
        },
    }
'''

# ─── 출력 스키마 ───────────────────────────────────────────────────────────────

FAILURE_JUDGE_SCHEMA = {
    "type": "object",
    "required": ["primary_failure_pattern", "confidence", "reason"],
    "properties": {
        "primary_failure_pattern": {"type": "string"},
        "confidence": {"type": "number"},
        "reason": {"type": "string"},
        "secondary_candidates": {"type": "array", "items": {"type": "string"}},
    },
}

RENDERER_SCHEMA = {
    "type": "object",
    "required": ["intervention_emitted", "intervention_type", "candidate_key"],
    "properties": {
        "intervention_emitted": {"type": "string"},
        "intervention_type": {"type": "string"},
        "candidate_key": {"type": "string"},
    },
}

CONDUCTOR_SCHEMA = {
    "type": "object",
    "required": [
        "feedback_text", "feedback_instruction", "level", "level_instruction",
        "corrections", "better_expressions", "speaker_scripts", "user_emotion",
    ],
    "properties": {
        "feedback_text": {"type": "string"},
        "feedback_instruction": {"type": "string"},
        "level": {"type": "integer"},
        "level_instruction": {"type": "string"},
        "corrections": {"type": "array"},
        "better_expressions": {"type": "array"},
        "speaker_scripts": {"type": "object"},
        "user_emotion": {"type": "string"},
        "question_progress": {"type": "object"},
        "energy_flow": {"type": "object"},
        "engine_trace": {"type": "object"},
    },
}

# ─── 그래프 JSON ───────────────────────────────────────────────────────────────

def build_graph() -> dict:
    nodes = [
        # ── 시작 ────────────────────────────────────────────────────────────────
        {
            "id": "start_1",
            "type": "start",
            "position": {"x": 60, "y": 260},
            "data": {
                "label": "사용자 입력",
                # 하위 노드가 참조할 수 있는 시작 필드 목록 (출력 레지스트리용)
                "declared_outputs": [
                    {"key": "transcript",         "label": "사용자 발화",   "path": "transcript"},
                    {"key": "history",            "label": "대화 이력",     "path": "history"},
                    {"key": "topic",              "label": "주제",          "path": "topic"},
                    {"key": "scene_context",      "label": "장면 문맥",     "path": "scene_context"},
                    {"key": "participants",        "label": "참여자 목록",   "path": "participants"},
                    {"key": "variant",            "label": "세션 상태",     "path": "variant"},
                    {"key": "measured_wpm",       "label": "실측 WPM",      "path": "measured_wpm"},
                    {"key": "response_delay_sec", "label": "응답 지연(초)", "path": "response_delay_sec"},
                ],
            },
        },

        # ── 실패 패턴 판정 (LLM) ────────────────────────────────────────────────
        {
            "id": "failure_judge",
            "type": "llm",
            "position": {"x": 400, "y": 260},
            "data": {
                "label": "실패 패턴 판정",
                "model": "gemini-2.5-flash",
                "response_format": "json",
                "temperature": 0,
                "thinking_budget": 0,   # thinking 비활성화 → 1~2초
                "retry_count": 2,
                "timeout_ms": 15000,
                "prompt": FAILURE_JUDGE_PROMPT,
                "input_variables": {
                    "user_utterance_text":      "{{start.transcript}}",
                    "history":                  "{{start.history}}",
                    "question_text":            "{{start.topic}}",
                    "scene_context":            "{{start.scene_context}}",
                    "first_response_delay_sec": "{{start.response_delay_sec}}",
                    "measured_wpm":             "{{start.measured_wpm}}",
                },
                "output_schema": FAILURE_JUDGE_SCHEMA,
                "declared_outputs": [
                    {"key": "result.primary_failure_pattern", "label": "판정 패턴",      "path": "result.primary_failure_pattern"},
                    {"key": "result.confidence",              "label": "신뢰도",          "path": "result.confidence"},
                    {"key": "result.reason",                  "label": "판단 근거",       "path": "result.reason"},
                    {"key": "result.secondary_candidates",    "label": "후보 패턴 목록",  "path": "result.secondary_candidates"},
                ],
            },
        },

        # ── 우선순위 해석 + 모듈 선택 (Code) ───────────────────────────────────
        {
            "id": "priority_resolver",
            "type": "code",
            "position": {"x": 800, "y": 260},
            "data": {
                "label": "우선순위 해석 + 모듈 선택",
                "code": PRIORITY_RESOLVER_CODE,
                "timeout_ms": 5000,
                "input_variables": {
                    # LLM 노드 출력은 result 래핑 → .result.field
                    "primary_failure_pattern": "{{failure_judge.result.primary_failure_pattern}}",
                    "secondary_candidates":    "{{failure_judge.result.secondary_candidates}}",
                    "confidence":              "{{failure_judge.result.confidence}}",
                    # start 필드는 특수 scope key 'start' 사용
                    "response_delay_sec":      "{{start.response_delay_sec}}",
                },
                # Code 노드 출력은 result 래핑 없음 → 최상위 키 직접 참조
                "declared_outputs": [
                    {"key": "resolved_pattern", "label": "최종 실패 패턴",    "path": "resolved_pattern"},
                    {"key": "selected_module",  "label": "선택 모듈",         "path": "selected_module"},
                    {"key": "candidate_bank",   "label": "후보 문구 목록",    "path": "candidate_bank"},
                    {"key": "resolver_trace",   "label": "해석 추적 정보",    "path": "resolver_trace"},
                ],
            },
        },

        # ── 개입 렌더러 (LLM) ───────────────────────────────────────────────────
        {
            "id": "renderer",
            "type": "llm",
            "position": {"x": 1200, "y": 260},
            "data": {
                "label": "개입 렌더러",
                "model": "gemini-2.5-flash",
                "response_format": "json",
                "temperature": 0.1,
                "thinking_budget": 0,
                "retry_count": 2,
                "timeout_ms": 12000,
                "prompt": RENDERER_PROMPT,
                "input_variables": {
                    # Code 노드 출력 → result 래핑 없음
                    "selected_module":      "{{priority_resolver.selected_module}}",
                    "candidate_bank":       "{{priority_resolver.candidate_bank}}",
                    "user_utterance_text":  "{{start.transcript}}",
                    "question_text":        "{{start.topic}}",
                    "scene_context":        "{{start.scene_context}}",
                },
                "output_schema": RENDERER_SCHEMA,
                "declared_outputs": [
                    {"key": "result.intervention_emitted", "label": "개입 문구",  "path": "result.intervention_emitted"},
                    {"key": "result.intervention_type",    "label": "개입 타입",  "path": "result.intervention_type"},
                    {"key": "result.candidate_key",        "label": "후보 키",    "path": "result.candidate_key"},
                ],
            },
        },

        # ── 컨덕터 (LLM) ────────────────────────────────────────────────────────
        {
            "id": "conductor",
            "type": "llm",
            "position": {"x": 1600, "y": 260},
            "data": {
                "label": "컨덕터",
                "model": "gemini-2.5-flash",
                "response_format": "json",
                "temperature": 0.2,
                "thinking_budget": 0,
                "retry_count": 2,
                "timeout_ms": 15000,
                "prompt": CONDUCTOR_PROMPT,
                "input_variables": {
                    "transcript":         "{{start.transcript}}",
                    "history":            "{{start.history}}",
                    "topic":              "{{start.topic}}",
                    "scene_context":      "{{start.scene_context}}",
                    "participants":       "{{start.participants}}",
                    # Code 노드 출력 → result 래핑 없음
                    "failure_pattern":    "{{priority_resolver.resolved_pattern}}",
                    "selected_module":    "{{priority_resolver.selected_module}}",
                    "resolver_trace":     "{{priority_resolver.resolver_trace}}",
                    # LLM 노드 출력 → result 래핑 있음
                    "intervention_text":  "{{renderer.result.intervention_emitted}}",
                    "intervention_type":  "{{renderer.result.intervention_type}}",
                },
                "output_schema": CONDUCTOR_SCHEMA,
                "declared_outputs": [
                    {"key": "result.feedback_text",        "label": "피드백 텍스트",     "path": "result.feedback_text"},
                    {"key": "result.feedback_instruction", "label": "피드백 지시",       "path": "result.feedback_instruction"},
                    {"key": "result.level",                "label": "학습 레벨",         "path": "result.level"},
                    {"key": "result.level_instruction",    "label": "레벨 지침",         "path": "result.level_instruction"},
                    {"key": "result.corrections",          "label": "교정 목록",         "path": "result.corrections"},
                    {"key": "result.better_expressions",   "label": "더 나은 표현",      "path": "result.better_expressions"},
                    {"key": "result.speaker_scripts",      "label": "스크립트 힌트",     "path": "result.speaker_scripts"},
                    {"key": "result.user_emotion",         "label": "사용자 감정",       "path": "result.user_emotion"},
                    {"key": "result.engine_trace",         "label": "엔진 추적",         "path": "result.engine_trace"},
                ],
            },
        },

        # ── 출력 ────────────────────────────────────────────────────────────────
        {
            "id": "end_1",
            "type": "end",
            "position": {"x": 2000, "y": 260},
            "data": {
                "label": "파이프라인 출력",
                "output_mapping": {
                    "feedback_text":        "{{conductor.result.feedback_text}}",
                    "feedback_instruction": "{{conductor.result.feedback_instruction}}",
                    "level":                "{{conductor.result.level}}",
                    "level_instruction":    "{{conductor.result.level_instruction}}",
                    "corrections":          "{{conductor.result.corrections}}",
                    "better_expressions":   "{{conductor.result.better_expressions}}",
                    "speaker_scripts":      "{{conductor.result.speaker_scripts}}",
                    "user_emotion":         "{{conductor.result.user_emotion}}",
                    # 선택 필드 — 없으면 None 반환하도록 .get() 사용
                    "question_progress":    "{{conductor.result.get('question_progress')}}",
                    "energy_flow":          "{{conductor.result.get('energy_flow')}}",
                    "engine_trace":         "{{conductor.result.get('engine_trace')}}",
                },
            },
        },
    ]

    edges = [
        {"id": "e1", "source": "start_1",          "target": "failure_judge",     "type": "animated", "animated": True},
        {"id": "e2", "source": "failure_judge",     "target": "priority_resolver", "type": "animated", "animated": True},
        {"id": "e3", "source": "priority_resolver", "target": "renderer",          "type": "animated", "animated": True},
        {"id": "e4", "source": "renderer",          "target": "conductor",         "type": "animated", "animated": True},
        {"id": "e5", "source": "conductor",         "target": "end_1",             "type": "animated", "animated": True},
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "viewport": {"x": 0, "y": 0, "zoom": 0.55},
    }


# ─── API 호출 헬퍼 ────────────────────────────────────────────────────────────

def api_call(
    base_url: str,
    method: str,
    path: str,
    body: dict | None = None,
    token: str | None = None,
) -> dict:
    url = f"{base_url}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode()
        print(f"  HTTP {exc.code}: {body_text[:400]}", file=sys.stderr)
        raise


def login(base_url: str, username: str, password: str) -> str:
    resp = api_call(base_url, "POST", "/api/v1/auth/login", {"username": username, "password": password})
    return resp["token"]


def list_templates(base_url: str, token: str) -> list[dict]:
    resp = api_call(base_url, "GET", "/api/v1/conversations/templates?limit=50", token=token)
    return resp.get("items") or []


# ─── 메인 ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="TD-v1 파이프라인 생성 + 템플릿 연결")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--username", default=DEFAULT_USERNAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--template-id", default=None, help="연결할 템플릿 UUID")
    parser.add_argument("--list-templates", action="store_true", help="사용 가능한 템플릿 목록 출력 후 종료")
    parser.add_argument("--dump-json", action="store_true", help="graph_json만 출력하고 종료")
    args = parser.parse_args()

    graph = build_graph()

    if args.dump_json:
        print(json.dumps(graph, ensure_ascii=False, indent=2))
        return

    print(f"[1/4] 로그인 중... ({args.base_url})")
    token = login(args.base_url, args.username, args.password)
    print("      OK")

    # 템플릿 목록만 보고 싶은 경우
    if args.list_templates:
        templates = list_templates(args.base_url, token)
        print("\n사용 가능한 템플릿:")
        for t in templates:
            print(f"  {t['id']}  [{t.get('pipeline_mode','basic')}]  {t['name']}")
        print("\n--template-id <UUID> 로 연결할 템플릿을 지정하세요.")
        return

    print("[2/4] 파이프라인 생성 중...")
    pipeline = api_call(
        args.base_url,
        "POST",
        "/api/v1/visual-pipelines",
        {
            "name": PIPELINE_NAME,
            "description": PIPELINE_DESCRIPTION,
            "graph_json": graph,
            "timeout_ms": TIMEOUT_MS,
        },
        token=token,
    )
    pipeline_id = pipeline["id"]
    print(f"      생성 완료 — id: {pipeline_id}")

    print("[3/4] 그래프 유효성 검사 중...")
    validate = api_call(
        args.base_url,
        "POST",
        f"/api/v1/visual-pipelines/{pipeline_id}/validate",
        body={"graph_json": graph},
        token=token,
    )
    if validate.get("valid"):
        print("      유효성 검사 통과")
    else:
        print(f"      경고 — 오류: {validate.get('errors')}")

    # 템플릿 연결
    if args.template_id:
        print(f"[4/4] 템플릿 연결 중... (template_id={args.template_id})")
        link_result = api_call(
            args.base_url,
            "PUT",
            f"/api/v1/visual-pipelines/templates/{args.template_id}/link",
            body={
                "pipeline_id": pipeline_id,
                "pipeline_version": None,   # None = 항상 최신 버전 사용
            },
            token=token,
        )
        print(f"      연결 완료 — pipeline_mode가 'visual'로 설정됨")
        print(f"      연결 이름: {link_result.get('pipeline_name')}")
    else:
        print("[4/4] 템플릿 연결 건너뜀 (--template-id 미지정)")
        print("      나중에 어드민 > AI Lab > 템플릿 연결 페이지에서 연결하세요.")

    print()
    print("=" * 65)
    print("파이프라인 생성 완료!")
    print(f"  이름  : {PIPELINE_NAME}")
    print(f"  ID    : {pipeline_id}")
    print(f"  노드  : {len(graph['nodes'])}개  엣지: {len(graph['edges'])}개")
    print()
    print("다음 단계:")
    if not args.template_id:
        print("  1. 어드민 > AI Lab > 템플릿 연결 에서 My Turn 템플릿과 연결")
        print(f"     또는: --template-id <UUID> 로 재실행")
        print("  2. My Turn 세션에서 발화 입력 → 파이프라인 자동 실행")
        print("  3. 어드민 > AI Lab > 파이프라인 실행 로그 에서 노드별 로그 확인")
    else:
        print("  1. My Turn 세션에서 발화 입력 → 파이프라인 자동 실행")
        print("  2. 어드민 > AI Lab > 파이프라인 실행 로그 에서 노드별 로그 확인")
    print("=" * 65)


if __name__ == "__main__":
    main()
