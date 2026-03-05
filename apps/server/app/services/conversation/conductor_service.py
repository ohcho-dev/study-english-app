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
        genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
        # Use Admin-provided level definitions or fall back to hardcoded defaults
        if level_definitions:
            self.level_instructions = {
                item["level"]: item.get("instruction", f"Level {item['level']}")
                for item in level_definitions
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
    ) -> tuple[ConductorOutput, float]:
        """Generate moderator feedback and AI scripts."""
        t_start = time.time()

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
        )

        MAX_RETRIES = 3
        last_error = None
        result = None
        for attempt in range(MAX_RETRIES):
            try:
                model = genai.GenerativeModel(self.llm_model)
                response = await model.generate_content_async(
                    [
                        {"role": "user", "parts": [{"text": base_prompt + "\n\n" + user_msg}]},
                    ],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=2000,
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
    ) -> str:
        decision = planner_output.decision
        
        return f"""## Current State
- Path: {decision.path}
- Action: {decision.action_code}
- Reasons: {', '.join(decision.reason)}
- Level: {level}
- Level Instruction: {level_instruction}

## Participants
{participant_info}

## Scene Context
{scene_context or 'General conversation practice'}

## User ({user_name or 'Student'}) said:
"{user_transcript or '(no input)'}"

## Recent History
{history_text or '(session just started)'}

## Evaluator Diagnosis
{', '.join(decision.reason)}

Generate the moderator feedback in Korean and AI scripts in English at Level {level}.
Remember: return_to_user_after MUST be false."""

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
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.warning("[Conductor] Failed to parse JSON, using fallback")
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
            corrections=data.get("corrections", []),
            better_expressions=data.get("better_expressions", []),
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
                    # Moderator gets a simple feedback
                    scripts.append(ConductorScript(
                        speaker_name=p.name,
                        text=f"좋아요! 이번 라운드는 Level {level}입니다. {level_instruction}",
                        instruction="moderator_feedback",
                    ))
                else:
                    # AI gets level instruction
                    scripts.append(ConductorScript(
                        speaker_name=p.name,
                        text="",
                        instruction=f"Demonstrate A-B-C narrative at {level_instruction}",
                    ))

        return ConductorOutput(
            schema_version=SCHEMA_VERSION,
            trace_id=trace_id or "",
            turn_id=turn_id or "",
            scripts=scripts,
            return_to_user_after=False,
            user_emotion="neutral",
            feedback_text=f"이번 라운드는 Level {level}입니다.",
            level_instruction=level_instruction,
            corrections=[],
            better_expressions=[],
        )
