"""Reporting LLM Service — Layer 3 학습 행동 분석.

세션의 전체 대화 컨텍스트를 Gemini에 전달하여
학습 행동, 참여도, 대화 품질 등을 분석합니다.

Admin 세션 상세 페이지에서 수동 트리거로만 실행됩니다.
"""

import json
import logging
import time
from collections import defaultdict
from typing import Optional
from uuid import UUID

import google.generativeai as genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.conversation import ConversationSession, ConversationTurn, TurnType
from app.models.pipeline_log import PipelineLog
from app.models.session_observation import SessionObservation
from app.services.conversation.observation_service import ObservationService

logger = logging.getLogger(__name__)

# Reporting LLM 기본 모델 (기획서 §4.3 지정)
DEFAULT_REPORTING_MODEL = "gemini-3.1-pro-preview"


# ============================================================================
# DEFAULT SYSTEM PROMPT (코드 내장 기본값)
# DB에 활성 프롬프트가 없을 경우 이 값을 사용합니다.
# Admin에서 프롬프트를 편집하면 DB에 저장되며, 이 기본값을 대체합니다.
# Admin에서 "기본값으로 리셋" 시 이 값을 제공하는 API가 있습니다.
# ============================================================================

DEFAULT_SYSTEM_PROMPT = """## Role
You are a learning behavior analyst for an English conversation practice app.
Analyze the student's learning behavior patterns with focus on conversation quality,
coping strategies, elaboration adequacy, and communication flow.

## Input Data

You will receive a JSON object containing:
1. session_metadata: Template name, duration, user name, completion status
2. layer1_metrics: Rule-based auto-calculated metrics (turn counts, utterance lengths, response intervals, etc.)
3. layer2_metrics: Pipeline LLM aggregated data (scores, levels, issues, corrections)
4. transcript: Full conversation [{turn_index, turn_type, speaker_name, content_text}]
5. pipeline_details: Per-turn evaluator/planner/conductor outputs

## Analysis Instructions

### learning_behavior_summary
Write a 2-3 sentence Korean summary of the student's overall learning behavior.
Reference session_duration_sec, completion_status, avg_overall_score, and level_progression.

### engagement_level
Determine "high", "medium", or "low" based on:
- total_user_turns, avg_user_utterance_length, avg_user_response_interval_sec
- completion_status (timeout/user_exit = lower)
- long_gap_count, first_user_response_time_sec

### elaboration_adequacy
For each user turn, analyze the preceding AI question:
1. Classify question type → assign Question Weight (1-5)
   - Confirmation (Do you...? / Is it...?): Weight 1-2
   - Description (Describe... / What...?): Weight 3
   - Experience (Why... / Tell me about...?): Weight 4-5
2. Analyze Answer Richness: sentence structure, connectors, specific details
3. Calculate Elaboration Score: (richness / weight) × 100
4. Classify: under_elaborated / well_balanced / over_elaborated
5. Calculate trend: first half vs last half average scores
   - improving: +20%
   - stable: ±20%
   - declining: -20%

### explicit_clarification_analysis
Detect clarification requests: "what?", "sorry?", "come again?", "pardon?", "huh?", "could you repeat", "what do you mean", "I don't understand", "excuse me?" and similar expressions.
Consider STT transcription errors (e.g., "come again" → "come a game").

### response_start_quality
Analyze first 1-2 words of each user turn. Check for appropriate connectors,
response words, and natural connection to previous utterance.

### flow_maintenance
Analyze whether user maintains semantic connection to previous context.

### coping_attempt
Detect coping strategies when user faces difficulty: paraphrase, circumlocution, asking for clarification.

### clarification_success
When clarification occurs: analyze the sequence (request → AI re-explanation → student retry).
Determine if student understood after clarification.

### avoidance_vs_response
Combine short_reply situations with coping_attempt data.
Classify overall pattern as "avoidant", "responsive", or "mixed".

### improvement_suggestions
Write in Korean. Include specific metrics:
- "평균 문장 길이가 N단어입니다. 목표: N+3단어"
- "평균 응답 시간이 N초입니다. 즉각 반응 훈련이 필요합니다."
- "첫 응답까지 N초 소요 — 시작 시 긴장감이 있었습니다"
- Reference primary_issues and fluency_wpm_trend

## Output JSON Schema

Return ONLY a valid JSON object with these exact fields:
{
  "learning_behavior_summary": "한국어 2-3문장",
  "engagement_level": "high|medium|low",
  "key_learning_points": ["..."],
  "struggle_points": ["..."],
  "communication_style": "reactive|proactive|balanced",
  "topic_maintenance_score": 0-100,
  "question_back_count": 0,
  "natural_conversation_score": 0-100,
  "improvement_suggestions": ["한국어 ..."],
  "elaboration_adequacy": {
    "overall_score": 0-100,
    "trend": "improving|stable|declining|insufficient_data",
    "avg_utterance_length_feedback": "평균 N단어 ...",
    "evaluated_turns": [
      {
        "turn_index": 0,
        "question_weight": 1-5,
        "question_type": "confirmation|description|experience",
        "word_count": 0,
        "elaboration_score": 0-100,
        "judgment": "under_elaborated|well_balanced|over_elaborated",
        "feedback": "..."
      }
    ]
  },
  "explicit_clarification_analysis": {
    "count": 0,
    "details": [
      {"turn_index": 0, "expression": "sorry?", "stt_original": "...", "type": "repeat_request|meaning_request"}
    ]
  },
  "response_start_quality": "good|fair|poor",
  "response_start_quality_detail": [
    {"turn_index": 0, "start_words": "...", "quality": "good|fair|poor", "reason": "..."}
  ],
  "flow_maintenance": "strong|moderate|weak",
  "flow_maintenance_detail": [
    {"turn_pair": [0, 1], "connected": true, "evidence": "..."}
  ],
  "coping_attempt": {
    "count": 0,
    "examples": [{"turn_index": 0, "strategy": "paraphrase|describe|ask", "text": "..."}]
  },
  "clarification_success": {
    "no_clarification": true,
    "total": 0,
    "successful": 0,
    "failed": 0,
    "details": [{"trigger_turn": 0, "ai_response_turn": 0, "student_retry_turn": 0, "resolved": true}]
  },
  "avoidance_vs_response": {
    "avoidance_count": 0,
    "response_count": 0,
    "ratio": 0.0,
    "pattern": "avoidant|responsive|mixed"
  }
}"""


class ReportingLLMService:
    """Layer 3 학습 행동 분석 서비스.

    Admin 세션 상세 페이지에서 수동 트리거로만 실행.
    기존 Gemini API 호출 패턴(google.generativeai)을 따릅니다.

    Attributes:
        db: 비동기 데이터베이스 세션.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def analyze_session(self, session_id: UUID) -> dict:
        """세션의 학습 행동을 분석하고 Layer 3 데이터를 생성.

        Args:
            session_id: 분석할 세션 ID.

        Returns:
            Layer 3 필드의 dict.

        Raises:
            ValueError: 세션 또는 Observation이 없는 경우.
        """
        # 1. 데이터 수집
        session = await self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        turns = await self._get_turns(session_id)
        pipeline_logs = await self._get_pipeline_logs(session_id)
        observation = await self._get_observation(session_id)

        if not observation:
            raise ValueError(
                f"Observation for session {session_id} not found. "
                "Run Layer 1+2 generation first."
            )

        # 2. 프롬프트 + 모델 설정 조회 (DB → DEFAULT fallback)
        prompt_config = await self._get_prompt_config()
        model_name = prompt_config["llm_model"]

        # 3. 입력 데이터 구성
        input_data = self._build_input_data(session, turns, pipeline_logs, observation)

        # 4. LLM 호출
        start_time = time.time()
        result = await self._call_llm(input_data, prompt_config)
        duration_ms = (time.time() - start_time) * 1000

        # 5. 메타 정보 추가
        result["reporting_llm_model"] = model_name
        result["reporting_llm_duration_ms"] = round(duration_ms, 1)

        # 6. Layer 3 저장
        obs_service = ObservationService(self.db)
        await obs_service.update_layer3(session_id, result)

        logger.info(
            f"[ReportingLLM] Analysis completed for session {session_id} "
            f"in {duration_ms:.0f}ms using {model_name}"
        )
        return result

    # ──────────────────────────────────────────────
    # 입력 데이터 구성
    # ──────────────────────────────────────────────

    def _build_input_data(
        self,
        session: ConversationSession,
        turns: list[ConversationTurn],
        pipeline_logs: list[PipelineLog],
        observation: SessionObservation,
    ) -> dict:
        """Reporting LLM에 전달할 입력 데이터를 구성.

        Args:
            session: ConversationSession 인스턴스.
            turns: 세션의 모든 ConversationTurn 목록 (turn_index ASC).
            pipeline_logs: 세션의 PipelineLog 목록 (turn_index ASC).
            observation: Layer 1+2가 채워진 SessionObservation.

        Returns:
            LLM에 전달할 JSON 가능한 dict.
        """
        # 템플릿 이름 추출 (개인정보 최소화)
        template_name = ""
        if session.variant:
            try:
                variant_data = (
                    json.loads(session.variant)
                    if isinstance(session.variant, str)
                    else session.variant
                )
                template_name = variant_data.get("template_name", "")
            except (json.JSONDecodeError, AttributeError):
                pass
        if not template_name and hasattr(session, "template") and session.template:
            template_name = session.template.name

        session_metadata = {
            "template_name": template_name or "Unknown",
            "session_duration_sec": observation.session_duration_sec,
            "user_name": session.user_name or "Student",
            "completion_status": observation.completion_status,
        }

        layer1_metrics = {
            "total_user_turns": observation.total_user_turns or 0,
            "total_ai_turns": observation.total_ai_turns or 0,
            "avg_user_utterance_length": observation.avg_user_utterance_length,
            "utterance_length_trend": observation.utterance_length_trend,
            "avg_user_response_interval_sec": observation.avg_user_response_interval_sec,
            "short_reply_count": observation.short_reply_count or 0,
            "first_user_response_time_sec": observation.first_user_response_time_sec,
            "word_count_per_turn": observation.word_count_per_turn,
            "long_gap_count": observation.long_gap_count or 0,
            "followup_after_short_answer": observation.followup_after_short_answer or 0,
        }

        layer2_metrics = {
            "avg_overall_score": observation.avg_overall_score,
            "score_trend": observation.score_trend,
            "level_progression": observation.level_progression,
            "max_level_reached": observation.max_level_reached,
            "level_up_count": observation.level_up_count or 0,
            "level_down_count": observation.level_down_count or 0,
            "primary_issues": observation.primary_issues,
            "correction_count": observation.correction_count or 0,
            "fluency_wpm_trend": observation.fluency_wpm_trend,
        }

        transcript = [
            {
                "turn_index": t.turn_index,
                "turn_type": (
                    t.turn_type.value if hasattr(t.turn_type, "value") else str(t.turn_type)
                ),
                "speaker_name": t.speaker_name or "",
                "content_text": t.content_text or "",
            }
            for t in turns
        ]

        pipeline_details = self._build_pipeline_details(pipeline_logs)

        return {
            "session_metadata": session_metadata,
            "layer1_metrics": layer1_metrics,
            "layer2_metrics": layer2_metrics,
            "transcript": transcript,
            "pipeline_details": pipeline_details,
        }

    def _build_pipeline_details(self, pipeline_logs: list[PipelineLog]) -> list[dict]:
        """Pipeline 로그를 턴별로 그룹핑하여 상세 정보 구성.

        Args:
            pipeline_logs: PipelineLog 목록 (turn_index ASC).

        Returns:
            턴별 evaluator/planner/conductor 출력 목록.
        """
        by_turn: dict[int, dict] = defaultdict(lambda: {"turn_index": 0})

        for log in pipeline_logs:
            if not log.output_json:
                continue

            turn_data = by_turn[log.turn_index]
            turn_data["turn_index"] = log.turn_index

            if log.module_name == "evaluator":
                out = log.output_json
                turn_data["evaluator"] = {
                    "overall_score": self._safe_get(out, "aggregate", "overall_score"),
                    "diagnosis": {
                        "primary_issue": self._safe_get(out, "diagnosis", "primary_issue"),
                        "secondary_issues": self._safe_get(out, "diagnosis", "secondary_issues") or [],
                        "recommended_action": self._safe_get(out, "diagnosis", "recommended_action"),
                    },
                    "fluency": {
                        "pause_count": self._safe_get(out, "fluency", "pause_count") or 0,
                        "words_per_minute": self._safe_get(out, "fluency", "words_per_minute") or 0,
                    },
                }

            elif log.module_name == "planner":
                out = log.output_json
                turn_data["planner"] = {
                    "decision": {
                        "path": self._safe_get(out, "decision", "path"),
                        "reason": self._safe_get(out, "decision", "reason") or [],
                    },
                    "persona_plan": {
                        "current_level": self._safe_get(out, "persona_plan", "current_level"),
                        "tone": self._safe_get(out, "persona_plan", "tone"),
                    },
                }

            elif log.module_name == "conductor":
                out = log.output_json
                turn_data["conductor"] = {
                    "intervention_emitted": (
                        out.get("intervention_emitted", out.get("feedback_text", ""))
                        if isinstance(out, dict)
                        else ""
                    ),
                    "corrections": out.get("corrections", []) if isinstance(out, dict) else [],
                    "better_expressions": out.get("better_expressions", []) if isinstance(out, dict) else [],
                    "scripts": [
                        {"speaker_name": s.get("speaker_name", ""), "text": s.get("text", "")}
                        for s in (out.get("scripts", []) if isinstance(out, dict) else [])
                        if isinstance(s, dict)
                    ],
                }

        return sorted(by_turn.values(), key=lambda x: x.get("turn_index", 0))

    # ──────────────────────────────────────────────
    # LLM 호출
    # ──────────────────────────────────────────────

    async def _call_llm(self, input_data: dict, prompt_config: dict) -> dict:
        """Gemini를 호출하여 Layer 3 분석 수행.

        기존 프로젝트 패턴(google.generativeai)을 따라
        JSON mode로 구조화된 출력을 보장합니다.
        SQLAlchemy async 세션과의 greenlet 충돌을 피하기 위해
        asyncio.to_thread로 동기 호출을 래핑합니다.

        Args:
            input_data: _build_input_data()가 반환한 dict.
            prompt_config: _get_prompt_config()가 반환한 설정.

        Returns:
            _validate_and_normalize()를 거친 Layer 3 dict.

        Raises:
            ValueError: LLM이 빈 응답 또는 잘못된 JSON을 반환한 경우.
        """
        import asyncio

        system_prompt = prompt_config["system_prompt"]
        model_name = prompt_config["llm_model"]
        temperature = float(prompt_config.get("temperature", "0.3"))
        user_message = json.dumps(input_data, ensure_ascii=False, indent=2)

        if not settings.GOOGLE_AI_API_KEY:
            raise ValueError("GOOGLE_AI_API_KEY not configured")

        genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
        )

        def _sync_call() -> str:
            """동기 LLM 호출 — asyncio.to_thread에서 실행."""
            response = model.generate_content(
                user_message,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": temperature,
                    "max_output_tokens": 8192,
                },
            )
            return response.text

        try:
            result_text = await asyncio.to_thread(_sync_call)

            if not result_text:
                raise ValueError("Empty response from Reporting LLM")

            result = json.loads(result_text)
            return self._validate_and_normalize(result)

        except json.JSONDecodeError as e:
            logger.error(f"[ReportingLLM] JSON parse error: {e}")
            raise ValueError(f"LLM returned invalid JSON: {e}") from e
        except Exception as e:
            logger.error(f"[ReportingLLM] API call failed: {e}")
            raise

    async def _get_prompt_config(self) -> dict:
        """DB에서 활성 프롬프트 설정을 조회. 없으면 기본값 반환.

        Returns:
            system_prompt, llm_model, temperature를 포함하는 dict.
        """
        from app.models.reporting_prompt_setting import ReportingPromptSetting

        result = await self.db.execute(
            select(ReportingPromptSetting)
            .where(ReportingPromptSetting.is_active.is_(True))
            .order_by(ReportingPromptSetting.updated_at.desc())
            .limit(1)
        )
        prompt_row = result.scalar_one_or_none()

        if prompt_row:
            logger.info(
                f"[ReportingLLM] Using DB prompt: {prompt_row.name} (id={prompt_row.id})"
            )
            return {
                "system_prompt": prompt_row.system_prompt,
                "llm_model": prompt_row.llm_model or DEFAULT_REPORTING_MODEL,
                "temperature": prompt_row.temperature or "0.3",
            }

        logger.info("[ReportingLLM] No DB prompt found, using DEFAULT_SYSTEM_PROMPT")
        return {
            "system_prompt": DEFAULT_SYSTEM_PROMPT,
            "llm_model": DEFAULT_REPORTING_MODEL,
            "temperature": "0.3",
        }

    def _validate_and_normalize(self, result: dict) -> dict:
        """LLM 출력을 검증하고 DB 필드에 맞게 정규화.

        누락된 필드는 기본값으로 채우고, 예상치 못한 필드는 무시합니다.

        Args:
            result: LLM이 반환한 JSON dict.

        Returns:
            정규화된 Layer 3 필드 dict.
        """
        normalized: dict = {}

        # String 필드
        for field in (
            "learning_behavior_summary",
            "engagement_level",
            "communication_style",
            "response_start_quality",
            "flow_maintenance",
        ):
            normalized[field] = result.get(field)

        # Integer 필드
        val = result.get("question_back_count")
        normalized["question_back_count"] = int(val) if val is not None else None

        # Float 필드
        for field in ("topic_maintenance_score", "natural_conversation_score"):
            val = result.get(field)
            normalized[field] = float(val) if val is not None else None

        # JSONB list 필드
        for field, default in (
            ("key_learning_points", []),
            ("struggle_points", []),
            ("improvement_suggestions", []),
            ("response_start_quality_detail", []),
            ("flow_maintenance_detail", []),
        ):
            val = result.get(field, default)
            normalized[field] = val if isinstance(val, list) else default

        # JSONB dict 필드
        for field in (
            "elaboration_adequacy",
            "explicit_clarification_analysis",
            "coping_attempt",
            "clarification_success",
            "avoidance_vs_response",
        ):
            val = result.get(field)
            normalized[field] = val if isinstance(val, dict) else None

        return normalized

    # ──────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _safe_get(data: dict | None, *keys: str):
        """중첩 딕셔너리에서 안전하게 값을 추출.

        Args:
            data: 최상위 dict (None 가능).
            *keys: 순서대로 탐색할 키 목록.

        Returns:
            최종 값 또는 None.
        """
        if not isinstance(data, dict):
            return None
        current = data
        for key in keys:
            if not isinstance(current, dict):
                return None
            current = current.get(key)
            if current is None:
                return None
        return current

    # ──────────────────────────────────────────────
    # DB Queries
    # ──────────────────────────────────────────────

    async def _get_session(self, session_id: UUID) -> Optional[ConversationSession]:
        from sqlalchemy.orm import selectinload
        from app.models.conversation import ConversationTemplate

        result = await self.db.execute(
            select(ConversationSession)
            .options(selectinload(ConversationSession.template))
            .where(ConversationSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def _get_turns(self, session_id: UUID) -> list[ConversationTurn]:
        result = await self.db.execute(
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index)
        )
        return list(result.scalars().all())

    async def _get_pipeline_logs(self, session_id: UUID) -> list[PipelineLog]:
        result = await self.db.execute(
            select(PipelineLog)
            .where(PipelineLog.session_id == session_id)
            .order_by(PipelineLog.turn_index)
        )
        return list(result.scalars().all())

    async def _get_observation(self, session_id: UUID) -> Optional[SessionObservation]:
        result = await self.db.execute(
            select(SessionObservation).where(SessionObservation.session_id == session_id)
        )
        return result.scalar_one_or_none()
