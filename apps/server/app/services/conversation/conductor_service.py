"""Conductor Service for Narrative Sync v0.2.

Receives Planner output and generates:
1. Moderator (민경쌤) feedback script — evaluates the user's previous turn
2. Level instructions for AI participants — what level to demonstrate
3. Corrections and better expressions for educational value

v0.2 Redesign:
- No retry logic: return_to_user_after is ALWAYS False
- Moderator acts as teacher: provides feedback, corrections, level guidance
- AI participants receive level-appropriate instructions
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
    ConductorOutput,
    ConductorScript,
    PersonaPlan,
    PlannerOutput,
    SCHEMA_VERSION,
)

logger = logging.getLogger(__name__)




class ConductorService:
    """Generates moderator feedback and AI scripts at appropriate difficulty levels."""

    def __init__(
        self,
        llm_model: str = "gemini-2.0-flash",
        custom_prompt: Optional[str] = None,
        level_definitions: Optional[list] = None,
    ) -> None:
        self.llm_model = llm_model
        self.custom_prompt = custom_prompt
        self.last_prompt: Optional[str] = None
        genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
        # Use Admin definitions when provided. None → default list, [] → disable.
        if level_definitions is None:
            source_defs = DEFAULT_LEVEL_DEFINITIONS
        else:
            source_defs = level_definitions

        if source_defs:
            self.level_instructions = {
                item["level"]: item.get("instruction", f"Level {item['level']}")
                for item in source_defs
            }
        else:
            self.level_instructions = {}

    async def generate_scripts(
        self,
        planner_output: PlannerOutput,
        participants: Optional[list] = None,
        scene_context: Optional[str] = None,
        history_text: Optional[str] = None,
        user_transcript: Optional[str] = None,
        user_name: Optional[str] = None,
        system_prompt: Optional[str] = None,
        trace_id: Optional[str] = None,
        turn_id: Optional[str] = None,
        custom_state: Optional[dict] = None,
        response_delay_sec: Optional[float] = None,
        raw_payload: Optional[dict] = None,
    ) -> tuple[ConductorOutput, float]:
        """Generate moderator feedback and AI scripts."""
        t_start = time.time()

        self.last_prompt = None
        level = planner_output.persona_plan.current_level
        level_instr = self.level_instructions.get(level, self.level_instructions.get(1, f"Level {level}"))
        action = planner_output.decision.action_code
        path = planner_output.decision.path

        # Build participant info
        participant_info = self._build_participant_info(participants)
        
        # Build prompt
        base_prompt = self.custom_prompt or ""
        
        user_msg = self._build_user_message(
            planner_output=planner_output,
            level=level,
            level_instruction=level_instr,
            participant_info=participant_info,
            scene_context=scene_context,
            history_text=history_text,
            user_transcript=user_transcript,
            user_name=user_name,
            custom_state=custom_state,
            response_delay_sec=response_delay_sec,
            raw_payload=raw_payload,
        )

        MAX_RETRIES = 3
        last_error = None
        result = None
        for attempt in range(MAX_RETRIES):
            try:
                model = genai.GenerativeModel(self.llm_model)
                prompt_text = base_prompt + "\n\n" + user_msg
                logger.warning(f"[Conductor] Prompt: {prompt_text}")
                self.last_prompt = prompt_text
                response = await model.generate_content_async(
                    [
                        {"role": "user", "parts": [{"text": prompt_text}]},
                    ],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=4096,
                        response_mime_type="application/json",
                    ),
                )
                
                result = self._parse_response(
                    response.text,
                    planner_output=planner_output,
                    participants=participants,
                    level=level,
                    level_instruction=level_instr,
                    trace_id=trace_id,
                    turn_id=turn_id,
                )
                last_error = None
                break
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"[Conductor] LLM attempt {attempt + 1}/{MAX_RETRIES} failed: {e}. Retrying...")
                    await asyncio.sleep(1)
                else:
                    logger.error(f"[Conductor] LLM failed after {MAX_RETRIES} attempts: {e}")
        
        if last_error or result is None:
            raise Exception(f"Conductor LLM generation failed after {MAX_RETRIES} attempts: {last_error}")

        duration_ms = (time.time() - t_start) * 1000
        logger.info(
            f"[Conductor] Level={level}, scripts={len(result.scripts)}, "
            f"feedback_len={len(result.feedback_text)}, "
            f"duration={duration_ms:.0f}ms"
        )
        return result, duration_ms

    @staticmethod
    def _normalize_string_list(items: list) -> list[str]:
        """Convert a list of mixed str/dict items into a list of strings."""
        result = []
        for item in items:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                result.append(json.dumps(item, ensure_ascii=False))
            else:
                result.append(str(item))
        return result

    def _build_participant_info(self, participants: Optional[list]) -> str:
        if not participants:
            return "No participants defined."
        
        from app.models.conversation import ParticipantType
        
        lines = []
        for p in sorted(participants, key=lambda x: x.order_index):
            ptype = p.participant_type.value if hasattr(p.participant_type, 'value') else str(p.participant_type)
            if ptype == "user":
                continue
            role = "Moderator" if ptype == "moderator" else "AI Participant"
            desc = p.persona or ""
            lines.append(f"- {p.name} ({role}): {desc}")
        return "\n".join(lines) if lines else "No AI participants."

    def _build_user_message(
        self,
        planner_output: PlannerOutput,
        level: int,
        level_instruction: str,
        participant_info: str,
        scene_context: Optional[str],
        history_text: Optional[str],
        user_transcript: Optional[str],
        user_name: Optional[str],
        custom_state: Optional[dict] = None,
        response_delay_sec: Optional[float] = None,
        raw_payload: Optional[dict] = None,
    ) -> str:
        decision = planner_output.decision

        custom_state_str = ""
        if custom_state:
            custom_state_str = f"\n## Scenario State (from Planner)\n{json.dumps(custom_state, ensure_ascii=False)}"
            custom_state_str += "\nUse this state to determine what to practice next. Generate scripts consistent with this state."

        delay_value = f"{response_delay_sec:.2f}" if response_delay_sec is not None else "unknown"
        delay_note = (
            "Encourage faster turn-taking if the delay is long."
            if response_delay_sec is not None
            else "Response delay not measured for this turn."
        )

        question_completed = (
            planner_output.engine_trace.get("question_completed") if planner_output.engine_trace else False
        )
        intervention_seq = (
            planner_output.engine_trace.get("intervention_seq") if planner_output.engine_trace else None
        )
        question_id = (
            planner_output.engine_trace.get("question_id") if planner_output.engine_trace else None
        )

        message = f"""## Current State
- Path: {decision.path}
- Action: {decision.action_code}
- Reasons: {', '.join(decision.reason)}
- Level: {level}
- Level Instruction: {level_instruction}
{custom_state_str}

## Participants
{participant_info}

## Scene Context
{scene_context or 'General conversation practice'}

## Response Timing Clues
- "response_delay_sec": "{delay_value}"
- {delay_note}

## User ({user_name or 'Student'}) said:
"{user_transcript or '(no input)'}"

## Recent History
{history_text or '(session just started)'}

## Planner Question State
- question_id: {question_id or 'unknown'}
- intervention_seq: {intervention_seq if intervention_seq is not None else 'unknown'}
- question_completed: {question_completed}

If question_completed is true, return engine_module_used="None" with no intervention.
Generate scripts based on the current state. return_to_user_after MUST be false."""

        if raw_payload:
            try:
                payload_str = json.dumps(raw_payload, ensure_ascii=False, indent=2)
            except Exception:
                payload_str = str(raw_payload)
            message += f"\n\n## Runtime Payload\n{payload_str}"

        return message

    def _parse_response(
        self,
        raw_text: str,
        planner_output: PlannerOutput,
        participants: Optional[list],
        level: int,
        level_instruction: str,
        trace_id: Optional[str],
        turn_id: Optional[str],
    ) -> ConductorOutput:
        """Parse LLM JSON response into ConductorOutput."""
        logger.info(f"[Conductor] Raw LLM response (first 500 chars): {raw_text[:500]}")
        
        # Sanitize: remove trailing commas before } or ] (common LLM JSON error)
        import re
        sanitized = re.sub(r',\s*([}\]])', r'\1', raw_text)
        
        try:
            data = json.loads(sanitized)
        except json.JSONDecodeError as e:
            logger.error(f"[Conductor] JSON parse FAILED: {e}. Raw text (first 1000): {raw_text[:1000]}")
            return self._build_fallback(
                planner_output, participants, level, level_instruction, trace_id, turn_id
            )

        scripts = []
        for s in data.get("scripts", []):
            if s.get("text"):
                scripts.append(ConductorScript(
                    speaker_name=s.get("speaker_name", "AI"),
                    text=s["text"],
                    instruction=s.get("instruction", ""),
                    language=s.get("language", "en-US"),
                ))

        # Collect extra fields not in standard schema as engine_trace
        _standard_keys = {
            "scripts", "return_to_user_after", "user_emotion",
            "feedback_text", "feedback_instruction", "level_instruction",
            "corrections", "better_expressions", "energy_flow",
            "schema_version", "trace_id", "turn_id",
        }
        extra = {k: v for k, v in data.items() if k not in _standard_keys}
        engine_trace = extra if extra else None

        return ConductorOutput(
            schema_version=SCHEMA_VERSION,
            trace_id=trace_id or "",
            turn_id=turn_id or "",
            scripts=scripts,
            return_to_user_after=False,  # ALWAYS false
            user_emotion=data.get("user_emotion", "neutral"),
            feedback_text=data.get("feedback_text", ""),
            feedback_instruction=data.get("feedback_instruction", ""),
            level_instruction=level_instruction,
            corrections=self._normalize_string_list(data.get("corrections", [])),
            better_expressions=self._normalize_string_list(data.get("better_expressions", [])),
            energy_flow=data.get("energy_flow"),
            engine_trace=engine_trace,
        )

    def _build_fallback(
        self,
        planner_output: PlannerOutput,
        participants: Optional[list],
        level: int,
        level_instruction: str,
        trace_id: Optional[str],
        turn_id: Optional[str],
    ) -> ConductorOutput:
        """Build fallback output when LLM fails."""
        scripts = []
        
        if participants:
            from app.models.conversation import ParticipantType
            
            ai_participants = [
                p for p in sorted(participants, key=lambda x: x.order_index)
                if p.participant_type != ParticipantType.USER
            ]
            
            for p in ai_participants:
                ptype = p.participant_type.value if hasattr(p.participant_type, 'value') else str(p.participant_type)
                if ptype == "moderator":
                    scripts.append(ConductorScript(
                        speaker_name=p.name,
                        text=f"좋아요! 계속 연습해 볼게요.",
                        instruction="moderator_feedback",
                    ))
                else:
                    scripts.append(ConductorScript(
                        speaker_name=p.name,
                        text="",
                        instruction=f"Continue at level {level}",
                    ))

        return ConductorOutput(
            schema_version=SCHEMA_VERSION,
            trace_id=trace_id or "",
            turn_id=turn_id or "",
            scripts=scripts,
            return_to_user_after=False,
            user_emotion="neutral",
            feedback_text="계속 연습해 볼게요!",
            level_instruction=level_instruction,
            corrections=[],
            better_expressions=[],
        )
