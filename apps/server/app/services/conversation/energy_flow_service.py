"""Energy Flow Service for EMF Reverse Learning.

Generates energy flow comparison tables for control verbs.
Called as a parallel API independent of the main pipeline,
providing fast visual feedback while the main pipeline processes.
"""

import json
import logging
import time
from typing import Optional

import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

ENERGY_FLOW_SYSTEM_PROMPT = """You are an EMF (English Mapping Framework) energy flow analyzer.

Given a Ryan utterance (broken Korean in English SVO order) and a student's English response,
generate an energy flow comparison table that helps Korean learners FEEL the directional energy of English control verbs.

Rules:
1. Identify the primary control verb used (HAVE, GET, MAKE, KEEP, TAKE, PUT, GIVE).
2. Describe the core energy direction of that verb in Korean (1 sentence).
3. Generate 2-3 comparison rows showing the SAME situation expressed with DIFFERENT control verbs,
   highlighting how the energy direction changes with each verb.
4. Each row must show: Korean situation, English expression (with verb CAPITALIZED), energy direction.
5. One row should match what the student actually said. Other rows show alternative energy directions.
6. Keep all Korean text natural and adult-level.

Return JSON:
{
  "verb": "HAVE",
  "core_energy": "내 영역 안에 품고 소유하는 힘",
  "comparisons": [
    {"korean": "압박이 있어", "english": "I HAVE pressure", "direction": "안으로 품음"},
    {"korean": "압박을 줘", "english": "I PUT pressure on him", "direction": "밖으로 놓음"},
    {"korean": "압박을 받아", "english": "I GET pressure from him", "direction": "안으로 받아들임"}
  ]
}"""


class EnergyFlowService:
    """Generates energy flow comparison tables for control verbs."""

    def __init__(self, llm_model: str = "gemini-2.0-flash") -> None:
        self.llm_model = llm_model
        genai.configure(api_key=settings.GOOGLE_AI_API_KEY)

    async def generate(
        self,
        ryan_utterance: str,
        student_response: str,
        control_verb: str = "",
        level: int = 1,
    ) -> tuple[dict | None, float]:
        """Generate energy flow comparison table.

        Args:
            ryan_utterance: Ryan's broken Korean utterance.
            student_response: Student's English response.
            control_verb: The control verb used (optional, will be inferred).
            level: Current difficulty level.

        Returns:
            Tuple of (energy_flow_dict, duration_ms).
        """
        t_start = time.time()

        user_msg = f"""Ryan said (EMF Shift Korean): "{ryan_utterance}"
Student said (English): "{student_response}"
Control verb hint: {control_verb or "infer from context"}
Level: {level}

Generate the energy flow comparison table."""

        try:
            model = genai.GenerativeModel(self.llm_model)
            response = await model.generate_content_async(
                [
                    {"role": "user", "parts": [{"text": ENERGY_FLOW_SYSTEM_PROMPT + "\n\n" + user_msg}]},
                ],
                generation_config=genai.types.GenerationConfig(
                    temperature=0.5,
                    max_output_tokens=1000,
                    response_mime_type="application/json",
                ),
            )

            result = json.loads(response.text)
            duration_ms = (time.time() - t_start) * 1000

            logger.info(
                f"[EnergyFlow] verb={result.get('verb', '?')}, "
                f"comparisons={len(result.get('comparisons', []))}, "
                f"duration={duration_ms:.0f}ms"
            )

            return result, duration_ms

        except Exception as e:
            duration_ms = (time.time() - t_start) * 1000
            logger.error(f"[EnergyFlow] Failed: {e}, duration={duration_ms:.0f}ms")
            return None, duration_ms
