"""Session observation service — generates learning behavior metrics.

Layer 1 (Rule-based): 세션 종료 시 자동 계산 및 저장.
Layer 2 (Pipeline 집계): Evaluator/Planner/Conductor 로그 집계.
Layer 3 (Reporting LLM): Phase 3에서 구현 예정.
"""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import (
    ConversationSession,
    ConversationTurn,
    SessionMetrics,
    SessionStatus,
    TurnType,
)
from app.models.pipeline_log import PipelineLog
from app.models.session_observation import SessionObservation

logger = logging.getLogger(__name__)


class ObservationService:
    """세션 관찰 데이터 생성 서비스.

    세션 종료 시: Layer 1 + Layer 2 자동 계산
    Admin 수동 트리거 시: Layer 3 결과 저장 (Phase 3)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ──────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────

    async def generate_observation(self, session_id: UUID) -> SessionObservation:
        """Layer 1 + Layer 2 관찰 데이터 생성. 이미 존재하면 덮어쓰기.

        Args:
            session_id: 관찰할 세션 ID.

        Returns:
            생성 또는 갱신된 SessionObservation 인스턴스.

        Raises:
            ValueError: 세션이 존재하지 않는 경우.
        """
        existing = await self._get_existing(session_id)
        observation = existing if existing else SessionObservation(session_id=session_id)

        session = await self._get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        turns = await self._get_turns(session_id)
        pipeline_logs = await self._get_pipeline_logs(session_id)
        metrics = await self._get_session_metrics(session_id)

        observation.account_id = session.account_id
        self._compute_layer1(observation, session, turns, metrics)
        self._compute_layer2(observation, pipeline_logs)

        if not existing:
            self.db.add(observation)

        await self.db.flush()
        logger.info(f"Observation generated for session {session_id}")
        return observation

    async def get_observation(self, session_id: UUID) -> Optional[SessionObservation]:
        """관찰 데이터 조회.

        Args:
            session_id: 조회할 세션 ID.

        Returns:
            SessionObservation 인스턴스 또는 None.
        """
        return await self._get_existing(session_id)

    async def update_layer3(
        self, session_id: UUID, layer3_data: dict,
    ) -> SessionObservation:
        """Layer 3 결과 업데이트. Phase 3에서 ReportingLLMService가 호출.

        Args:
            session_id: 업데이트할 세션 ID.
            layer3_data: Layer 3 필드명 → 값 매핑 dict.

        Returns:
            업데이트된 SessionObservation 인스턴스.

        Raises:
            ValueError: Layer 1+2가 아직 생성되지 않은 경우.
        """
        observation = await self._get_existing(session_id)
        if not observation:
            raise ValueError(
                f"Observation for session {session_id} not found. "
                "Generate Layer 1+2 first."
            )
        for key, value in layer3_data.items():
            if hasattr(observation, key):
                setattr(observation, key, value)
        await self.db.flush()
        return observation

    # ──────────────────────────────────────────────
    # Layer 1: Rule-based 메트릭
    # ──────────────────────────────────────────────

    def _compute_layer1(
        self,
        obs: SessionObservation,
        session: ConversationSession,
        turns: list[ConversationTurn],
        metrics: Optional[SessionMetrics],
    ) -> None:
        """Layer 1 메트릭 계산 — 템플릿에 무관한 범용 집계.

        Args:
            obs: 업데이트할 SessionObservation 인스턴스.
            session: 부모 ConversationSession.
            turns: 해당 세션의 모든 ConversationTurn 목록 (turn_index ASC).
            metrics: 세션 집계 메트릭 (없을 수 있음).
        """
        # 중복 turn_index 제거: 동일 index에 여러 턴이 있으면 마지막 것만 유지
        # (텍스트 재시도 시 부분 발화→완성 발화 순으로 쌓이는 경우)
        all_user = [t for t in turns if t.turn_type == TurnType.USER]
        seen_indices: dict[int, int] = {}  # turn_index → list position
        for i, t in enumerate(all_user):
            seen_indices[t.turn_index] = i
        user_turns = [all_user[i] for i in sorted(seen_indices.values())]

        ai_turns = [
            t for t in turns
            if t.turn_type in (TurnType.AI, TurnType.MODERATOR)
        ]

        obs.total_user_turns = len(user_turns)
        obs.total_ai_turns = len(ai_turns)

        # 세션 시간
        if session.started_at and session.ended_at:
            obs.session_duration_sec = round(
                (session.ended_at - session.started_at).total_seconds(), 1
            )

        # 완료 상태
        obs.completion_status = self._determine_completion_status(session)

        # ── 발화 길이 분석 ──
        # 빈 turn(침묵/타임아웃)도 0으로 포함 — 스펙: 각 사용자 턴 모두 반영
        word_counts = [
            self._word_count(t.content_text) if t.content_text else 0
            for t in user_turns
        ]
        obs.word_count_per_turn = word_counts

        if word_counts:
            obs.avg_user_utterance_length = round(
                sum(word_counts) / len(word_counts), 2
            )
            obs.max_user_utterance_length = max(word_counts)
            obs.min_user_utterance_length = min(word_counts)
            obs.utterance_length_trend = self._compute_trend(word_counts)

        # 짧은 답변: ≤3단어 (침묵=0도 포함)
        obs.short_reply_count = sum(1 for wc in word_counts if wc <= 3)

        # 짧은 답변 후 개선 횟수
        obs.followup_after_short_answer = self._count_followup_improvements(
            word_counts
        )

        # ── 응답 간격 계산 ──
        # 우선순위 1: t_first_speech - t_recording_start (정밀 — 유저가 말하기까지 걸린 시간)
        # 우선순위 2: 이전 user 턴 t3 → 현 user 턴 t0 (fallback — AI 응답 후 다음 제출까지)
        #   * t3는 user 턴에 기록됨 (= 해당 턴 후 AI 오디오 재생 시작 시점)
        intervals: list[float] = []

        # 이전 user 턴의 t3 맵 생성 (user 턴의 인덱스 순서대로)
        prev_user_t3: float | None = None
        user_turn_prev_t3: dict[int, float | None] = {}
        for t in user_turns:
            user_turn_prev_t3[t.turn_index] = prev_user_t3
            if t.t3_audio_play_start is not None:
                prev_user_t3 = t.t3_audio_play_start

        for t in user_turns:
            interval_sec: float | None = None

            # 방법 1: 정밀 타이밍 (t_first_speech - t_recording_start)
            if (
                t.t_first_speech is not None
                and t.t_recording_start is not None
                and t.t_first_speech >= t.t_recording_start
            ):
                interval_sec = (t.t_first_speech - t.t_recording_start) / 1000.0

            # 방법 2: fallback (이전 user 턴 t3 → 현재 user 턴 t0)
            elif t.t0_user_end is not None:
                prev_t3 = user_turn_prev_t3.get(t.turn_index)
                if prev_t3 is not None and t.t0_user_end > prev_t3:
                    interval_sec = (t.t0_user_end - prev_t3) / 1000.0

            if interval_sec is not None and interval_sec >= 0:
                intervals.append(round(interval_sec, 2))

        if intervals:
            obs.avg_user_response_interval_sec = round(
                sum(intervals) / len(intervals), 2
            )
            obs.long_gap_count = sum(1 for iv in intervals if iv > 5.0)

        # 첫 응답 시간 (첫 번째 user turn)
        if user_turns:
            first_ut = user_turns[0]
            first_interval: float | None = None

            # 정밀
            if (
                first_ut.t_first_speech is not None
                and first_ut.t_recording_start is not None
            ):
                first_interval = (
                    first_ut.t_first_speech - first_ut.t_recording_start
                ) / 1000.0

            # fallback: 세션 시작 시점 → 첫 user 턴 t0
            elif first_ut.t0_user_end is not None and session.started_at:
                import datetime as _dt
                session_start_ms = session.started_at.timestamp() * 1000
                if first_ut.t0_user_end > session_start_ms:
                    first_interval = (first_ut.t0_user_end - session_start_ms) / 1000.0

            if first_interval is not None and first_interval >= 0:
                obs.first_user_response_time_sec = round(first_interval, 2)

        # 침묵 타임아웃 (content_text가 비어있는 user turn)
        obs.silence_timeout_count = sum(
            1 for t in user_turns
            if not t.content_text or t.content_text.strip() == ""
        )

        # ── E2E 레이턴시 분석 ──
        e2e_threshold_ms = 5000.0
        long_count = 0
        measurable_count = 0
        for t in user_turns:
            if t.t0_user_end and t.t3_audio_play_start:
                measurable_count += 1
                if t.t3_audio_play_start - t.t0_user_end > e2e_threshold_ms:
                    long_count += 1

        obs.long_latency_turn_count = long_count
        # 분모: total_user_turns (스펙 §2.0) — 타임스탬프 없는 턴도 포함
        total_user = obs.total_user_turns or 0
        obs.long_latency_turn_ratio = (
            round(long_count / total_user, 3)
            if total_user > 0 else None
        )

    # ──────────────────────────────────────────────
    # Layer 2: Pipeline 집계 (Phase 2에서 구현)
    # ──────────────────────────────────────────────

    def _compute_layer2(
        self, obs: SessionObservation, pipeline_logs: list[PipelineLog],
    ) -> None:
        """Pipeline 로그에서 Layer 2 메트릭 집계.

        Evaluator: overall_score, primary_issue, fluency.words_per_minute 집계
        Planner: current_level 추이, decision.path(UP/DOWN) 카운트
        Conductor: corrections 총 횟수 집계
        template_specific_data: planner.custom_state 있으면 저장 (키 하드코딩 없음)

        Args:
            obs: 업데이트할 SessionObservation 인스턴스.
            pipeline_logs: 해당 세션의 PipelineLog 목록 (turn_index ASC).
        """
        if not pipeline_logs:
            return

        evaluator_logs = [
            log for log in pipeline_logs
            if log.module_name == "evaluator" and log.output_json
        ]
        planner_logs = [
            log for log in pipeline_logs
            if log.module_name == "planner" and log.output_json
        ]
        conductor_logs = [
            log for log in pipeline_logs
            if log.module_name == "conductor" and log.output_json
        ]

        # ── Evaluator 집계 ──
        overall_scores: list[float] = []
        primary_issues_counter: dict[str, int] = {}
        wpm_values: list[float] = []

        for log in evaluator_logs:
            out = log.output_json

            # aggregate.overall_score (0-100)
            score = self._safe_get_nested(out, "aggregate", "overall_score")
            if score is not None:
                try:
                    overall_scores.append(float(score))
                except (TypeError, ValueError):
                    pass

            # diagnosis.primary_issue — "NONE" / 빈값 제외, 내부 코드 정규화
            issue = self._safe_get_nested(out, "diagnosis", "primary_issue")
            if issue and str(issue).upper() not in ("NONE", ""):
                normalized = self._normalize_primary_issue(str(issue))
                primary_issues_counter[normalized] = (
                    primary_issues_counter.get(normalized, 0) + 1
                )

            # fluency.words_per_minute
            wpm = self._safe_get_nested(out, "fluency", "words_per_minute")
            if wpm is not None:
                try:
                    wpm_val = float(wpm)
                    if wpm_val > 0:
                        wpm_values.append(wpm_val)
                except (TypeError, ValueError):
                    pass

        if overall_scores:
            obs.avg_overall_score = round(
                sum(overall_scores) / len(overall_scores), 1
            )
            trend = self._compute_trend_float(overall_scores)
            # insufficient_data는 null로 저장 — 5턴 미만은 추세 판단 불가
            obs.score_trend = None if trend == "insufficient_data" else trend

        # 빈도 내림차순 TOP 3
        if primary_issues_counter:
            sorted_issues = sorted(
                primary_issues_counter.items(),
                key=lambda x: x[1],
                reverse=True,
            )
            obs.primary_issues = [issue for issue, _ in sorted_issues[:3]]

        if wpm_values:
            obs.fluency_wpm_trend = [round(v, 1) for v in wpm_values]

        # ── Planner 집계 ──
        levels: list[int] = []
        level_up = 0
        level_down = 0

        for log in planner_logs:
            out = log.output_json

            # persona_plan.current_level (1-10)
            level = self._safe_get_nested(out, "persona_plan", "current_level")
            if level is not None:
                try:
                    clamped = max(1, min(10, int(level)))  # 1~10 범위로 클램핑
                    levels.append(clamped)
                except (TypeError, ValueError):
                    pass

        # 실제 레벨 변화 기반으로 UP/DOWN 카운트 (path 이름이 아닌 실제 변화)
        for i in range(1, len(levels)):
            if levels[i] > levels[i - 1]:
                level_up += 1
            elif levels[i] < levels[i - 1]:
                level_down += 1

        if levels:
            obs.level_progression = levels
            obs.max_level_reached = max(levels)

        obs.level_up_count = level_up
        obs.level_down_count = level_down

        # ── Conductor 집계 ──
        total_corrections = 0

        for log in conductor_logs:
            out = log.output_json
            corrections = out.get("corrections", []) if isinstance(out, dict) else []
            if isinstance(corrections, list):
                total_corrections += len(corrections)

        obs.correction_count = total_corrections

        # ── template_specific_data ──
        # Planner의 custom_state 등 템플릿 고유 데이터가 있으면 저장.
        # 특정 템플릿 키를 하드코딩하지 않음.
        template_data = self._extract_template_specific_data(planner_logs)
        if template_data:
            obs.template_specific_data = template_data

        logger.debug(
            f"Layer 2 computed: evaluator={len(evaluator_logs)}, "
            f"planner={len(planner_logs)}, conductor={len(conductor_logs)}, "
            f"avg_score={obs.avg_overall_score}, max_level={obs.max_level_reached}"
        )

    # ──────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _normalize_primary_issue(issue: str) -> str:
        """템플릿 내부 primary_issue 코드를 범용 이슈명으로 정규화.

        EMF 등 특정 템플릿이 evaluator에서 내부 슬롯 이름(MISSING_SLOT_A 등)을
        그대로 반환할 경우 범용적인 코드로 변환하여 대시보드에 노출합니다.

        Args:
            issue: evaluator.diagnosis.primary_issue 원본 문자열.

        Returns:
            정규화된 이슈 코드 문자열.
        """
        upper = issue.upper()
        # EMF 슬롯 패턴: MISSING_SLOT_A/B/C → INCOMPLETE_EXPRESSION
        if upper.startswith("MISSING_SLOT"):
            return "INCOMPLETE_EXPRESSION"
        # 기타 MISSING_ 패턴 → MISSING_KEY_CONCEPT
        if upper.startswith("MISSING_"):
            return "MISSING_KEY_CONCEPT"
        return issue

    @staticmethod
    def _word_count(text: str) -> int:
        """영어 단어 수 (공백 split).

        Args:
            text: 원문 텍스트.

        Returns:
            공백 기준 단어 수.
        """
        if not text:
            return 0
        return len(text.strip().split())

    @staticmethod
    def _compute_trend(values: list[int], window: int = 3) -> str:
        """처음 N개 vs 마지막 N개 평균 비교 → improving/stable/declining.

        Args:
            values: 정수 값 목록.
            window: 비교할 샘플 수.

        Returns:
            'improving' | 'stable' | 'declining' | 'insufficient_data'
        """
        if len(values) < window * 2:
            return "insufficient_data"
        first_avg = sum(values[:window]) / window
        last_avg = sum(values[-window:]) / window
        if first_avg == 0:
            return "improving" if last_avg > 0 else "stable"
        change = (last_avg - first_avg) / first_avg
        if change > 0.2:
            return "improving"
        elif change < -0.2:
            return "declining"
        return "stable"

    @staticmethod
    def _compute_trend_float(values: list[float], window: int = 3) -> str:
        """부동소수점 배열의 추이 계산. _compute_trend의 float 버전.

        Args:
            values: 부동소수점 값 목록.
            window: 비교할 샘플 수.

        Returns:
            'improving' | 'stable' | 'declining' | 'insufficient_data'
        """
        if len(values) < window * 2:
            return "insufficient_data"
        first_avg = sum(values[:window]) / window
        last_avg = sum(values[-window:]) / window
        if first_avg == 0:
            return "improving" if last_avg > 0 else "stable"
        change = (last_avg - first_avg) / first_avg
        if change > 0.2:
            return "improving"
        elif change < -0.2:
            return "declining"
        return "stable"

    @staticmethod
    def _safe_get_nested(data: dict | None, *keys: str):
        """중첩 딕셔너리에서 안전하게 값을 추출.

        Examples:
            _safe_get_nested(output_json, "aggregate", "overall_score") → 85
            _safe_get_nested(None, "a") → None
            _safe_get_nested({}, "a", "b") → None

        Args:
            data: 최상위 딕셔너리 (None일 수 있음).
            *keys: 순서대로 탐색할 키.

        Returns:
            최종 값, 또는 경로 중 하나라도 없으면 None.
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

    @staticmethod
    def _extract_template_specific_data(
        planner_logs: list[PipelineLog],
    ) -> dict | None:
        """Planner 로그에서 템플릿 고유 데이터 추출.

        마지막 Planner 로그부터 역순으로 탐색하여 `custom_state` 키가 있는
        경우 해당 값을 반환. 특정 템플릿 키를 하드코딩하지 않음.

        Args:
            planner_logs: Planner PipelineLog 목록.

        Returns:
            custom_state dict 또는 None.
        """
        for log in reversed(planner_logs):
            if not isinstance(log.output_json, dict):
                continue
            custom_state = log.output_json.get("custom_state")
            if custom_state and isinstance(custom_state, dict):
                return custom_state
        return None

    @staticmethod
    def _count_followup_improvements(word_counts: list[int]) -> int:
        """짧은 답변(≤3) 직후 단어 수가 증가한 횟수.

        Args:
            word_counts: 사용자 턴별 단어 수 목록.

        Returns:
            개선 횟수.
        """
        count = 0
        for i in range(len(word_counts) - 1):
            if word_counts[i] <= 3 and word_counts[i + 1] > word_counts[i]:
                count += 1
        return count

    @staticmethod
    def _determine_completion_status(session: ConversationSession) -> str:
        """세션 종료 상태 → completion_status 문자열 변환.

        Args:
            session: ConversationSession 인스턴스.

        Returns:
            'completed' | 'timeout' | 'error' | 'user_exit'
        """
        status_val = (
            session.status.value
            if hasattr(session.status, "value")
            else str(session.status)
        )
        if status_val == "completed":
            if session.error_message and "timed out" in session.error_message.lower():
                return "timeout"
            return "completed"
        elif status_val == "error":
            return "error"
        return "user_exit"

    # ──────────────────────────────────────────────
    # DB Queries
    # ──────────────────────────────────────────────

    async def _get_existing(self, session_id: UUID) -> Optional[SessionObservation]:
        result = await self.db.execute(
            select(SessionObservation)
            .where(SessionObservation.session_id == session_id)
        )
        return result.scalar_one_or_none()

    async def _get_session(self, session_id: UUID) -> Optional[ConversationSession]:
        result = await self.db.execute(
            select(ConversationSession)
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

    async def _get_session_metrics(
        self, session_id: UUID,
    ) -> Optional[SessionMetrics]:
        result = await self.db.execute(
            select(SessionMetrics)
            .where(SessionMetrics.session_id == session_id)
        )
        return result.scalar_one_or_none()
