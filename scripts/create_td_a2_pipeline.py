#!/usr/bin/env python3
"""
TD-v1 Rule-assisted Direct Routing (안 2) 파이프라인 생성 + 템플릿 연결 스크립트

설계: Feature Extractor → Rule Router → Priority Handler → Module Mapper
       → Candidate Selector → Conductor (LLM)

안 1 (Judge→Route→Render)과의 차이:
  - LLM 호출 1회 (Conductor만) — 속도 우위
  - 실패 패턴 감지·모듈 선택을 규칙 코드로 처리 — 로직 투명성 우위
  - 안 1 대비 baseline 역할 (accuracy vs latency 비교 기준)

사용법:
    cd apps/server

    # 파이프라인만 생성
    poetry run python ../../scripts/create_td_a2_pipeline.py

    # 파이프라인 생성 + 템플릿 자동 연결
    poetry run python ../../scripts/create_td_a2_pipeline.py --template-id <UUID>

    # 템플릿 목록 확인
    poetry run python ../../scripts/create_td_a2_pipeline.py --list-templates

    # graph_json만 출력
    poetry run python ../../scripts/create_td_a2_pipeline.py --dump-json
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
PIPELINE_NAME    = "TD-v1 Rule-assisted Direct Routing (A2)"
PIPELINE_DESCRIPTION = (
    "규칙 기반 실패 패턴 감지 → 모듈 선택 → 후보집 직접 선택 → Conductor 응답 조립\n"
    "LLM 1회 호출(Conductor만). 안 1(Judge→Route→Render) 대비 baseline 아키텍처.\n"
    "벤치마크 TD-v1 기준 7개 실패 패턴 / 5개 모듈 / 후보집 기반 최소 개입"
)
TIMEOUT_MS = 45000  # A2는 LLM 1회 → 더 짧게

# ─── Conductor 프롬프트 (A1과 동일) ──────────────────────────────────────────

CONDUCTOR_PROMPT = """\
당신은 영어 회화 학습 세션의 AI 진행자(Conductor)입니다.
이전 단계에서 규칙 기반으로 실패 패턴이 감지되고 개입 전략이 결정되었습니다.
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

CONDUCTOR_SCHEMA = {
    "type": "object",
    "required": [
        "feedback_text", "feedback_instruction", "level", "level_instruction",
        "corrections", "better_expressions", "speaker_scripts", "user_emotion",
    ],
    "properties": {
        "feedback_text":        {"type": "string"},
        "feedback_instruction": {"type": "string"},
        "level":                {"type": "integer"},
        "level_instruction":    {"type": "string"},
        "corrections":          {"type": "array"},
        "better_expressions":   {"type": "array"},
        "speaker_scripts":      {"type": "object"},
        "user_emotion":         {"type": "string"},
        "question_progress":    {"type": "object"},
        "energy_flow":          {"type": "object"},
        "engine_trace":         {"type": "object"},
    },
}

# ─── 코드 노드 ────────────────────────────────────────────────────────────────

# ── 1. Feature Extractor ──────────────────────────────────────────────────────
FEATURE_EXTRACTOR_CODE = '''\
async def execute(inputs):
    import re

    transcript          = str(inputs.get("transcript") or "").strip()
    response_delay_sec  = float(inputs.get("response_delay_sec") or 0)
    asked_for_repeat    = bool(inputs.get("asked_for_repeat") or False)
    history             = inputs.get("history") or []

    # 직전 AI 발화에서 질문 텍스트 추출
    question_text = ""
    if isinstance(history, list):
        for msg in reversed(history):
            if isinstance(msg, dict):
                role = msg.get("role") or msg.get("type") or ""
                speaker = msg.get("speaker") or ""
                if role in ("assistant", "ai") or (speaker and speaker.lower() != "user"):
                    question_text = str(msg.get("text") or msg.get("content") or "")
                    break

    qt_lower = question_text.lower()
    tr_lower = transcript.lower()
    words    = transcript.split()
    wc       = len(words)

    # ── question_family 분류 ─────────────────────────────────────────────────
    question_family = "general"
    if any(kw in qt_lower for kw in ["feel", "feeling", "emotion", "mood", "happy", "sad", "excited", "nervous"]):
        question_family = "feeling_state"
    elif any(kw in qt_lower for kw in ["problem", "issue", "wrong", "trouble", "difficult", "broken"]):
        question_family = "problem_description"
    elif any(kw in qt_lower for kw in ["like", "love", "prefer", "favorite", "enjoy", "favorite"]):
        question_family = "preference"
    elif qt_lower.strip().endswith("?") and any(
        qt_lower.lstrip().startswith(w)
        for w in ["do you", "did you", "have you", "are you", "were you", "can you", "will you"]
    ):
        question_family = "yes_no"
    elif any(kw in qt_lower for kw in ["how", "what", "where", "when", "why", "who"]):
        question_family = "wh_question"

    # ── is_empty_utterance ───────────────────────────────────────────────────
    is_empty_utterance = wc == 0 or transcript in ("", "...", "…")

    # ── looks_fragmented ────────────────────────────────────────────────────
    # - 줄임표로 끝남
    # - 주어+동사 이후 중단 (I feel..., It\'s like..., I think...)
    fragment_prefixes = ["i feel", "it\'s like", "i think", "it is", "i am", "i\'m", "she is", "he is"]
    looks_fragmented = (
        transcript.endswith("...") or
        transcript.endswith("…") or
        (wc <= 5 and any(tr_lower.startswith(p) for p in fragment_prefixes))
    )

    # ── looks_minimal_answer ─────────────────────────────────────────────────
    looks_minimal_answer = 1 <= wc <= 3 and not is_empty_utterance

    # ── looks_translation_like ──────────────────────────────────────────────
    # 한국어 어순 직역 패턴 (subject + adj + very 또는 동사 위치 이상)
    translation_markers = [
        "it is very", "is very delicious", "very very",
        "i am very enjoy", "i like very much",
        "yesterday i go", "yesterday i eat",
    ]
    looks_translation_like = any(m in tr_lower for m in translation_markers)

    # ── looks_vocab_hunting ─────────────────────────────────────────────────
    vh_markers = ["how do you say", "what is the word", "i don\'t know the word",
                  "um,", "uh,", " um ", " uh ", "i mean,"]
    looks_vocab_hunting = (
        transcript.count("...") >= 2 or
        any(m in tr_lower for m in vh_markers) or
        bool(re.search(r\'\\b\\w+\\.{2,}\\s+\\w+\', transcript))  # word... word 패턴
    ) and not looks_fragmented

    # ── looks_self_cancel ───────────────────────────────────────────────────
    looks_self_cancel = (
        "never mind" in tr_lower or
        "forget it" in tr_lower or
        bool(re.search(r\'\\b\\w+\\.\\.\\. [A-Z]\', transcript))  # 새 문장 시작으로 self-cancel
    )

    return {
        "is_empty_utterance":    is_empty_utterance,
        "has_repeat_request":    asked_for_repeat,
        "delay_sec":             response_delay_sec,
        "word_count":            wc,
        "looks_minimal_answer":  looks_minimal_answer,
        "looks_fragmented":      looks_fragmented,
        "looks_translation_like": looks_translation_like,
        "looks_vocab_hunting":   looks_vocab_hunting,
        "looks_self_cancel":     looks_self_cancel,
        "question_family":       question_family,
        "question_text":         question_text,
        "transcript":            transcript,
    }
'''

# ── 2. Rule Router ────────────────────────────────────────────────────────────
RULE_ROUTER_CODE = '''\
async def execute(inputs):
    is_empty         = bool(inputs.get("is_empty_utterance"))
    has_repeat       = bool(inputs.get("has_repeat_request"))
    delay_sec        = float(inputs.get("delay_sec") or 0)
    looks_fragmented = bool(inputs.get("looks_fragmented"))
    looks_minimal    = bool(inputs.get("looks_minimal_answer"))
    looks_trans      = bool(inputs.get("looks_translation_like"))
    looks_vocab      = bool(inputs.get("looks_vocab_hunting"))
    looks_cancel     = bool(inputs.get("looks_self_cancel"))
    question_family  = str(inputs.get("question_family") or "general")
    transcript       = str(inputs.get("transcript") or "").strip().lower()
    word_count       = int(inputs.get("word_count") or 0)

    detected_pattern = None
    matched_rules    = []
    routing_confidence = 1.0  # 규칙 기반 → 기본적으로 높게 시작

    # ── 우선순위 순 규칙 적용 ────────────────────────────────────────────────

    # 1순위: Repair Need — 즉각 수정 없이 대화 진행 불가
    # (텍스트 기반에서는 has_repeat을 강한 신호로 사용)
    if has_repeat:
        detected_pattern = "Repair Need"
        matched_rules.append("has_repeat_request=true")

    # 2순위: Start Delay — 응답 시작 자체에 어려움
    elif delay_sec > 3.0 and not looks_fragmented:
        detected_pattern = "Start Delay"
        matched_rules.append(f"delay_sec={delay_sec:.1f} > 3.0")

    # 3순위: Structure Collapse — 주어+동사 이후 구조 무너짐
    # feeling/state 질문에서 "I feel..." → Structure Collapse 우선
    elif looks_fragmented:
        detected_pattern = "Structure Collapse"
        matched_rules.append("looks_fragmented=true")
        if question_family == "feeling_state":
            matched_rules.append("feeling_state exception: fragment → Structure Collapse")
            routing_confidence = 0.95
        elif looks_trans:
            detected_pattern = "Translation Trap"
            matched_rules.append("looks_translation_like=true → Translation Trap override")
            routing_confidence = 0.80

    # 4순위: Empty Start — 의미 있는 발화 전혀 없음
    elif is_empty or word_count == 0:
        detected_pattern = "Empty Start"
        matched_rules.append("is_empty_utterance=true")
        if delay_sec > 3.0:
            # delay 있으면 Start Delay가 더 적합할 수 있음 → confidence 낮춤
            matched_rules.append(f"warning: delay_sec={delay_sec:.1f} (Start Delay candidate)")
            routing_confidence = 0.65

    # 5순위: Vocab Hunting — 단어 탐색 패턴
    elif looks_vocab:
        detected_pattern = "Vocab Hunting"
        matched_rules.append("looks_vocab_hunting=true")

    # 6순위: Over-Control / Freeze — self-cancel 흔적
    elif looks_cancel:
        detected_pattern = "Over-Control / Freeze"
        matched_rules.append("looks_self_cancel=true")
        routing_confidence = 0.70  # 경계 케이스 많음

    # 7순위: 짧은 답변 (yes/no 등)
    elif looks_minimal:
        if question_family == "yes_no":
            # yes/no 질문에 짧은 답 → 정상 응답일 수 있음
            # v1 benchmark에서는 Empty Start로 강제 (문서 지침)
            detected_pattern = "Empty Start"
            matched_rules.append("yes_no question + minimal answer → Empty Start (v1 benchmark rule)")
            routing_confidence = 0.75
        else:
            detected_pattern = "Empty Start"
            matched_rules.append("looks_minimal_answer=true")

    # Fallback: Translation Trap 별도 체크 (아직 미분류)
    elif looks_trans:
        detected_pattern = "Translation Trap"
        matched_rules.append("looks_translation_like=true (fallback)")
        routing_confidence = 0.70  # 과잉 진단 리스크

    # 아무 패턴도 없으면 → 정상 발화로 간주
    else:
        detected_pattern = None
        matched_rules.append("no_failure_detected: normal utterance")
        routing_confidence = 1.0

    return {
        "detected_failure_pattern": detected_pattern,
        "matched_rules":            matched_rules,
        "routing_confidence":       routing_confidence,
        "is_normal":                detected_pattern is None,
    }
'''

# ── 3. Priority & Exception Handler ──────────────────────────────────────────
PRIORITY_HANDLER_CODE = '''\
async def execute(inputs):
    """
    경계 케이스 예외 처리 및 최종 패턴 확정.
    Rule Router 결과 + Feature 정보를 종합해 최종 패턴을 결정.
    """
    PRIORITY_ORDER = [
        "Repair Need",
        "Start Delay",
        "Structure Collapse",
        "Empty Start",
        "Vocab Hunting",
        "Translation Trap",
        "Over-Control / Freeze",
    ]

    detected       = inputs.get("detected_failure_pattern")
    confidence     = float(inputs.get("routing_confidence") or 1.0)
    matched_rules  = list(inputs.get("matched_rules") or [])
    is_normal      = bool(inputs.get("is_normal") or False)
    question_family = str(inputs.get("question_family") or "general")
    delay_sec      = float(inputs.get("delay_sec") or 0)
    word_count     = int(inputs.get("word_count") or 0)

    resolved_pattern = detected
    exception_applied = False
    exception_notes   = []

    if not detected or is_normal:
        # 정상 발화 → 패턴 없음
        return {
            "resolved_failure_pattern": None,
            "exception_applied":        False,
            "exception_notes":          ["normal utterance — no intervention needed"],
            "final_confidence":         1.0,
        }

    # ── 예외 1: Translation Trap 과잉 진단 방지 ──────────────────────────────
    # Translation Trap은 명백한 직역 샘플에서만 허용 (confidence 임계값 적용)
    if resolved_pattern == "Translation Trap" and confidence < 0.75:
        resolved_pattern = "Structure Collapse"
        exception_applied = True
        exception_notes.append("Translation Trap → Structure Collapse (confidence < 0.75 guard)")

    # ── 예외 2: Over-Control 과잉 진단 방지 ──────────────────────────────────
    # Over-Control은 self-cancel 흔적이 있을 때만 — 신호 약하면 Empty Start로
    if resolved_pattern == "Over-Control / Freeze" and confidence < 0.75:
        resolved_pattern = "Empty Start"
        exception_applied = True
        exception_notes.append("Over-Control → Empty Start (confidence < 0.75 guard)")

    # ── 예외 3: feeling_state 질문 + 짧은 fragment → Structure Collapse 강제 ─
    if question_family == "feeling_state" and resolved_pattern == "Empty Start" and word_count > 0:
        resolved_pattern = "Structure Collapse"
        exception_applied = True
        exception_notes.append("feeling_state + short fragment → Structure Collapse (benchmark rule)")

    # ── 예외 4: Start Delay + 내용은 있는 경우 → delay 재평가 ────────────────
    if resolved_pattern == "Start Delay" and word_count >= 5:
        # 말은 충분히 했지만 늦게 시작한 경우 → 실제 delay 심각도 재평가
        if delay_sec < 5.0:
            resolved_pattern = "Empty Start"
            exception_applied = True
            exception_notes.append(f"Start Delay overridden: word_count={word_count} >= 5 and delay < 5s")

    def _idx(p):
        try:
            return PRIORITY_ORDER.index(p)
        except ValueError:
            return 99

    return {
        "resolved_failure_pattern": resolved_pattern,
        "exception_applied":        exception_applied,
        "exception_notes":          exception_notes,
        "final_confidence":         confidence,
        "priority_rank":            _idx(resolved_pattern),
    }
'''

# ── 4. Module Mapper + Candidate Selector ────────────────────────────────────
MODULE_MAPPER_CODE = '''\
async def execute(inputs):
    """
    실패 패턴 → 모듈 매핑 + 후보집 로드 + 직접 후보 선택.
    규칙 기반으로 최적 후보를 결정 (LLM 없음).
    """
    FAILURE_TO_MODULE = {
        "Start Delay":           "Start",
        "Empty Start":           "Extend",
        "Repair Need":           "Repair",
        "Structure Collapse":    "Structure Shift",
        "Translation Trap":      "Structure Shift",
        "Vocab Hunting":         "Simplify",
        "Over-Control / Freeze": "Start",
    }

    CANDIDATE_BANK = {
        "Start": [
            {"key": "start_i_think",  "type": "sentence_head",        "text": "I think..."},
            {"key": "start_maybe",    "type": "sentence_head",        "text": "Maybe..."},
            {"key": "start_for_me",   "type": "sentence_head",        "text": "For me..."},
            {"key": "start_well",     "type": "sentence_head",        "text": "Well..."},
        ],
        "Extend": [
            {"key": "extend_because", "type": "connector",            "text": "because ..."},
            {"key": "extend_and",     "type": "connector",            "text": "and ..."},
            {"key": "extend_so",      "type": "connector",            "text": "so ..."},
        ],
        "Repair": [
            {"key": "repair_again",   "type": "clarification_request","text": "Can you say that again?"},
            {"key": "repair_mean",    "type": "clarification_request","text": "Do you mean ...?"},
            {"key": "repair_simpler", "type": "clarification_request","text": "Could you say it a different way?"},
        ],
        "Structure Shift": [
            {"key": "ss_music",       "type": "structure_candidate",  "text": "Music makes me feel better."},
            {"key": "ss_decision",    "type": "structure_candidate",  "text": "I made a decision."},
            {"key": "ss_relaxed",     "type": "structure_candidate",  "text": "I feel relaxed when I listen to music."},
            {"key": "ss_happy",       "type": "structure_candidate",  "text": "It makes me happy."},
        ],
        "Simplify": [
            {"key": "simp_easy_word", "type": "simplify_prompt",      "text": "Try a simpler word."},
            {"key": "simp_basic_verb","type": "simplify_prompt",      "text": "Try have / get / make."},
            {"key": "simp_short",     "type": "simplify_prompt",      "text": "Use a short sentence."},
        ],
    }

    # 문맥 기반 후보 선택 규칙
    CONTEXT_RULES = {
        # question_family → Structure Shift 우선 후보 키
        "feeling_state": "ss_relaxed",
        "preference":    "ss_happy",
        "general":       "ss_decision",
    }

    resolved_pattern  = inputs.get("resolved_failure_pattern")
    question_family   = str(inputs.get("question_family") or "general")
    question_text     = str(inputs.get("question_text") or "").lower()
    is_normal         = inputs.get("resolved_failure_pattern") is None

    # 정상 발화이거나 패턴 없으면 → 개입 없음
    if is_normal or not resolved_pattern:
        return {
            "selected_module":    None,
            "candidate_bank":     [],
            "selected_candidate": None,
            "intervention_emitted": None,
            "intervention_type":  None,
            "candidate_key":      None,
            "routing_source":     "no_intervention",
        }

    selected_module = FAILURE_TO_MODULE.get(resolved_pattern, "Start")
    candidate_bank  = CANDIDATE_BANK.get(selected_module, [])

    # ── 문맥 기반 최적 후보 선택 ────────────────────────────────────────────
    selected_candidate = candidate_bank[0] if candidate_bank else None

    if selected_module == "Structure Shift":
        # question_family 기반 우선 후보
        preferred_key = CONTEXT_RULES.get(question_family)
        if preferred_key:
            match = next((c for c in candidate_bank if c["key"] == preferred_key), None)
            if match:
                selected_candidate = match

        # 질문 텍스트에 music 관련 단어 → music 후보 우선
        if any(w in question_text for w in ["music", "song", "listen", "hear"]):
            match = next((c for c in candidate_bank if c["key"] == "ss_music"), None)
            if match:
                selected_candidate = match

    elif selected_module == "Start":
        # delay가 매우 큰 경우 → "Well..." (더 자연스러운 시작)
        delay_sec = float(inputs.get("delay_sec") or 0)
        if delay_sec > 5.0:
            match = next((c for c in candidate_bank if c["key"] == "start_well"), None)
            if match:
                selected_candidate = match

    return {
        "selected_module":      selected_module,
        "candidate_bank":       candidate_bank,
        "selected_candidate":   selected_candidate,
        "intervention_emitted": selected_candidate["text"] if selected_candidate else None,
        "intervention_type":    selected_candidate["type"] if selected_candidate else None,
        "candidate_key":        selected_candidate["key"] if selected_candidate else None,
        "routing_source":       "rule_based_v1",
    }
'''

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

        # ── Feature Extractor (Code) ─────────────────────────────────────────
        {
            "id": "feature_extractor",
            "type": "code",
            "position": {"x": 380, "y": 260},
            "data": {
                "label": "Feature Extractor",
                "code": FEATURE_EXTRACTOR_CODE,
                "timeout_ms": 3000,
                "input_variables": {
                    "transcript":          "{{start.transcript}}",
                    "history":             "{{start.history}}",
                    "response_delay_sec":  "{{start.response_delay_sec}}",
                    "asked_for_repeat":    "{{start.variant}}",  # variant에서 파싱
                },
                "declared_outputs": [
                    {"key": "is_empty_utterance",    "label": "빈 발화 여부",      "path": "is_empty_utterance"},
                    {"key": "has_repeat_request",    "label": "반복 요청 여부",    "path": "has_repeat_request"},
                    {"key": "delay_sec",             "label": "응답 지연(초)",     "path": "delay_sec"},
                    {"key": "word_count",            "label": "단어 수",           "path": "word_count"},
                    {"key": "looks_minimal_answer",  "label": "최소 답변 패턴",    "path": "looks_minimal_answer"},
                    {"key": "looks_fragmented",      "label": "구조 단편화",       "path": "looks_fragmented"},
                    {"key": "looks_translation_like","label": "직역 패턴",         "path": "looks_translation_like"},
                    {"key": "looks_vocab_hunting",   "label": "단어 탐색 패턴",    "path": "looks_vocab_hunting"},
                    {"key": "looks_self_cancel",     "label": "자기검열 패턴",     "path": "looks_self_cancel"},
                    {"key": "question_family",       "label": "질문 유형",         "path": "question_family"},
                    {"key": "question_text",         "label": "질문 텍스트",       "path": "question_text"},
                    {"key": "transcript",            "label": "정규화 발화",       "path": "transcript"},
                ],
            },
        },

        # ── Rule Router (Code) ───────────────────────────────────────────────
        {
            "id": "rule_router",
            "type": "code",
            "position": {"x": 760, "y": 260},
            "data": {
                "label": "Rule Router",
                "code": RULE_ROUTER_CODE,
                "timeout_ms": 3000,
                "input_variables": {
                    "is_empty_utterance":    "{{feature_extractor.is_empty_utterance}}",
                    "has_repeat_request":    "{{feature_extractor.has_repeat_request}}",
                    "delay_sec":             "{{feature_extractor.delay_sec}}",
                    "word_count":            "{{feature_extractor.word_count}}",
                    "looks_fragmented":      "{{feature_extractor.looks_fragmented}}",
                    "looks_minimal_answer":  "{{feature_extractor.looks_minimal_answer}}",
                    "looks_translation_like":"{{feature_extractor.looks_translation_like}}",
                    "looks_vocab_hunting":   "{{feature_extractor.looks_vocab_hunting}}",
                    "looks_self_cancel":     "{{feature_extractor.looks_self_cancel}}",
                    "question_family":       "{{feature_extractor.question_family}}",
                    "transcript":            "{{feature_extractor.transcript}}",
                },
                "declared_outputs": [
                    {"key": "detected_failure_pattern", "label": "감지된 실패 패턴",  "path": "detected_failure_pattern"},
                    {"key": "matched_rules",            "label": "매칭된 규칙 목록",  "path": "matched_rules"},
                    {"key": "routing_confidence",       "label": "라우팅 신뢰도",     "path": "routing_confidence"},
                    {"key": "is_normal",                "label": "정상 발화 여부",    "path": "is_normal"},
                ],
            },
        },

        # ── Priority & Exception Handler (Code) ──────────────────────────────
        {
            "id": "priority_handler",
            "type": "code",
            "position": {"x": 1140, "y": 260},
            "data": {
                "label": "Priority & Exception Handler",
                "code": PRIORITY_HANDLER_CODE,
                "timeout_ms": 3000,
                "input_variables": {
                    "detected_failure_pattern": "{{rule_router.detected_failure_pattern}}",
                    "routing_confidence":        "{{rule_router.routing_confidence}}",
                    "matched_rules":             "{{rule_router.matched_rules}}",
                    "is_normal":                 "{{rule_router.is_normal}}",
                    "question_family":           "{{feature_extractor.question_family}}",
                    "delay_sec":                 "{{feature_extractor.delay_sec}}",
                    "word_count":                "{{feature_extractor.word_count}}",
                },
                "declared_outputs": [
                    {"key": "resolved_failure_pattern", "label": "최종 실패 패턴",   "path": "resolved_failure_pattern"},
                    {"key": "exception_applied",        "label": "예외 적용 여부",   "path": "exception_applied"},
                    {"key": "exception_notes",          "label": "예외 처리 내역",   "path": "exception_notes"},
                    {"key": "final_confidence",         "label": "최종 신뢰도",      "path": "final_confidence"},
                    {"key": "priority_rank",            "label": "우선순위 순위",    "path": "priority_rank"},
                ],
            },
        },

        # ── Module Mapper + Candidate Selector (Code) ────────────────────────
        {
            "id": "module_mapper",
            "type": "code",
            "position": {"x": 1520, "y": 260},
            "data": {
                "label": "Module Mapper + Candidate Selector",
                "code": MODULE_MAPPER_CODE,
                "timeout_ms": 3000,
                "input_variables": {
                    "resolved_failure_pattern": "{{priority_handler.resolved_failure_pattern}}",
                    "question_family":           "{{feature_extractor.question_family}}",
                    "question_text":             "{{feature_extractor.question_text}}",
                    "delay_sec":                 "{{feature_extractor.delay_sec}}",
                },
                "declared_outputs": [
                    {"key": "selected_module",      "label": "선택 모듈",       "path": "selected_module"},
                    {"key": "candidate_bank",       "label": "후보집",          "path": "candidate_bank"},
                    {"key": "selected_candidate",   "label": "선택된 후보",     "path": "selected_candidate"},
                    {"key": "intervention_emitted", "label": "개입 문구",       "path": "intervention_emitted"},
                    {"key": "intervention_type",    "label": "개입 타입",       "path": "intervention_type"},
                    {"key": "candidate_key",        "label": "후보 키",         "path": "candidate_key"},
                    {"key": "routing_source",       "label": "라우팅 소스",     "path": "routing_source"},
                ],
            },
        },

        # ── Conductor (LLM) ──────────────────────────────────────────────────
        {
            "id": "conductor",
            "type": "llm",
            "position": {"x": 1900, "y": 260},
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
                    "transcript":          "{{start.transcript}}",
                    "history":             "{{start.history}}",
                    "topic":               "{{start.topic}}",
                    "scene_context":       "{{start.scene_context}}",
                    "participants":        "{{start.participants}}",
                    # Rule 기반 결과
                    "failure_pattern":     "{{priority_handler.resolved_failure_pattern}}",
                    "selected_module":     "{{module_mapper.selected_module}}",
                    "intervention_text":   "{{module_mapper.intervention_emitted}}",
                    "intervention_type":   "{{module_mapper.intervention_type}}",
                    "matched_rules":       "{{rule_router.matched_rules}}",
                    "exception_notes":     "{{priority_handler.exception_notes}}",
                    "routing_source":      "{{module_mapper.routing_source}}",
                },
                "output_schema": CONDUCTOR_SCHEMA,
                "declared_outputs": [
                    {"key": "result.feedback_text",        "label": "피드백 텍스트",  "path": "result.feedback_text"},
                    {"key": "result.feedback_instruction", "label": "피드백 지시",    "path": "result.feedback_instruction"},
                    {"key": "result.level",                "label": "학습 레벨",      "path": "result.level"},
                    {"key": "result.level_instruction",    "label": "레벨 지침",      "path": "result.level_instruction"},
                    {"key": "result.corrections",          "label": "교정 목록",      "path": "result.corrections"},
                    {"key": "result.better_expressions",   "label": "더 나은 표현",   "path": "result.better_expressions"},
                    {"key": "result.speaker_scripts",      "label": "스크립트 힌트",  "path": "result.speaker_scripts"},
                    {"key": "result.user_emotion",         "label": "사용자 감정",    "path": "result.user_emotion"},
                    {"key": "result.engine_trace",         "label": "엔진 추적",      "path": "result.engine_trace"},
                ],
            },
        },

        # ── 출력 ────────────────────────────────────────────────────────────────
        {
            "id": "end_1",
            "type": "end",
            "position": {"x": 2300, "y": 260},
            "data": {
                "label": "파이프라인 출력",
                "output_mapping": {
                    # my_turn_service가 읽는 핵심 필드
                    "feedback_text":            "{{conductor.result.feedback_text}}",
                    "feedback_instruction":     "{{conductor.result.feedback_instruction}}",
                    "level":                    "{{conductor.result.level}}",
                    "level_instruction":        "{{conductor.result.level_instruction}}",
                    "corrections":              "{{conductor.result.corrections}}",
                    "better_expressions":       "{{conductor.result.better_expressions}}",
                    "speaker_scripts":          "{{conductor.result.speaker_scripts}}",
                    "user_emotion":             "{{conductor.result.user_emotion}}",
                    "engine_trace":             "{{conductor.result.engine_trace}}",
                    # A2 전용 추적 필드 (로그용)
                    "detected_failure_pattern": "{{priority_handler.resolved_failure_pattern}}",
                    "selected_module":          "{{module_mapper.selected_module}}",
                    "intervention_emitted":     "{{module_mapper.intervention_emitted}}",
                    "intervention_type":        "{{module_mapper.intervention_type}}",
                    "candidate_key":            "{{module_mapper.candidate_key}}",
                    "matched_rules":            "{{rule_router.matched_rules}}",
                    "exception_applied":        "{{priority_handler.exception_applied}}",
                    "exception_notes":          "{{priority_handler.exception_notes}}",
                    "routing_source":           "{{module_mapper.routing_source}}",
                },
            },
        },
    ]

    edges = [
        {"id": "e1", "source": "start_1",           "target": "feature_extractor", "type": "animated", "animated": True},
        {"id": "e2", "source": "feature_extractor",  "target": "rule_router",        "type": "animated", "animated": True},
        {"id": "e3", "source": "rule_router",         "target": "priority_handler",   "type": "animated", "animated": True},
        {"id": "e4", "source": "priority_handler",    "target": "module_mapper",      "type": "animated", "animated": True},
        {"id": "e5", "source": "module_mapper",       "target": "conductor",          "type": "animated", "animated": True},
        {"id": "e6", "source": "conductor",           "target": "end_1",              "type": "animated", "animated": True},
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "viewport": {"x": 0, "y": 0, "zoom": 0.45},
    }


# ─── API 헬퍼 ─────────────────────────────────────────────────────────────────

def api_call(base_url, method, path, body=None, token=None):
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
        print(f"  HTTP {exc.code}: {exc.read().decode()[:400]}", file=sys.stderr)
        raise


def login(base_url, username, password):
    resp = api_call(base_url, "POST", "/api/v1/auth/login", {"username": username, "password": password})
    return resp["token"]


def list_templates(base_url, token):
    resp = api_call(base_url, "GET", "/api/v1/conversations/templates?limit=50", token=token)
    return resp.get("items") or []


# ─── 메인 ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="TD-v1 A2 Rule-assisted 파이프라인 생성")
    parser.add_argument("--base-url",       default=DEFAULT_BASE_URL)
    parser.add_argument("--username",       default=DEFAULT_USERNAME)
    parser.add_argument("--password",       default=DEFAULT_PASSWORD)
    parser.add_argument("--template-id",    default=None, help="연결할 템플릿 UUID")
    parser.add_argument("--list-templates", action="store_true", help="템플릿 목록 출력 후 종료")
    parser.add_argument("--dump-json",      action="store_true", help="graph_json만 출력하고 종료")
    args = parser.parse_args()

    graph = build_graph()

    if args.dump_json:
        print(json.dumps(graph, ensure_ascii=False, indent=2))
        return

    print(f"[1/4] 로그인 중... ({args.base_url})")
    token = login(args.base_url, args.username, args.password)
    print("      OK")

    if args.list_templates:
        templates = list_templates(args.base_url, token)
        print("\n사용 가능한 템플릿:")
        for t in templates:
            print(f"  {t['id']}  [{t.get('pipeline_mode','basic')}]  {t['name']}")
        print("\n--template-id <UUID> 로 연결할 템플릿을 지정하세요.")
        return

    print("[2/4] 파이프라인 생성 중...")
    pipeline = api_call(
        args.base_url, "POST", "/api/v1/visual-pipelines",
        {"name": PIPELINE_NAME, "description": PIPELINE_DESCRIPTION,
         "graph_json": graph, "timeout_ms": TIMEOUT_MS},
        token=token,
    )
    pipeline_id = pipeline["id"]
    print(f"      생성 완료 — id: {pipeline_id}")
    print(f"      노드: {len(graph['nodes'])}개  엣지: {len(graph['edges'])}개")

    print("[3/4] 유효성 검사 중...")
    validate = api_call(
        args.base_url, "POST",
        f"/api/v1/visual-pipelines/{pipeline_id}/validate",
        {"graph_json": graph}, token=token,
    )
    if validate.get("valid"):
        print("      유효성 검사 통과")
    else:
        print(f"      경고 — 오류: {validate.get('errors')}")

    if args.template_id:
        print(f"[4/4] 템플릿 연결 중... (template_id={args.template_id})")
        link = api_call(
            args.base_url, "PUT",
            f"/api/v1/visual-pipelines/templates/{args.template_id}/link",
            {"pipeline_id": pipeline_id, "pipeline_version": None},
            token=token,
        )
        print(f"      연결 완료 — pipeline_mode → 'visual'")
        print(f"      파이프라인명: {link.get('pipeline_name')}")
    else:
        print("[4/4] 템플릿 연결 건너뜀 (--template-id 미지정)")

    print()
    print("=" * 65)
    print("파이프라인 A2 생성 완료!")
    print(f"  이름  : {PIPELINE_NAME}")
    print(f"  ID    : {pipeline_id}")
    print(f"  구성  : Feature Extractor → Rule Router → Priority Handler")
    print(f"          → Module Mapper → Conductor (LLM 1회)")
    print(f"  특징  : LLM 1회 호출, 규칙 기반 패턴 감지, 후보집 직접 선택")
    print()
    if not args.template_id:
        print("다음 단계:")
        print("  1. --template-id <UUID> 로 재실행해 템플릿 연결")
        print("     (A1과 다른 템플릿 또는 같은 템플릿 교체 연결)")
        print("  2. My Turn 세션에서 테스트 후 파이프라인 실행 로그 확인")
    print("=" * 65)


if __name__ == "__main__":
    main()
