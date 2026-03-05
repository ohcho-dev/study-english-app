"""Evaluator Service for Narrative Sync v0.2.

Analyzes user input (STT transcript) and outputs quantitative scores/diagnosis
in strict JSON format. Designed for fast, deterministic evaluation.
"""

import json
import logging
import time
import uuid
from typing import Optional

import google.generativeai as genai
from app.core.config import settings
from app.schemas.pipeline_schemas import (
    AggregateScores,
    Diagnosis,
    DetectedElements,
    EvaluatorOutput,
    FluencyMetrics,
    SlotScore,
)

logger = logging.getLogger(__name__)



class EvaluatorService:
    """Evaluates user utterances with strict JSON output.

    Attributes:
        llm_model: LLM model name for evaluation.
        custom_prompt: Optional custom prompt override from template.
    """

    def __init__(
        self,
        llm_model: str = "gemini-2.5-flash",
        custom_prompt: Optional[str] = None,
    ) -> None:
        self.llm_model = llm_model
        self.custom_prompt = custom_prompt
        self.model = None

        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            self.model = genai.GenerativeModel(llm_model)
        else:
            logger.warning("GOOGLE_AI_API_KEY not set for EvaluatorService")

    async def evaluate(
        self,
        transcript: str,
        topic: Optional[str] = None,
        target_level: Optional[int] = None,
        active_pattern: Optional[str] = None,
        scene_context: Optional[str] = None,
        history_text: Optional[str] = None,
        trace_id: Optional[str] = None,
        session_id: Optional[str] = None,
        turn_id: Optional[str] = None,
    ) -> tuple[EvaluatorOutput, float]:
        """Evaluate user transcript and return structured scores.

        Args:
            transcript: User's transcribed speech.
            topic: Conversation topic.
            target_level: Target difficulty level (1-10).
            active_pattern: Current narrative pattern (e.g., "ABC").
            scene_context: Scene description.
            history_text: Recent conversation history.
            trace_id: Pipeline trace ID.
            session_id: Session ID.
            turn_id: Turn ID.

        Returns:
            Tuple of (EvaluatorOutput, duration_ms).
        """
        t_start = time.time()
        _trace_id = trace_id or str(uuid.uuid4())

        # 1. Heuristic fast path for hesitation fillers
        import re
        input_cleaned = transcript.strip() if transcript else ""
        hesitation_pattern = re.compile(
            r"^(m+|h+m+|uh+|ah+|huh+)\s*[.,?!\-]*$", re.IGNORECASE
        )

        if hesitation_pattern.match(input_cleaned):
            logger.info(
                f"[Evaluator] Heuristic: '{input_cleaned}' → hesitation filler"
            )
            output = EvaluatorOutput(
                trace_id=_trace_id,
                session_id=session_id or "",
                turn_id=turn_id or "",
                narrative_scores={
                    "slot_a": SlotScore(score=0, is_missing=True),
                    "slot_b": SlotScore(score=0, is_missing=True),
                    "slot_c": SlotScore(score=0, is_missing=True),
                },
                aggregate=AggregateScores(
                    slot_avg=0,
                    imitation_score=0,
                    complexity_score=0,
                    overall_score=10,
                ),
                diagnosis=Diagnosis(
                    primary_issue="MISSING_SLOT_B",
                    recommended_action="TRIGGER_HELPER",
                ),
            )
            duration_ms = (time.time() - t_start) * 1000
            return output, duration_ms

        # 2. Empty or very short input
        if not input_cleaned or len(input_cleaned) < 2:
            logger.info(f"[Evaluator] Empty/too-short input: '{input_cleaned}'")
            output = EvaluatorOutput(
                trace_id=_trace_id,
                session_id=session_id or "",
                turn_id=turn_id or "",
                aggregate=AggregateScores(
                    slot_avg=0,
                    imitation_score=0,
                    complexity_score=0,
                    overall_score=0,
                ),
                diagnosis=Diagnosis(
                    primary_issue="MISSING_SLOT_A",
                    recommended_action="TRIGGER_HELPER",
                ),
            )
            duration_ms = (time.time() - t_start) * 1000
            return output, duration_ms

        # 3. LLM-based evaluation
        if not self.model:
            logger.warning("[Evaluator] No LLM model available, using fallback")
            return self._fallback_evaluation(
                transcript, _trace_id, session_id, turn_id, t_start
            )

        # Build prompt: custom replaces base (same as Planner/Conductor)
        base_prompt = self.custom_prompt or ""

        context_parts = [base_prompt]
        if topic:
            context_parts.append(f"\n## Context\nTopic: {topic}")
        if target_level:
            context_parts.append(f"Target Level: {target_level}")
        if active_pattern:
            context_parts.append(f"Active Pattern: {active_pattern}")
        if scene_context:
            context_parts.append(f"Scene: {scene_context}")
        if history_text:
            context_parts.append(f"\n## Recent Conversation\n{history_text}")

        context_parts.append(f'\n## User\'s Latest Utterance\n"{transcript}"')
        context_parts.append(
            "\n## OUTPUT\nRespond with the JSON object ONLY. No markdown fences."
        )

        prompt = "\n".join(context_parts)

        # Call LLM with retry
        for attempt in range(2):
            try:
                response = await self.model.generate_content_async(
                    prompt,
                    generation_config={
                        "response_mime_type": "application/json",
                        "temperature": 0.1,
                    },
                )
                result = json.loads(response.text)

                # Parse into Pydantic model
                output = self._parse_llm_response(
                    result, _trace_id, session_id, turn_id
                )
                duration_ms = (time.time() - t_start) * 1000
                logger.info(
                    f"[Evaluator] Success (attempt {attempt + 1}): "
                    f"overall_score={output.aggregate.overall_score}, "
                    f"duration={duration_ms:.0f}ms"
                )
                return output, duration_ms

            except json.JSONDecodeError as e:
                logger.warning(
                    f"[Evaluator] JSON parse error (attempt {attempt + 1}): {e}"
                )
                if attempt == 0:
                    continue  # Retry once
            except Exception as e:
                logger.error(
                    f"[Evaluator] LLM error (attempt {attempt + 1}): {e}"
                )
                if attempt == 0:
                    continue

        # All retries failed → fallback
        logger.warning("[Evaluator] All retries failed, using rule-based fallback")
        return self._fallback_evaluation(
            transcript, _trace_id, session_id, turn_id, t_start
        )

    def _parse_llm_response(
        self,
        result: dict,
        trace_id: str,
        session_id: Optional[str],
        turn_id: Optional[str],
    ) -> EvaluatorOutput:
        """Parse LLM JSON response into EvaluatorOutput.

        Handles missing/incomplete fields gracefully.
        """
        # Narrative scores
        ns = result.get("narrative_scores", {})
        narrative_scores = {}
        for slot_key in ["slot_a", "slot_b", "slot_c"]:
            slot_data = ns.get(slot_key, {})
            narrative_scores[slot_key] = SlotScore(
                score=min(10, max(0, int(slot_data.get("score", 0)))),
                is_missing=bool(slot_data.get("is_missing", True)),
                evidence=str(slot_data.get("evidence", "")),
            )

        # Aggregate
        agg = result.get("aggregate", {})
        aggregate = AggregateScores(
            slot_avg=float(agg.get("slot_avg", 0)),
            imitation_score=min(10, max(0, int(agg.get("imitation_score", 0)))),
            complexity_score=min(10, max(0, int(agg.get("complexity_score", 0)))),
            overall_score=min(100, max(0, int(agg.get("overall_score", 0)))),
        )

        # Detected elements
        det = result.get("detected", {})
        detected = DetectedElements(
            anchors=det.get("anchors", []),
            connectors=det.get("connectors", []),
            used_key_phrases=det.get("used_key_phrases", []),
        )

        # Fluency
        fl = result.get("fluency", {})
        fluency = FluencyMetrics(
            pause_count=max(0, int(fl.get("pause_count", 0))),
            words_per_minute=max(0, float(fl.get("words_per_minute", 0))),
        )

        # Diagnosis
        diag = result.get("diagnosis", {})
        diagnosis = Diagnosis(
            primary_issue=diag.get("primary_issue", "NONE"),
            secondary_issues=diag.get("secondary_issues", []),
            recommended_action=diag.get("recommended_action", "CONTINUE"),
        )

        return EvaluatorOutput(
            trace_id=trace_id,
            session_id=session_id or "",
            turn_id=turn_id or "",
            narrative_scores=narrative_scores,
            aggregate=aggregate,
            detected=detected,
            fluency=fluency,
            diagnosis=diagnosis,
        )

    def _fallback_evaluation(
        self,
        transcript: str,
        trace_id: str,
        session_id: Optional[str],
        turn_id: Optional[str],
        t_start: float,
    ) -> tuple[EvaluatorOutput, float]:
        """Rule-based fallback when LLM is unavailable or fails.

        Uses simple heuristics: word count → complexity, sentence detection, etc.
        """
        words = transcript.split()
        word_count = len(words)

        # Simple heuristic scoring
        if word_count <= 2:
            overall = 20
            complexity = 1
            slot_a = SlotScore(score=2, is_missing=True)
            slot_b = SlotScore(score=2, is_missing=True)
            slot_c = SlotScore(score=0, is_missing=True)
            primary_issue = "MISSING_SLOT_B"
            recommended = "TRIGGER_HELPER"
        elif word_count <= 5:
            overall = 40
            complexity = 3
            slot_a = SlotScore(score=5, is_missing=False, evidence=transcript)
            slot_b = SlotScore(score=3, is_missing=True)
            slot_c = SlotScore(score=0, is_missing=True)
            primary_issue = "MISSING_SLOT_C"
            recommended = "ADD_MODELING"
        elif word_count <= 15:
            overall = 65
            complexity = 5
            slot_a = SlotScore(score=7, is_missing=False, evidence=transcript[:50])
            slot_b = SlotScore(score=6, is_missing=False, evidence=transcript[:50])
            slot_c = SlotScore(score=3, is_missing=True)
            primary_issue = "NONE"
            recommended = "CONTINUE"
        else:
            overall = 80
            complexity = 7
            slot_a = SlotScore(score=8, is_missing=False, evidence=transcript[:30])
            slot_b = SlotScore(score=8, is_missing=False, evidence=transcript[30:60])
            slot_c = SlotScore(score=6, is_missing=False, evidence=transcript[-30:])
            primary_issue = "NONE"
            recommended = "DENSITY_UP" if word_count > 25 else "CONTINUE"

        output = EvaluatorOutput(
            trace_id=trace_id,
            session_id=session_id or "",
            turn_id=turn_id or "",
            narrative_scores={
                "slot_a": slot_a,
                "slot_b": slot_b,
                "slot_c": slot_c,
            },
            aggregate=AggregateScores(
                slot_avg=round(
                    (slot_a.score + slot_b.score + slot_c.score) / 3, 1
                ),
                imitation_score=min(overall // 10, 10),
                complexity_score=complexity,
                overall_score=overall,
            ),
            detected=DetectedElements(),
            fluency=FluencyMetrics(
                words_per_minute=word_count * 6 if word_count > 0 else 0,
            ),
            diagnosis=Diagnosis(
                primary_issue=primary_issue,
                recommended_action=recommended,
            ),
        )
        duration_ms = (time.time() - t_start) * 1000
        logger.info(
            f"[Evaluator] Fallback: overall_score={overall}, duration={duration_ms:.0f}ms"
        )
        return output, duration_ms
