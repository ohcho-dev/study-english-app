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

    TASK_AND_OUTPUT_FORMAT = """
        # YOUR TASK
        Analyze the user's latest input carefully. Determine if the user responded appropriately.
        
        ## EVALUATION CRITERIA (apply in order):
        
        ### "Clarification_Needed" — User is asking for help OR providing ambiguous input
        The user is confused, asking for repetition, OR gave a minimal response that is unclear.
        Examples:
        - Questions: "Come again?", "What?", "Pardon?", "I don't understand"
        - Ambiguous fillers: "um", "um...", "Mmm...", "Hmm...", "Uh...", "Ah..." (without further speech)
        - When it's unclear if the user is thinking, agreeing, or disagreeing.
        → should_continue_script: false
        → instruction: Tell the next AI to gently encourage the user or re-ask the question more simply.
        
        ### "FAIL" — Gibberish, bad transcription, or off-topic
        The input is unintelligible or clearly a mistake.
        Red flags:
        - Random words ("vinyl Park", "table green")
        - Mistranscribed foreign language
        - Very short meaningless utterances that are NOT valid fillers (e.g. single random word like "Wall")
        → should_continue_script: false
        → instruction: Tell the next AI to gently re-ask or rephrase the question.
        
        ### "Simulate_Reaction" — User said something that warrants a brief reaction first
        The input makes sense but calls for a quick reaction (surprise, acknowledgment) before the main response.
        → should_continue_script: false
        → instruction: Give a brief reaction instruction.
        
        ### "PASS" — Good, relevant response in proper English
        ONLY use PASS when ALL of the following are true:
        - The input is coherent English.
        - The input is relevant to the current conversation.
        - The input ADVANCES the conversation (more than just "Mmm" or "Uh").
        
        CRITICAL: Do NOT mark "Mmm" or "Hmm" as PASS unless the user is clearly answering a question like "Is it tasty?". If the context is a general question like "How are you?" or "Introduction", "Mmm" is usually a hesitation -> Use Clarification_Needed.
        
        → should_continue_script: true
        → instruction: Direct the next AI on how to continue the conversation.
        
        ## IMPORTANT RULES
        - When in doubt, prefer Clarification_Needed or FAIL over PASS.
        - "Mmm", "Hmm", "Uh" alone are almost ALWAYS Clarification_Needed (Hesitation).
        - STT transcription errors are very common — be skeptical.
        
        ## OUTPUT FORMAT
        Respond with a JSON object:
        {
            "evaluation": "PASS" | "FAIL" | "Clarification_Needed" | "Simulate_Reaction",
            "instruction": "Specific instruction for the next AI speaker",
            "should_continue_script": true | false,
            "bridge_speaker": "(optional) Name of the AI who should handle non-PASS situations (e.g. help the user).",
            "user_emotion": "The user's emotional state inferred from their input and context. One of: happy, excited, nervous, confused, frustrated, neutral, shy",
            "next_speaker": "(optional) For PASS turns, name of which AI participant should speak next. Use this to direct conversation flow. If omitted, system uses round-robin."
        }
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
        
        {self.TASK_AND_OUTPUT_FORMAT}
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
