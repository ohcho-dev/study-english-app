"""Planner Service for Narrative Sync v0.2.

Receives Evaluator output and session state, determines the next educational strategy
using LLM analysis with rule-based fallback.

Per requirements doc:
- Section 8.1: "Evaluator 결과를 받아 다음 교육 전략을 결정한다."
- Section 17.2: "Gemini Flash (또는 Rule Engine)" — LLM이 기본, rule engine이 대안.

v0.2 Redesign:
- LLM-based level determination with 10-level progressive difficulty
- Rule-based fallback when LLM is unavailable
- Always returns ALL AI participants for normal round-robin turn flow
- No retry logic — turn always proceeds normally
"""

import asyncio
import json
import logging
import time
from typing import Optional

import google.generativeai as genai
from app.core.config import settings
from app.services.conversation.default_levels import DEFAULT_LEVEL_DEFINITIONS
from app.schemas.pipeline_schemas import (
    Decision,
    DecisionConstraints,
    EvaluatorOutput,
    PersonaPlan,
    PlannerOutput,
    SCHEMA_VERSION,
)

logger = logging.getLogger(__name__)




class SessionState:
    """Tracks session-level state for Planner decisions.

    Attributes:
        recent_scores: List of recent overall_scores (last N turns).
        last_strategy: Last action_code used.
        consecutive_helpers: Count of consecutive low-score turns.
        consecutive_high_scores: Turns in a row with score >= 75 (LEVEL_UP condition).
        turn_count: Total turns in session so far.
        current_level: Current difficulty level (1-10).
        custom_state: Free-form dict for scenario-specific state managed by Planner LLM.
    """

    def __init__(
        self,
        recent_scores: Optional[list[int]] = None,
        last_strategy: Optional[str] = None,
        consecutive_helpers: int = 0,
        consecutive_high_scores: int = 0,
        turn_count: int = 0,
        current_level: int = 1,
        custom_state: Optional[dict] = None,
    ) -> None:
        self.recent_scores = recent_scores or []
        self.last_strategy = last_strategy
        self.consecutive_helpers = consecutive_helpers
        self.consecutive_high_scores = consecutive_high_scores
        self.turn_count = turn_count
        self.current_level = max(1, min(10, current_level))
        self.custom_state = custom_state or {}

    @classmethod
    def from_variant(cls, variant_data: dict) -> "SessionState":
        """Extract session state from variant JSON data."""
        pipeline_state = variant_data.get("_pipeline_state", {})
        return cls(
            recent_scores=pipeline_state.get("recent_scores", []),
            last_strategy=pipeline_state.get("last_strategy"),
            consecutive_helpers=pipeline_state.get("consecutive_helpers", 0),
            consecutive_high_scores=pipeline_state.get("consecutive_high_scores", 0),
            turn_count=pipeline_state.get("turn_count", 0),
            current_level=pipeline_state.get("current_level", 1),
            custom_state=pipeline_state.get("custom_state", {}),
        )

    def to_dict(self) -> dict:
        """Serialize state for storage in session variant."""
        return {
            "recent_scores": self.recent_scores[-10:],
            "last_strategy": self.last_strategy,
            "consecutive_helpers": self.consecutive_helpers,
            "consecutive_high_scores": self.consecutive_high_scores,
            "turn_count": self.turn_count,
            "current_level": self.current_level,
            "custom_state": self.custom_state,
        }


class PlannerService:
    """Determines next difficulty level using LLM analysis with rule-based fallback.

    Uses LLM by default for nuanced educational strategy decisions.
    Falls back to rule-based logic if LLM is unavailable or fails.
    """

    def __init__(
        self,
        llm_model: str = "gemini-2.0-flash",
        custom_prompt: Optional[str] = None,
        level_definitions: Optional[list] = None,
    ) -> None:
        self.llm_model = llm_model
        self.custom_prompt = custom_prompt
        
        
        # Use template-provided level definitions
        # None → use default 10 stages, [] → disable custom guidance
        if level_definitions is None:
            source_defs = DEFAULT_LEVEL_DEFINITIONS
        else:
            source_defs = level_definitions

        if source_defs:
            self.level_defs = {
                item["level"]: {
                    "name": item.get("name", f"Level {item['level']}"),
                    "description": item.get("description", ""),
                    "instruction": item.get("instruction", ""),
                }
                for item in source_defs
            }
        else:
            self.level_defs = {}
        
        self.max_level = max(self.level_defs.keys()) if self.level_defs else 10

        # Initialize LLM
        self.model = None
        try:
            if settings.GOOGLE_AI_API_KEY:
                genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
                self.model = genai.GenerativeModel(llm_model)
        except Exception as e:
            logger.warning(f"[Planner] Failed to init LLM ({llm_model}): {e}")

    async def decide(
        self,
        eval_output: EvaluatorOutput,
        session_state: SessionState,
        participants: Optional[list] = None,
        trace_id: Optional[str] = None,
        turn_id: Optional[str] = None,
        history_text: Optional[str] = None,
        scene_context: Optional[str] = None,
        response_delay_sec: Optional[float] = None,
    ) -> tuple[PlannerOutput, float]:
        """Make a strategic decision based on evaluation results.

        Uses LLM for nuanced analysis, with rule-based fallback.

        Returns:
            Tuple of (PlannerOutput, duration_ms).
        """
        t_start = time.time()

        overall_score = eval_output.aggregate.overall_score
        complexity = eval_output.aggregate.complexity_score
        primary_issue = eval_output.diagnosis.primary_issue
        prev_level = session_state.current_level

        # Try LLM-based decision first
        new_level, path, reasons, engine_trace = await self._llm_decide(
            eval_output=eval_output,
            session_state=session_state,
            prev_level=prev_level,
            history_text=history_text,
            scene_context=scene_context,
            response_delay_sec=response_delay_sec,
        )

        # If LLM failed, fallback to rule-based
        if new_level is None:
            engine_trace = None
            new_level, path, reasons = self._rule_based_decide(
                overall_score=overall_score,
                complexity=complexity,
                primary_issue=primary_issue,
                current_level=prev_level,
                session_state=session_state,
            )

        # ── Code-level consecutive score tracking ──
        # consecutive_high_scores: score >= 75 consecutively (LEVEL_UP gate)
        HIGH_SCORE_THRESHOLD = 75
        if overall_score >= HIGH_SCORE_THRESHOLD:
            session_state.consecutive_high_scores += 1
        else:
            session_state.consecutive_high_scores = 0

        can_level_up = session_state.consecutive_high_scores >= 2
        can_level_down = overall_score < 40

        if path == "LEVEL_UP" and not can_level_up:
            # LLM requested UP but consecutive condition not met
            logger.info(
                f"[Planner] Overriding LEVEL_UP -> LEVEL_HOLD "
                f"(consecutive_high={session_state.consecutive_high_scores} < 2)"
            )
            path = "LEVEL_HOLD"
            new_level = prev_level
            reasons = list(reasons or [])
            reasons.append(
                f"LEVEL_UP blocked: need 2 consecutive >=75 scores, "
                f"current streak={session_state.consecutive_high_scores}"
            )
        elif can_level_up and path == "LEVEL_HOLD" and new_level == prev_level:
            # LLM chose HOLD but 2-turn streak achieved -> promote to UP
            logger.info(
                f"[Planner] Overriding LEVEL_HOLD -> LEVEL_UP "
                f"(consecutive_high={session_state.consecutive_high_scores} >= 2)"
            )
            path = "LEVEL_UP"
            new_level = min(self.max_level, prev_level + 1)
            reasons = list(reasons or [])
            reasons.append(
                f"LEVEL_UP confirmed: {session_state.consecutive_high_scores} consecutive >=75 scores"
            )
        elif can_level_down and path not in ("LEVEL_DOWN",):
            logger.info(
                f"[Planner] Override -> LEVEL_DOWN (score={overall_score} < 40)"
            )
            path = "LEVEL_DOWN"
            new_level = max(1, prev_level - 1)

        # Reset high-score streak after leveling up (prevent multi-jumps)
        if path == "LEVEL_UP":
            session_state.consecutive_high_scores = 0

        action_code = "LEVEL_ADJUST"

        # ===== Build Constraints =====
        level_def = self.level_defs.get(new_level, self.level_defs.get(1, {"instruction": ""}))
        constraints = DecisionConstraints(
            target_pattern="ABC",
            must_include=[level_def["instruction"]],
            banned=[],
        )

        # ===== Build Persona Plan — ALWAYS all AI participants =====
        persona_plan = self._build_persona_plan(
            participants=participants,
            level=new_level,
        )

        # ===== Update Session State =====
        session_state.recent_scores.append(overall_score)
        session_state.last_strategy = action_code
        session_state.turn_count += 1
        session_state.current_level = new_level
        if overall_score < 40:
            session_state.consecutive_helpers += 1
        else:
            session_state.consecutive_helpers = 0

        # ===== Build Output =====
        output = PlannerOutput(
            schema_version=SCHEMA_VERSION,
            trace_id=trace_id or eval_output.trace_id,
            turn_id=turn_id or eval_output.turn_id,
            decision=Decision(
                path=path,
                action_code=action_code,
                reason=reasons,
                next_constraints=constraints,
            ),
            persona_plan=persona_plan,
            engine_trace=engine_trace,
        )

        duration_ms = (time.time() - t_start) * 1000
        logger.info(
            f"[Planner] Level: {prev_level} -> {new_level}, path={path}, "
            f"score={overall_score}, consecutive_high={session_state.consecutive_high_scores}, "
            f"duration={duration_ms:.1f}ms"
        )
        return output, duration_ms


    async def _llm_decide(
        self,
        eval_output: EvaluatorOutput,
        session_state: SessionState,
        prev_level: int,
        history_text: Optional[str] = None,
        scene_context: Optional[str] = None,
        response_delay_sec: Optional[float] = None,
    ) -> tuple[Optional[int], Optional[str], Optional[list[str]], Optional[dict]]:
        """Use LLM for nuanced level decision.

        Returns:
            Tuple of (new_level, path, reasons, engine_trace) or (None, None, None, None) on failure.
        """
        if not self.model:
            logger.info("[Planner] No LLM model, using rule-based fallback")
            return None, None, None, None

        # Build prompt: use custom_prompt from Admin (no hardcoded fallback)
        base_prompt = self.custom_prompt or ""
        
        # Build level list from self.level_defs
        level_list = "\n".join(
            f"Level {lvl}: {info['name']} ({info['instruction']})"
            for lvl, info in sorted(self.level_defs.items())
        )
        base_prompt = base_prompt.replace(
            "## 10 DIFFICULTY LEVELS",
            f"## {self.max_level} DIFFICULTY LEVELS"
        )
        # Append dynamic level definitions
        base_prompt += f"\n\n## Available Levels\n{level_list}"

        # Format custom_state for display
        custom_state_str = ""
        if session_state.custom_state:
            custom_state_str = "\n## Scenario Custom State (from previous turn)\n"
            custom_state_str += json.dumps(session_state.custom_state, ensure_ascii=False, indent=2)
            custom_state_str += "\n\nYou MUST update and return custom_state in your JSON output to track scenario-specific progression."

        delay_value = f"{response_delay_sec:.2f}" if response_delay_sec is not None else "unknown"
        delay_note = (
            "Slow start — consider encouragement."
            if response_delay_sec is not None
            else "Response delay not measured this turn."
        )

        user_msg = f"""## Evaluator Results
- Overall Score: {eval_output.aggregate.overall_score}/100
- Slot A (Context): {eval_output.narrative_scores.get('slot_a', {}).score if hasattr(eval_output.narrative_scores.get('slot_a', {}), 'score') else 'N/A'}/10
- Slot B (Core Story): {eval_output.narrative_scores.get('slot_b', {}).score if hasattr(eval_output.narrative_scores.get('slot_b', {}), 'score') else 'N/A'}/10
- Slot C (Insight): {eval_output.narrative_scores.get('slot_c', {}).score if hasattr(eval_output.narrative_scores.get('slot_c', {}), 'score') else 'N/A'}/10
- Imitation Score: {eval_output.aggregate.imitation_score}/10
- Complexity Score: {eval_output.aggregate.complexity_score}/10
- Primary Issue: {eval_output.diagnosis.primary_issue}
- Secondary Issues: {', '.join(eval_output.diagnosis.secondary_issues) or 'None'}
- Recommended Action: {eval_output.diagnosis.recommended_action}
- "response_delay_sec": "{delay_value}"
- Response Delay Note: {delay_note}

## Recent Conversation History
{history_text or '(session just started)'}

## Session State
- Current Level: {prev_level} ({self.level_defs.get(prev_level, {}).get('name', 'Unknown')})
- Recent Scores: {session_state.recent_scores[-5:] if session_state.recent_scores else 'First turn'}
- Turn Count: {session_state.turn_count}
- Last Strategy: {session_state.last_strategy or 'None'}
{custom_state_str}

Determine the optimal next level (1-{self.max_level}) and provide your reasoning.
Use the conversation history to understand the current context — which verb/topic is being practiced, what the student has already done.
Return JSON with: new_level, path, reasons, focus_area, and custom_state (object with any scenario-specific tracking data)."""

        MAX_RETRIES = 3
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = await self.model.generate_content_async(
                    [{"role": "user", "parts": [{"text": base_prompt + "\n\n" + user_msg}]}],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=1000,
                        response_mime_type="application/json",
                    ),
                )

                data = json.loads(response.text)
                logger.warning(f"[Planner] RAW LLM response: {json.dumps(data, ensure_ascii=False)}")
                new_level = max(1, min(self.max_level, int(data.get("new_level", prev_level))))
                path = data.get("path", "LEVEL_HOLD")
                reasons = data.get("reasons", [])
                focus = data.get("focus_area", "")
                if focus:
                    reasons.append(f"Focus: {focus}")

                # Persist scenario-specific custom_state from LLM output
                if isinstance(data.get("custom_state"), dict):
                    session_state.custom_state = data["custom_state"]

                # Collect extra fields not in standard schema as engine_trace
                _standard_keys = {
                    "new_level", "path", "reasons", "focus_area", "custom_state",
                    "schema_version", "trace_id", "turn_id", "decision", "persona_plan",
                }
                extra = {k: v for k, v in data.items() if k not in _standard_keys}
                engine_trace = extra if extra else None

                logger.warning(
                    f"[Planner] LLM decision: level {prev_level}→{new_level}, path={path}, "
                    f"custom_state={session_state.custom_state}"
                )
                return new_level, path, reasons, engine_trace

            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"[Planner] LLM attempt {attempt + 1}/{MAX_RETRIES} failed: {e}. Retrying...")
                    await asyncio.sleep(1)
                else:
                    logger.error(f"[Planner] LLM failed after {MAX_RETRIES} attempts: {e}")
        
        return None, None, None, None

    def _rule_based_decide(
        self,
        overall_score: int,
        complexity: int,
        primary_issue: str,
        current_level: int,
        session_state: SessionState,
    ) -> tuple[int, str, list[str]]:
        """Conservative rule-based fallback for level determination.

        Used when LLM fails. Keeps changes minimal to avoid
        aggressive level jumps without LLM intelligence.

        Returns:
            Tuple of (new_level, path, reasons).
        """
        reasons: list[str] = ["(rule-based fallback)"]

        if overall_score < 40:
            path = "LEVEL_DOWN"
            delta = -1
            reasons.append(f"Score {overall_score} < 40 → level down")
        elif overall_score >= 90:
            path = "LEVEL_UP"
            delta = 1
            reasons.append(f"Score {overall_score} >= 90 → level up +1")
        else:
            path = "LEVEL_HOLD"
            delta = 0
            reasons.append(f"Score {overall_score}: 40-89 → level hold")

        new_level = max(1, min(self.max_level, current_level + delta))
        reasons.append(f"Level: {current_level} → {new_level}")
        return new_level, path, reasons

    def _build_persona_plan(
        self,
        participants: Optional[list] = None,
        level: int = 1,
    ) -> PersonaPlan:
        """Build persona plan — ALWAYS includes all AI participants."""
        speakers: list[str] = []

        if participants:
            from app.models.conversation import ParticipantType

            ai_participants = [
                p for p in sorted(participants, key=lambda x: x.order_index)
                if p.participant_type != ParticipantType.USER
            ]
            for p in ai_participants:
                speakers.append(p.name)

        return PersonaPlan(
            speakers=speakers,
            order=speakers,
            tone="instructive" if level <= 3 else "natural",
            language="en-US",
            current_level=level,
        )
