"""Experiment service - Execute experiments and manage logs."""

import time
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_lab_experiment import (
    AILabExperimentLog,
    AILabExperimentLogStep,
    DataTransferMode,
)
from app.models.ai_lab_pipeline import Pipeline
from app.schemas.ai_lab import (
    AttachedFile,
    ExperimentLogDetail,
    ExperimentLogStepResponse,
    ExperimentLogSummary,
    ExperimentRunRequest,
    ExperimentRunResponse,
    StepResult,
)
from app.services.ai_lab.chain_builder import ChainBuilder, prepare_next_input
from app.services.ai_lab.model_registry import calculate_cost, calculate_tts_cost
from app.services.ai_lab.tts_service import generate_speech_from_text


class ExperimentService:
    """Service for running AI Lab experiments and managing logs.
    
    Handles experiment execution, logging, and log retrieval.
    
    Args:
        db: AsyncSession for database operations.
    """
    
    def __init__(self, db: AsyncSession) -> None:
        """Initialize the experiment service.
        
        Args:
            db: Database session.
        """
        self.db = db
    
    async def run_experiment(
        self,
        request: ExperimentRunRequest,
    ) -> ExperimentRunResponse:
        """Run an experiment with the specified pipeline and configuration.
        
        Args:
            request: Experiment run request.
            
        Returns:
            Experiment run response with results.
            
        Raises:
            ValueError: If pipeline not found.
        """
        # Load pipeline with agents
        pipeline = await self._get_pipeline(request.pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline not found: {request.pipeline_id}")
        
        # Build chain
        chain_builder = ChainBuilder(request.model_name)
        
        # Execute agents sequentially
        start_time = time.time()
        steps: list[StepResult] = []
        step_details: list[dict] = []
        
        total_input_tokens = 0
        total_output_tokens = 0
        
        current_input = request.user_input
        attached_files_dict = (
            [f.model_dump() for f in request.attached_files]
            if request.attached_files
            else None
        )
        
        for idx, agent in enumerate(
            sorted(pipeline.agents, key=lambda a: a.order_index)
        ):
            step_start = time.time()
            
            # Determine model for this agent (override or default)
            agent_model = request.model_name  # Default
            if request.agent_models:
                for override in request.agent_models:
                    if override.agent_id == agent.id:
                        agent_model = override.model_name
                        break
            
            # Build chain with the determined model
            chain_builder = ChainBuilder(agent_model)
            
            # Invoke agent
            output, input_tokens, output_tokens = await chain_builder.invoke_agent(
                system_prompt=pipeline.system_prompt,
                agent_prompt=agent.prompt,
                user_input=current_input,
                attached_files=attached_files_dict if idx == 0 else None,
            )
            
            step_time_ms = int((time.time() - step_start) * 1000)
            
            # Record step result
            step_result = StepResult(
                step_index=idx,
                agent_role=agent.role_name,
                output=output,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                execution_time_ms=step_time_ms,
            )
            steps.append(step_result)
            
            # Store details for logging (including model_name)
            step_details.append({
                "step_index": idx,
                "agent_role": agent.role_name,
                "agent_prompt": agent.prompt,
                "model_name": agent_model,
                "input_data": current_input,
                "output_data": output,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "execution_time_ms": step_time_ms,
            })
            
            # Accumulate tokens
            total_input_tokens += input_tokens
            total_output_tokens += output_tokens
            
            # Prepare input for next agent
            history = [
                {"agent_role": s.agent_role, "output": s.output}
                for s in steps
            ]
            current_input = prepare_next_input(
                data_transfer_mode=request.data_transfer_mode,
                original_input=request.user_input,
                prev_output=output,
                history=history,
                include_original_input=request.include_original_input,
            )
        
        total_time_ms = int((time.time() - start_time) * 1000)
        
        # Calculate cost for agents
        estimated_cost = calculate_cost(
            request.model_name,
            total_input_tokens,
            total_output_tokens,
        )
        
        # Generate TTS audio if requested (before saving log)
        audio_url = None
        audio_base64 = None
        
        if request.generate_audio and steps:
            try:
                tts_start = time.time()
                tts_text = steps[-1].output
                tts_model = request.tts_model or "gemini-2.5-flash-preview-tts"
                
                tts_result = await generate_speech_from_text(
                    text=tts_text,
                    voice_name=request.tts_voice or "Kore",
                    model_name=tts_model,
                )
                audio_url = tts_result.get("audio_url")
                audio_base64 = tts_result.get("audio_base64")
                
                tts_time_ms = int((time.time() - tts_start) * 1000)
                
                # Calculate TTS cost
                char_count = len(tts_text)
                tts_cost = calculate_tts_cost(tts_model, char_count)
                estimated_cost += tts_cost
                
                # Add TTS generation as a virtual step log
                tts_step_index = len(steps)
                step_details.append({
                    "step_index": tts_step_index,
                    "agent_role": "TTS Generator",
                    "agent_prompt": f"Text-to-Speech Generation\nModel: {tts_model}\nVoice: {request.tts_voice or 'Kore'}\nChars: {char_count}",
                    "model_name": tts_model,
                    "input_data": tts_text,
                    "output_data": f"[Audio Generated] URL: {audio_url}\nCost: ${tts_cost:.6f}",
                    "input_tokens": 0,  # TTS uses characters, not tokens
                    "output_tokens": 0,
                    "execution_time_ms": tts_time_ms,
                })
                
            except Exception as e:
                # Log TTS error but don't fail the experiment
                import logging
                logging.error(f"TTS generation failed: {e}")
                
                # Add failed TTS step
                step_details.append({
                    "step_index": len(steps),
                    "agent_role": "TTS Generator",
                    "agent_prompt": f"Text-to-Speech Generation (Failed)",
                    "model_name": request.tts_model or "gemini-2.5-flash-preview-tts",
                    "input_data": steps[-1].output,
                    "output_data": f"Error: {str(e)}",
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "execution_time_ms": 0,
                })
        
        # Save log with all fields
        log = await self._save_log(
            pipeline_id=request.pipeline_id,
            model_name=request.model_name,
            data_transfer_mode=request.data_transfer_mode,
            include_original_input=request.include_original_input,
            user_input=request.user_input,
            attached_files=attached_files_dict,
            final_result=steps[-1].output if steps else "",
            generate_audio=request.generate_audio,
            audio_url=audio_url,
            audio_base64=audio_base64,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            estimated_cost_usd=estimated_cost,
            execution_time_ms=total_time_ms,
            step_details=step_details,
        )
        
        return ExperimentRunResponse(
            log_id=log.id,
            steps=steps,
            final_result=steps[-1].output if steps else "",
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            estimated_cost_usd=estimated_cost,
            execution_time_ms=total_time_ms,
            audio_url=audio_url,
            audio_base64=audio_base64,
        )
    
    async def _get_pipeline(self, pipeline_id: UUID) -> Pipeline | None:
        """Get pipeline with agents.
        
        Args:
            pipeline_id: Pipeline UUID.
            
        Returns:
            Pipeline if found.
        """
        query = (
            select(Pipeline)
            .options(selectinload(Pipeline.agents))
            .where(Pipeline.id == pipeline_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def _save_log(
        self,
        pipeline_id: UUID,
        model_name: str,
        data_transfer_mode: str,
        include_original_input: bool,
        user_input: str,
        attached_files: list[dict] | None,
        final_result: str,
        generate_audio: bool,
        audio_url: str | None,
        audio_base64: str | None,
        total_input_tokens: int,
        total_output_tokens: int,
        estimated_cost_usd: float,
        execution_time_ms: int,
        step_details: list[dict],
    ) -> AILabExperimentLog:
        """Save experiment log to database.
        
        Args:
            Various experiment details.
            
        Returns:
            Created log entry.
        """
        log = AILabExperimentLog(
            pipeline_id=pipeline_id,
            model_name=model_name,
            data_transfer_mode=DataTransferMode(data_transfer_mode),
            include_original_input=include_original_input,
            user_input=user_input,
            attached_files=attached_files,
            final_result=final_result,
            generate_audio=generate_audio,
            audio_url=audio_url,
            audio_base64=audio_base64,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            estimated_cost_usd=Decimal(str(estimated_cost_usd)),
            execution_time_ms=execution_time_ms,
        )
        self.db.add(log)
        await self.db.flush()
        
        # Save step details
        for step in step_details:
            log_step = AILabExperimentLogStep(
                experiment_log_id=log.id,
                step_index=step["step_index"],
                agent_role=step["agent_role"],
                agent_prompt=step["agent_prompt"],
                model_name=step.get("model_name"),
                input_data=step["input_data"],
                output_data=step["output_data"],
                input_tokens=step["input_tokens"],
                output_tokens=step["output_tokens"],
                execution_time_ms=step["execution_time_ms"],
            )
            self.db.add(log_step)
        
        await self.db.commit()
        await self.db.refresh(log)
        return log
    
    async def get_logs(
        self,
        page: int = 1,
        size: int = 20,
        pipeline_id: UUID | None = None,
    ) -> tuple[list[ExperimentLogSummary], int]:
        """Get experiment logs with pagination.
        
        Args:
            page: Page number (1-indexed).
            size: Items per page.
            pipeline_id: Optional filter by pipeline.
            
        Returns:
            Tuple of (logs, total_count).
        """
        # Base query
        query = (
            select(AILabExperimentLog)
            .options(selectinload(AILabExperimentLog.pipeline))
            .order_by(AILabExperimentLog.created_at.desc())
        )
        
        if pipeline_id:
            query = query.where(AILabExperimentLog.pipeline_id == pipeline_id)
        
        # Get total count
        from sqlalchemy import func
        count_query = select(func.count(AILabExperimentLog.id))
        if pipeline_id:
            count_query = count_query.where(
                AILabExperimentLog.pipeline_id == pipeline_id
            )
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        result = await self.db.execute(query)
        logs = result.scalars().all()
        
        return [
            ExperimentLogSummary(
                id=log.id,
                pipeline_id=log.pipeline_id,
                pipeline_name=log.pipeline.name if log.pipeline else None,
                model_name=log.model_name,
                data_transfer_mode=log.data_transfer_mode.value,
                include_original_input=log.include_original_input,
                generate_audio=log.generate_audio,
                total_tokens=log.total_input_tokens + log.total_output_tokens,
                total_input_tokens=log.total_input_tokens,
                total_output_tokens=log.total_output_tokens,
                estimated_cost_usd=float(log.estimated_cost_usd),
                execution_time_ms=log.execution_time_ms,
                created_at=log.created_at,
            )
            for log in logs
        ], total
    
    async def get_log_detail(self, log_id: UUID) -> ExperimentLogDetail | None:
        """Get detailed experiment log.
        
        Args:
            log_id: Log UUID.
            
        Returns:
            Log detail if found.
        """
        query = (
            select(AILabExperimentLog)
            .options(
                selectinload(AILabExperimentLog.pipeline),
                selectinload(AILabExperimentLog.steps),
            )
            .where(AILabExperimentLog.id == log_id)
        )
        
        result = await self.db.execute(query)
        log = result.scalar_one_or_none()
        
        if not log:
            return None
        
        return ExperimentLogDetail(
            id=log.id,
            pipeline_id=log.pipeline_id,
            pipeline_name=log.pipeline.name if log.pipeline else None,
            model_name=log.model_name,
            data_transfer_mode=log.data_transfer_mode.value,
            include_original_input=log.include_original_input,
            user_input=log.user_input,
            attached_files=(
                [AttachedFile(**f) for f in log.attached_files]
                if log.attached_files
                else None
            ),
            final_result=log.final_result,
            generate_audio=log.generate_audio,
            audio_url=log.audio_url,
            audio_base64=log.audio_base64,
            total_input_tokens=log.total_input_tokens,
            total_output_tokens=log.total_output_tokens,
            estimated_cost_usd=float(log.estimated_cost_usd),
            execution_time_ms=log.execution_time_ms,
            steps=[
                ExperimentLogStepResponse(
                    id=step.id,
                    step_index=step.step_index,
                    agent_role=step.agent_role,
                    agent_prompt=step.agent_prompt,
                    model_name=step.model_name,
                    input_data=step.input_data,
                    output_data=step.output_data,
                    input_tokens=step.input_tokens,
                    output_tokens=step.output_tokens,
                    execution_time_ms=step.execution_time_ms,
                    created_at=step.created_at,
                )
                for step in sorted(log.steps, key=lambda s: s.step_index)
            ],
            created_at=log.created_at,
        )
