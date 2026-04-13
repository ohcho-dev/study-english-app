"""
Scenario Director Service.

This module implements the "Director AI" logic which orchestrates the conversation flow
based on a defined scenario script and real-time user input analysis.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

import google.generativeai as genai
from app.core.config import settings
from app.models.conversation import ConversationSession, ConversationTurn, ParticipantType

logger = logging.getLogger(__name__)


class DirectorOutput:
    """Structured output from the Director AI."""
    def __init__(self, 
                 evaluation: str, 
                 instruction: str, 
                 next_speaker_id: Optional[str] = None,
                 should_continue_script: bool = True,
                 bridge_speaker: Optional[str] = None,
                 user_emotion: Optional[str] = None,
                 next_speaker: Optional[str] = None):
        self.evaluation = evaluation  # "PASS", "FAIL", "NEEDS_CLARIFICATION", etc.
        self.instruction = instruction  # Instruction for the next speaker
        self.next_speaker_id = next_speaker_id  # ID of the participant to speak next
        self.should_continue_script = should_continue_script  # Whether to advance strictly to next step
        self.bridge_speaker = bridge_speaker  # Name of participant to handle non-PASS turns (optional, set via custom prompt)
        self.user_emotion = user_emotion  # Detected user emotion: "happy", "nervous", "confused", "neutral", etc.
        self.next_speaker = next_speaker  # Name of AI to speak next for PASS turns (overrides round-robin)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evaluation": self.evaluation,
            "instruction": self.instruction,
            "next_speaker_id": self.next_speaker_id,
            "should_continue_script": self.should_continue_script,
            "bridge_speaker": self.bridge_speaker,
            "user_emotion": self.user_emotion,
            "next_speaker": self.next_speaker,
        }


class ScenarioDirector:
    """
    The Director AI that supervises the conversation.
    It evaluates user input against the scenario goals and directs the actors (AI participants).
    """

    BASE_PROMPT = """
        You are the 'Scenario Director' of an English learning roleplay session.
        Your job is to specifically direct the AI actors on how to respond to the user.
        
        CORE RESPONSIBILITIES:
        1. **Ensure User Engagement**: The user is the protagonist. Do NOT let AI participants have long conversations with each other. After an AI speaks, the turn should generally pass to the User.
        2. **Manage Turn-Taking**: Decide who speaks next based on the conversation flow and the script.
        3. **Guide the AI**: Give specific instructions on tone, content, and difficulty level.
        """

    # NOTE: Task & Output Protocol was intentionally removed (see admin request).
    # Keep the attribute so existing APIs stay compatible, but expose it as an empty string.
    TASK_AND_OUTPUT_FORMAT = ""

    _OUTPUT_RESPONSE_SCHEMA = """
        Respond strictly with a JSON object containing:
        {
            "evaluation": "PASS" | "FAIL" | "Clarification_Needed" | "Simulate_Reaction",
            "instruction": "One short instruction for the next AI speaker",
            "should_continue_script": true | false,
            "bridge_speaker": "(optional) helper AI name for non-PASS turns",
            "user_emotion": "happy|excited|nervous|confused|frustrated|neutral|shy",
            "next_speaker": "(optional) AI name to speak next when evaluation is PASS"
        }
        Do not add analysis, explanations, or any extra fields.
        """

    def __init__(self, session: ConversationSession):
        self.session = session
        self.template = session.template
        
        # Determine LLM Model
        llm_model = "gemini-2.5-flash"
        
        # Priority 1: Template level Director model
        if hasattr(self.template, 'director_llm_model') and self.template.director_llm_model:
            llm_model = self.template.director_llm_model
            
        # Priority 2: Session Variant override
        if session.variant:
            try:
                import json
                variant_data = json.loads(session.variant)
                if "llm_model" in variant_data:
                     llm_model = variant_data.get("llm_model")
            except:
                pass

        # Configure GenAI
        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            self.model = genai.GenerativeModel(llm_model)
        else:
            self.model = None
            logger.warning("GOOGLE_AI_API_KEY not set for ScenarioDirector")

    async def evaluate_turn(self, 
                            user_input: str, 
                            history_text: str,
                            current_step_index: int,
                            response_delay_sec: Optional[float] = None) -> DirectorOutput:
        """
        Evaluates the user's latest turn against the current scenario step.
        """
        # 1. Heuristic Check: Force "Hesitation" for known fillers inputs
        try:
            import re
            input_cleaned = user_input.strip() if user_input else ""
            # Matches "Mmm", "Hmm", "Uh", "Ah", "Huh" with optional punctuation (.,?!-) and whitespace
            hesitation_pattern = re.compile(r"^(m+|h+m+|uh+|ah+|huh+)\s*[.,?!\-]*$", re.IGNORECASE)
            
            if hesitation_pattern.match(input_cleaned):
                logger.info(f"[ScenarioDirector] Heuristic: '{input_cleaned}' detected as hesitation -> Force Clarification_Needed")
                return DirectorOutput(
                    evaluation="Clarification_Needed",
                    instruction=(
                        "The user is hesitating (e.g. said 'Mmm' or 'Hmm'). "
                        "Do NOT answer normally. "
                        "Instead, gently ask if they are thinking, or encourage them to speak. "
                        "Keep it very brief."
                    ),
                    should_continue_script=False
                )
        except Exception as e:
            logger.error(f"[ScenarioDirector] Heuristic check failed: {e}")

        if not self.model:
            # Fallback if no API key
            return DirectorOutput(
                evaluation="PASS",
                instruction="Respond naturally.",
                should_continue_script=True
            )

        # 1. Gather Context
        participants_list = []
        if self.template and self.template.participants:
            for p in sorted(self.template.participants, key=lambda x: x.order_index):
                p_name = p.name
                if p.participant_type == ParticipantType.USER:
                    if self.session.user_name:
                         p_name = f"{self.session.user_name} (Role: {p.name})"
                
                participants_list.append(f"- {p_name} ({p.participant_type}): {p.persona}")
        
        participants_info = "\n".join(participants_list)
        
        script_info = "No specific script defined."
        if self.template.turn_sequence:
            try:
                # Assuming turn_sequence is a list of steps
                steps = self.template.turn_sequence
                if isinstance(steps, list):
                    script_info = json.dumps(steps, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.error(f"Error parsing script: {e}")

        # 2. Construct Prompt (God View)
        base_director_prompt = self.BASE_PROMPT
        
        custom_instructions = self.template.director_system_prompt or "No specific custom instructions."
        
        director_prompt = f"{base_director_prompt}\n\n# Custom Instructions (High Priority)\n{custom_instructions}"
        
        delay_value = f"{response_delay_sec:.2f}" if response_delay_sec is not None else "unknown"
        delay_note = (
            "Interpret long delays as user hesitation."
            if response_delay_sec is not None
            else "Response delay not measured this turn."
        )

        prompt = f"""
        {director_prompt}
        
        # Scene Context
        Topic: {self.template.topic or 'General Conversation'}
        Scene: {self.template.scene_context or 'No specific scene'}
        Goal: {self.template.system_prompt}
        
        # Cast (Participants)
        {participants_info}
        
        # Script (Turn Sequence)
        {script_info}
        
        # Current State
        User Name: {self.session.user_name}
        Current Turn Index: {self.session.current_turn_index}
        Target Scenario Step Index: {current_step_index}
        User Response Delay (record start → speech):
        "response_delay_sec": "{delay_value}"
        {delay_note}
        
        # Conversation History
        {history_text}
        
        # User's Latest Input
        "{user_input}"
        
        {self._OUTPUT_RESPONSE_SCHEMA}
        """
        
        try:
            response = await self.model.generate_content_async(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            result = json.loads(response.text)
            
            return DirectorOutput(
                evaluation=result.get("evaluation", "PASS"),
                instruction=result.get("instruction", "Respond naturally."),
                should_continue_script=result.get("should_continue_script", True),
                bridge_speaker=result.get("bridge_speaker", None),
                user_emotion=result.get("user_emotion", "neutral"),
                next_speaker=result.get("next_speaker", None),
            )
            
        except Exception as e:
            logger.error(f"Director AI Error: {e}")
            # Fallback: Assume pass
            return DirectorOutput(
                evaluation="PASS",
                instruction="Respond naturally to the user.",
                should_continue_script=True
            )
