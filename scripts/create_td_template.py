#!/usr/bin/env python3
"""
TD-v1 파이프라인용 1:1 영어 대화 템플릿 생성 스크립트

사용법:
    cd apps/server

    # 템플릿만 생성
    poetry run python ../../scripts/create_td_template.py

    # 템플릿 생성 + 파이프라인 자동 연결
    poetry run python ../../scripts/create_td_template.py --pipeline-id <UUID>

    # 파이프라인 목록 확인
    poetry run python ../../scripts/create_td_template.py --list-pipelines
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"

# ─── 템플릿 정의 ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are Alex, a friendly English conversation partner.

## Conversation style
- Keep every response to 1–2 sentences maximum
- Always end your turn with exactly one question
- Use simple everyday vocabulary (A2–B1 level)
- Warm, encouraging tone — never critical or judgmental
- React briefly to what the learner just said, then ask the next question

## When [CONDUCTOR FEEDBACK] appears in your context
- Deliver it naturally as your own words — don't announce it
- Keep it short and follow up with a question
- Example: if feedback is "Try saying 'I feel relaxed'", you say: "You can try 'I feel relaxed' — does that sound right? How does music make you feel?"

## Topics to cover (cycle through these)
Feelings & mood · Music & hobbies · Food & cooking · Weekend plans ·
Daily routines · Work or school · Travel experiences · Favorite things\
"""

SCENE_CONTEXT = """\
A one-on-one English speaking practice session between Alex and the learner.
Alex is a friendly native English speaker in his late 20s who genuinely enjoys talking with people from different countries.
He asks simple questions about everyday life, listens attentively, and responds warmly.
Every response from Alex is very short (1–2 sentences) and always ends with a question.
The atmosphere is relaxed, low-pressure, and supportive — perfect for learners who feel nervous speaking English.\
"""

GREETING_MESSAGE = (
    "Hi! I'm Alex — it's really nice to meet you! "
    "We're just going to have a casual chat in English today. "
    "No pressure at all — just say what comes to mind. "
    "So, how are you feeling right now?"
)

TEMPLATE_DATA: dict = {
    "name": "TD-v1 · 1:1 일상 영어 대화 (Alex)",
    "description": (
        "TD-v1 실패 패턴 감지 파이프라인 연동용 1:1 영어 회화 템플릿.\n"
        "AI 대화 상대 Alex가 학습자와 일상 주제로 대화하며, "
        "발화 어려움이 감지되면 파이프라인이 최소 개입으로 돕습니다.\n"
        "구성: Alex(AI, 먼저 말함) ↔ 학습자(User)"
    ),
    "mode": "turn_based",
    "topic": "Everyday English conversation — feelings, preferences, daily life",
    "difficulty": 2,
    "estimated_minutes": 10,
    "scene_context": SCENE_CONTEXT,
    "system_prompt": SYSTEM_PROMPT,
    "greeting_message": None,          # 템플릿 레벨 인사말 없음 (참여자 레벨에서 처리)
    "first_speaker": "ai_first",
    "pipeline_mode": "basic",          # 파이프라인 연결 시 자동으로 'visual'로 변경됨
    "feedback_card_type": "detailed",
    "allow_user_topic": False,
    "is_active": True,
    "participants": [
        # ── AI 참여자 (Alex) — order_index=0 → 항상 먼저 발화 ──────────────────
        {
            "participant_type": "ai",
            "name": "Alex",
            "order_index": 0,
            "persona": (
                "Friendly, patient English conversation partner in his late 20s. "
                "Speaks clearly at a moderate pace. "
                "Genuinely curious about people and interested in the learner's answers. "
                "Never corrects grammar directly — models good English through natural conversation. "
                "Celebrates small wins with brief, warm reactions."
            ),
            "greeting_message": GREETING_MESSAGE,
            "voice_id": "en-US-Journey-D",   # Journey HD — natural, conversational
            "tts_provider": "google",
            "llm_model": "gemini-2.5-flash",
            "difficulty": 2,
        },
        # ── 사용자 참여자 — order_index=1 ──────────────────────────────────────
        {
            "participant_type": "user",
            "name": "학습자",
            "order_index": 1,
            "persona": "English learner practicing spoken English",
        },
    ],
}

# ─── API 헬퍼 ─────────────────────────────────────────────────────────────────

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
        print(f"  HTTP {exc.code}: {exc.read().decode()[:400]}", file=sys.stderr)
        raise


def login(base_url: str, username: str, password: str) -> str:
    resp = api_call(base_url, "POST", "/api/v1/auth/login",
                    {"username": username, "password": password})
    return resp["token"]


def list_pipelines(base_url: str, token: str) -> list[dict]:
    resp = api_call(base_url, "GET", "/api/v1/visual-pipelines?size=50", token=token)
    return resp if isinstance(resp, list) else resp.get("items", [])


# ─── 메인 ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="TD-v1 1:1 대화 템플릿 생성")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--username", default=DEFAULT_USERNAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--pipeline-id", default=None,
                        help="연결할 비주얼 파이프라인 UUID")
    parser.add_argument("--list-pipelines", action="store_true",
                        help="사용 가능한 파이프라인 목록 출력 후 종료")
    parser.add_argument("--dump-json", action="store_true",
                        help="템플릿 JSON만 출력하고 종료")
    args = parser.parse_args()

    if args.dump_json:
        print(json.dumps(TEMPLATE_DATA, ensure_ascii=False, indent=2))
        return

    print(f"[1/3] 로그인 중... ({args.base_url})")
    token = login(args.base_url, args.username, args.password)
    print("      OK")

    if args.list_pipelines:
        pipelines = list_pipelines(args.base_url, token)
        print("\n사용 가능한 비주얼 파이프라인:")
        for p in pipelines:
            print(f"  {p['id']}  [{p.get('status','?')}]  {p['name']}")
        print("\n--pipeline-id <UUID> 로 연결할 파이프라인을 지정하세요.")
        return

    print("[2/3] 템플릿 생성 중...")
    template = api_call(
        args.base_url, "POST",
        "/api/v1/conversations/templates",
        TEMPLATE_DATA,
        token=token,
    )
    template_id = template["id"]
    print(f"      생성 완료 — id: {template_id}")
    print(f"      참여자: {[p['name'] for p in template.get('participants', [])]}")

    # 파이프라인 연결
    if args.pipeline_id:
        print(f"[3/3] 파이프라인 연결 중... (pipeline_id={args.pipeline_id})")
        link = api_call(
            args.base_url, "PUT",
            f"/api/v1/visual-pipelines/templates/{template_id}/link",
            {"pipeline_id": args.pipeline_id, "pipeline_version": None},
            token=token,
        )
        print(f"      연결 완료 — pipeline_mode: basic → visual")
        print(f"      연결된 파이프라인: {link.get('pipeline_name')}")
    else:
        print("[3/3] 파이프라인 연결 건너뜀 (--pipeline-id 미지정)")
        print("      나중에 어드민 > AI Lab > 템플릿 연결 에서 연결하세요.")

    print()
    print("=" * 65)
    print("템플릿 생성 완료!")
    print(f"  이름        : {TEMPLATE_DATA['name']}")
    print(f"  ID          : {template_id}")
    print(f"  참여자      : Alex(AI, 먼저 발화) ↔ 학습자(User)")
    print(f"  음성        : en-US-Journey-D (Google Journey HD)")
    print(f"  TTS provider: google")
    print()
    if args.pipeline_id:
        print("다음 단계:")
        print("  1. 어드민 > 대화 관리 > My Turn 에서 방금 생성한 템플릿으로 세션 시작")
        print("  2. Alex가 인사말로 대화 시작 → 발화 → 파이프라인 실행")
        print("  3. AI Lab > 파이프라인 실행 로그 에서 trace_id로 로그 확인")
    else:
        print("다음 단계:")
        print(f"  1. 파이프라인 연결: --pipeline-id <UUID> 로 재실행")
        print(f"     또는 어드민 > AI Lab > 템플릿 연결 에서 수동 연결")
        print("  2. My Turn 세션에서 테스트")
    print("=" * 65)


if __name__ == "__main__":
    main()
