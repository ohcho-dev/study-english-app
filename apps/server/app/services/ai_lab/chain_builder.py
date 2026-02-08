import base64
import httpx
import mimetypes
from pathlib import Path
from typing import Any

from google import genai
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings


class ChainBuilder:
    """Build and configure LangChain chains for AI Lab experiments.
    
    Handles model instantiation and chain construction based on
    pipeline configuration.
    
    Args:
        model_name: Name of the AI model to use.
    """
    
    def __init__(self, model_name: str) -> None:
        """Initialize the chain builder with a specific model.
        
        Args:
            model_name: Model identifier (e.g., gemini-pro, gpt-4o).
        """
        self.model_name = model_name
        self.model = self._get_model(model_name)
        # Initialize GenAI client for token counting fallback
        try:
            self.client = genai.Client(api_key=settings.GOOGLE_AI_API_KEY)
        except Exception:
            self.client = None
    
    def _get_model(self, model_name: str) -> Any:
        """Get the appropriate LLM instance based on model name.
        
        Args:
            model_name: Model identifier.
            
        Returns:
            LLM instance.
            
        Raises:
            ValueError: If model is not supported.
        """
        if model_name.startswith("gemini"):
            return ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=settings.GOOGLE_AI_API_KEY,
                temperature=0,
                convert_system_message_to_human=True,
            )
        elif model_name.startswith("gpt"):
            # OpenAI support - to be implemented
            raise ValueError(
                f"OpenAI models are not yet supported. Model: {model_name}"
            )
        else:
            raise ValueError(f"Unknown model: {model_name}")
    
    async def invoke_agent(
        self,
        system_prompt: str,
        agent_prompt: str,
        user_input: str,
        attached_files: list[dict] | None = None,
    ) -> tuple[str, int, int]:
        """Invoke a single agent with the given prompts and input.
        
        Args:
            system_prompt: Shared system prompt for all agents.
            agent_prompt: Individual agent prompt.
            user_input: User input or previous agent output.
            attached_files: Optional attached files info.
            
        Returns:
            Tuple of (output_text, input_tokens, output_tokens).
        """
        # Build multimodal content if files are attached
        human_content = await self._build_multimodal_content(user_input, attached_files)
        
        # Debug: log what's being sent
        if attached_files:
            import logging
            logging.warning(f"[DEBUG] Attached files: {attached_files}")
            if isinstance(human_content, list):
                content_summary = [
                    {k: v[:50] + "..." if isinstance(v, str) and len(v) > 50 else v 
                     for k, v in part.items()} 
                    for part in human_content
                ]
                logging.warning(f"[DEBUG] Multimodal content types: {[p.get('type') for p in human_content]}")
        
        messages = [
            SystemMessage(content=f"{system_prompt}\n\n{agent_prompt}"),
            HumanMessage(content=human_content),
        ]
        
        model_to_use = self.model

        try:
            response = await model_to_use.ainvoke(messages)
        except Exception as e:
            import logging
            logging.error(f"[DEBUG] LangChain invoke error: {e}")
            raise
        
        # Extract token usage from response metadata (handle various Gemini versions)
        input_tokens = 0
        output_tokens = 0
        
        # Try usage_metadata first (LangChain standard)
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = response.usage_metadata
            if isinstance(usage, dict):
                input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or usage.get("prompt_token_count") or 0
                output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or usage.get("candidates_token_count") or 0
            else:
                # Object-style access - check multiple possible attribute names
                input_tokens = (
                    getattr(usage, "input_tokens", None) or 
                    getattr(usage, "prompt_tokens", None) or 
                    getattr(usage, "prompt_token_count", None) or 0
                )
                output_tokens = (
                    getattr(usage, "output_tokens", None) or 
                    getattr(usage, "completion_tokens", None) or 
                    getattr(usage, "candidates_token_count", None) or 0
                )
        
        # Fallback to response_metadata
        if input_tokens == 0 and hasattr(response, "response_metadata"):
            meta = response.response_metadata
            # OpenAI style
            if "usage" in meta:
                usage = meta["usage"]
                input_tokens = usage.get("prompt_tokens") or usage.get("input_tokens") or 0
                output_tokens = usage.get("completion_tokens") or usage.get("output_tokens") or 0
            # Gemini style - check for token_count
            if input_tokens == 0 and "token_count" in meta:
                input_tokens = meta["token_count"].get("input_tokens") or meta["token_count"].get("prompt_token_count") or 0
                output_tokens = meta["token_count"].get("output_tokens") or meta["token_count"].get("candidates_token_count") or 0
            # Gemini 3 style - check for usage_metadata in response_metadata
            if input_tokens == 0 and "usage_metadata" in meta:
                usage = meta["usage_metadata"]
                input_tokens = usage.get("prompt_token_count") or usage.get("input_tokens") or 0
                output_tokens = usage.get("candidates_token_count") or usage.get("output_tokens") or 0
                
        # Final Fallback: Calculate manually using GenAI SDK if available and counts are still 0
        if (input_tokens == 0 or output_tokens == 0) and self.client and self.model_name.startswith("gemini"):
            try:
                # Map preview model names to stable names for token counting
                token_count_model = self.model_name
                if "preview" in self.model_name:
                    # gemini-3-flash-preview -> gemini-2.0-flash (fallback for counting)
                    if "flash" in self.model_name:
                        token_count_model = "gemini-2.0-flash"
                    elif "pro" in self.model_name:
                        token_count_model = "gemini-2.5-pro"
                
                # Calculate input tokens
                if input_tokens == 0:
                    full_prompt = f"{system_prompt}\n\n{agent_prompt}\n\n{user_input}"
                    count_resp = self.client.models.count_tokens(
                        model=token_count_model,
                        contents=full_prompt
                    )
                    input_tokens = count_resp.total_tokens
                
                # Calculate output tokens
                if output_tokens == 0 and response.content:
                    count_resp_out = self.client.models.count_tokens(
                        model=token_count_model,
                        contents=response.content
                    )
                    output_tokens = count_resp_out.total_tokens
            except Exception as e:
                import logging
                logging.warning(f"Token counting via SDK failed for {self.model_name}: {e}")
                # Last resort estimation (char count / 4)
                if input_tokens == 0:
                    input_tokens = len(f"{system_prompt}\n\n{agent_prompt}\n\n{user_input}") // 4
                if output_tokens == 0:
                    output_tokens = len(str(response.content)) // 4
        
        return response.content, input_tokens, output_tokens
    
    async def _build_multimodal_content(
        self,
        user_input: str,
        attached_files: list[dict] | None = None,
    ) -> list[dict] | str:
        """Build multimodal content for Gemini API.
        
        Args:
            user_input: User's text input.
            attached_files: Optional attached files info.
            
        Returns:
            List of content parts for multimodal, or string for text-only.
        """
        if not attached_files:
            return user_input
        
        content_parts: list[dict] = []
        
        # Add text part
        content_parts.append({"type": "text", "text": user_input})
        
        # Add file parts
        for file in attached_files:
            file_type = file.get("type", "unknown")
            file_url = file.get("url", "")
            
            if not file_url:
                continue
            
            try:
                # Determine MIME type
                mime_type = self._get_mime_type(file_type, file_url)
                
                # Load file data
                file_data = await self._load_file_data(file_url)
                
                if file_data:
                    # Handle different file types appropriately
                    if file_type == "image":
                        # Images use image_url format
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{file_data}"
                            }
                        })
                    elif file_type in ("audio", "video"):
                        # Audio and video: Use raw Gemini Part format (bypass LangChain validation via 'inline_data')
                        # We reverted File API because local library versions didn't support 'file_data' in dicts
                        # and File API auto-detected 'video/webm' which caused 400 errors.
                        # We MUST force 'audio/webm' for .webm files to work with Gemini 2.0 Flash Audio Understanding.
                        content_parts.append({
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": file_data
                            }
                        })
                    else:
                        # Fallback to image_url format
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{file_data}"
                            }
                        })
            except Exception as e:
                # If file loading fails, add as text reference
                file_name = file.get("name", "unknown")
                content_parts.append({
                    "type": "text",
                    "text": f"[Attached {file_type}: {file_name}] (Failed to load: {str(e)})"
                })
        
        return content_parts
    
    def _get_mime_type(self, file_type: str, file_url: str) -> str:
        """Get MIME type from file type and URL."""
        mime_map = {
            "image": "image/jpeg",
            "video": "video/mp4",
            "audio": "audio/mpeg",
        }
        
        # Try to get from URL extension
        ext = Path(file_url).suffix.lower()
        if ext == ".webm":
            return "audio/webm"  # Force audio/webm for Gemini 2.0 Flash Audio Understanding
        
        mime_type, _ = mimetypes.guess_type(file_url)
        return mime_type or "application/octet-stream"
    
    def _convert_to_mp3(self, file_url: str) -> tuple[str, str]:
        """Convert webm to mp3 using ffmpeg if possible.
        
        Returns:
            (file_path, mime_type)
        """
        import os
        import subprocess
        
        # Resolve absolute path
        if file_url.startswith("/uploads/"):
             base_path = os.getcwd() 
             rel_path = file_url.lstrip("/")
             input_path = os.path.join(base_path, rel_path)
        else:
            input_path = file_url
            
        if not os.path.exists(input_path):
            return input_path, "audio/webm"
            
        # Only convert .webm
        if not input_path.lower().endswith(".webm"):
             # Return original path/mime (resolve absolute path anyway for loading)
             mime, _ = mimetypes.guess_type(input_path)
             return input_path, mime or "application/octet-stream"
             
        output_path = input_path.rsplit(".", 1)[0] + ".mp3"
        
        # Check if already converted
        if os.path.exists(output_path):
            return output_path, "audio/mp3"
            
        try:
            # ffmpeg -i input.webm -vn -acodec libmp3lame -y output.mp3
            subprocess.run(
                ["ffmpeg", "-i", input_path, "-vn", "-acodec", "libmp3lame", "-y", output_path],
                check=True,
                stdout=subprocess.DEVNULL, 
                stderr=subprocess.DEVNULL
            )
            return output_path, "audio/mp3"
        except FileNotFoundError:
            import logging
            logging.error("[DEBUG] FFMPEG not found. Skipping conversion.")
            return input_path, "audio/webm"
        except Exception as e:
            import logging
            logging.error(f"[DEBUG] Audio conversion failed: {e}")
            return input_path, "audio/webm"

    async def _load_file_data(self, file_url: str) -> str | None:
        """Load file data and return as base64."""
        import logging
        
        # Handle local files (both /static/ and /uploads/ paths)
        if file_url.startswith(("/static/", "static/", "/uploads/", "uploads/")):
            # Construct local path - go up to the server app root
            local_path = Path(__file__).parent.parent.parent.parent / file_url.lstrip("/")
            
            # If it's an audio/video file, try to convert it to MP3 if it's webm
            if local_path.suffix.lower() == ".webm":
                converted_path, converted_mime = self._convert_to_mp3(str(local_path))
                if converted_path != str(local_path): # Conversion happened
                    local_path = Path(converted_path)
                    # Update mime_type in the calling context if needed, though here we just load the data
            
            logging.warning(f"[DEBUG] Trying to load file from: {local_path}")
            if local_path.exists():
                with open(local_path, "rb") as f:
                    data = base64.b64encode(f.read()).decode("utf-8")
                    logging.warning(f"[DEBUG] File loaded successfully, size: {len(data)} chars")
                    return data
            else:
                logging.warning(f"[DEBUG] File not found at: {local_path}")
        
        # Handle remote URLs
        if file_url.startswith(("http://", "https://")):
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, timeout=30.0)
                if response.status_code == 200:
                    return base64.b64encode(response.content).decode("utf-8")
        
        return None


def prepare_next_input(
    data_transfer_mode: str,
    original_input: str,
    prev_output: str,
    history: list[dict] | None = None,
    include_original_input: bool = True,
) -> str:
    """Prepare input for the next agent based on transfer mode.
    
    Args:
        data_transfer_mode: A or B.
        original_input: Original user input.
        prev_output: Previous agent's output.
        history: List of previous step results (for mode B).
        include_original_input: Whether to include original input in context.
        
    Returns:
        Prepared input string for the next agent.
    """
    if data_transfer_mode == "A":
        # Mode A: Pass the output from previous agent
        if include_original_input:
            return f"[Original Input]:\n{original_input}\n\n[Previous Agent Output]:\n{prev_output}"
        return prev_output
    
    elif data_transfer_mode == "B":
        # Mode B: Pass entire conversation history
        if not history:
            return prev_output
        
        conversation = [f"[Original Input]: {original_input}"]
        for step in history:
            role = step.get("agent_role", "Agent")
            output = step.get("output", "")
            conversation.append(f"[{role}]: {output}")
        
        return "\n\n".join(conversation)
    
    else:
        # Fallback to mode A behavior
        if include_original_input:
            return f"[Original Input]:\n{original_input}\n\n[Previous Agent Output]:\n{prev_output}"
        return prev_output

