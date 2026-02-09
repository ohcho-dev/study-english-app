"""
Turn Orchestrator Service.

This module manages the state machine for the "My Turn" conversation system.
It determines the current turn, the next speaker, and handles state transitions.
"""

import logging
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID

from app.models.conversation import (
    ConversationParticipant,
    ConversationSession,
    ConversationTemplate,
    FirstSpeaker,
    ParticipantType,
    SessionStatus,
)

logger = logging.getLogger(__name__)


class TurnState(str, Enum):
    INIT = "init"
    MODERATOR_TURN = "moderator_turn"
    AI_TURN = "ai_turn"
    USER_TURN = "user_turn"
    COMPLETED = "completed"


class TurnOrchestrator:
    """Manages turn state and transitions."""

    def __init__(self, session: ConversationSession, template: ConversationTemplate):
        self.session = session
        self.template = template
        self.participants = sorted(template.participants, key=lambda p: p.order_index)

    async def determine_next_turn(self, current_turn_index: int, script_index: Optional[int] = None) -> dict:
        """Determines the next turn's speaker and type.
        
        Priority:
        1. Template.turn_sequence (Scripted Mode) - used if script_index provided
        2. Round-Robin based on order_index (Default Mode)
        
        Args:
            current_turn_index: The index of the turn that just completed.
            script_index: The current step index in the scenario script (if applicable).
            
        Returns:
            Dict containing speaker info or None if session ended.
        """
        ordered_participants = sorted(self.template.participants, key=lambda p: p.order_index)
        participant_names = [f"{p.name}({p.participant_type.value})" for p in ordered_participants]
        
        logger.info(
            f"[TurnOrchestrator] determine_next_turn called: "
            f"current_turn_index={current_turn_index}, script_index={script_index}, "
            f"participants={participant_names}"
        )
        
        # 1. Scripted Mode (if turn_sequence exists AND script_index is tracked)
        if self.template.turn_sequence and script_index is not None:
            try:
                sequence = self.template.turn_sequence
                if isinstance(sequence, list) and len(sequence) > 0:
                    if 0 <= script_index < len(sequence):
                        step = sequence[script_index]
                        logger.info(f"[TurnOrchestrator] Script mode: step[{script_index}] = {step}")
                        
                        # Find participant for this step
                        next_participant = None
                        
                        # Case A: By ID
                        if "participant_id" in step and step["participant_id"]:
                            p_id = str(step["participant_id"])
                            next_participant = next((p for p in self.template.participants if str(p.id) == p_id), None)
                            if next_participant:
                                logger.info(f"[TurnOrchestrator] Script: found by participant_id → {next_participant.name}")
                        
                        # Case B: By Type
                        if not next_participant and "speaker_type" in step:
                            s_type = step["speaker_type"]
                            if s_type == "user":
                                next_participant = next((p for p in self.template.participants if p.participant_type == ParticipantType.USER), None)
                            else:
                                next_participant = next((p for p in self.template.participants if p.participant_type == s_type), None)
                            if next_participant:
                                logger.info(f"[TurnOrchestrator] Script: found by speaker_type '{s_type}' → {next_participant.name}")
                        
                        # Case C: By speaker_index (Admin UI uses this)
                        if not next_participant and "speaker_index" in step:
                            s_idx = step["speaker_index"]
                            if isinstance(s_idx, int) and 0 <= s_idx < len(ordered_participants):
                                next_participant = ordered_participants[s_idx]
                                logger.info(f"[TurnOrchestrator] Script: found by speaker_index {s_idx} → {next_participant.name}")
                            else:
                                logger.warning(f"[TurnOrchestrator] Script: invalid speaker_index {s_idx} (participants: {len(ordered_participants)})")
                        
                        if next_participant:
                            result = {
                                "next_participant": next_participant,
                                "turn_type": next_participant.participant_type,
                                "is_user_turn": next_participant.participant_type == ParticipantType.USER,
                                "instruction": step.get("instruction", ""),
                                "script_index": script_index 
                            }
                            logger.info(
                                f"[TurnOrchestrator] Script mode result: {next_participant.name} "
                                f"(is_user_turn={result['is_user_turn']})"
                            )
                            return result
                        else:
                            logger.warning(
                                f"[TurnOrchestrator] Script step {script_index} could not resolve participant: {step}. "
                                f"Falling through to round-robin."
                            )
                    else:
                        # End of script
                        logger.info(f"[TurnOrchestrator] Script ended: script_index={script_index} >= len={len(sequence)}")
                        return None
            except Exception as e:
                logger.error(f"[TurnOrchestrator] Error processing turn sequence: {e}", exc_info=True)

        # 2. Default Round-Robin logic (Fallback)
        if not ordered_participants:
            logger.warning("[TurnOrchestrator] No participants found for round-robin")
            return None

        next_index = (current_turn_index + 1) % len(ordered_participants)
        next_participant = ordered_participants[next_index]
        
        result = {
            "next_participant": next_participant,
            "turn_type": next_participant.participant_type,
            "is_user_turn": next_participant.participant_type == ParticipantType.USER,
        }
        
        logger.info(
            f"[TurnOrchestrator] Round-robin: index ({current_turn_index}+1)%{len(ordered_participants)}={next_index} "
            f"→ {next_participant.name} ({next_participant.participant_type.value}, "
            f"order_index={next_participant.order_index}, is_user_turn={result['is_user_turn']})"
        )
        
        return result
 
