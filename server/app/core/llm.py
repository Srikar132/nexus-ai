"""
core/llm.py

Unified LLM abstraction layer supporting multiple AI providers.
Provides consistent interface for streaming and non-streaming operations.
Handles model versioning, configuration, and provider-specific differences.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union, Iterator, AsyncIterator
from dataclasses import dataclass
from enum import Enum
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Provider-specific imports
try:
    import anthropic
except ImportError:
    anthropic = None

try:
    import openai
except ImportError:
    openai = None

try:
    from groq import Groq
except ImportError:
    Groq = None

from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import BaseTool
from app.core.config import settings


class LLMProvider(Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GROQ = "groq"


@dataclass
class LLMConfig:
    provider: LLMProvider
    model: str
    api_key: str
    max_tokens: int = 4096
    temperature: float = 0.0
    timeout: int = 30


@dataclass
class StreamChunk:
    content: str
    role: str = "assistant"
    done: bool = False
    
    
@dataclass
class LLMResponse:
    content: str
    role: str = "assistant"
    tool_calls: List[Dict] = None
    
    def __post_init__(self):
        if self.tool_calls is None:
            self.tool_calls = []


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    def chat_completion(self, messages: List[Dict], **kwargs) -> LLMResponse:
        pass
    
    @abstractmethod
    def chat_completion_stream(self, messages: List[Dict], **kwargs) -> Iterator[StreamChunk]:
        pass
    
    @abstractmethod
    def chat_completion_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMResponse:
        pass


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider"""
    
    def __init__(self, config: LLMConfig):
        if anthropic is None:
            raise ImportError("anthropic package not installed")
        
        self.config = config
        self.client = anthropic.Anthropic(api_key=config.api_key)
    
    def _convert_messages(self, messages: List[Dict]) -> tuple[str, List[Dict]]:
        """Convert to Anthropic format: separate system message"""
        system = ""
        anthropic_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        return system, anthropic_messages
    
    def chat_completion(self, messages: List[Dict], **kwargs) -> LLMResponse:
        system, anthropic_messages = self._convert_messages(messages)
        
        response = self.client.messages.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            system=system,
            messages=anthropic_messages,
        )
        
        return LLMResponse(
            content=response.content[0].text if response.content else "",
            role="assistant"
        )
    
    def chat_completion_stream(self, messages: List[Dict], **kwargs) -> Iterator[StreamChunk]:
        system, anthropic_messages = self._convert_messages(messages)
        
        with self.client.messages.stream(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            system=system,
            messages=anthropic_messages,
        ) as stream:
            for event in stream:
                if event.type == "content_block_delta":
                    if hasattr(event.delta, 'text'):
                        yield StreamChunk(content=event.delta.text)
                elif event.type == "message_stop":
                    yield StreamChunk(content="", done=True)
    
    def chat_completion_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMResponse:
        system, anthropic_messages = self._convert_messages(messages)
        
        # Convert tools to Anthropic format
        anthropic_tools = []
        for tool in tools:
            anthropic_tools.append({
                "name": tool["name"],
                "description": tool["description"],
                "input_schema": tool["parameters"]
            })
        
        response = self.client.messages.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            system=system,
            messages=anthropic_messages,
            tools=anthropic_tools,
        )
        
        # Extract tool calls
        tool_calls = []
        content = ""
        
        for block in response.content:
            if block.type == "text":
                content += block.text
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "args": block.input
                })
        
        return LLMResponse(
            content=content,
            role="assistant",
            tool_calls=tool_calls
        )


class OpenAIProvider(BaseLLMProvider):
    """OpenAI GPT provider"""
    
    def __init__(self, config: LLMConfig):
        if openai is None:
            raise ImportError("openai package not installed")
        
        self.config = config
        self.client = openai.OpenAI(api_key=config.api_key)
    
    def chat_completion(self, messages: List[Dict], **kwargs) -> LLMResponse:
        response = self.client.chat.completions.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            messages=messages,
        )
        
        return LLMResponse(
            content=response.choices[0].message.content or "",
            role="assistant"
        )
    
    def chat_completion_stream(self, messages: List[Dict], **kwargs) -> Iterator[StreamChunk]:
        response = self.client.chat.completions.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            messages=messages,
            stream=True,
        )
        
        for chunk in response:
            if chunk.choices[0].delta.content:
                yield StreamChunk(content=chunk.choices[0].delta.content)
            if chunk.choices[0].finish_reason:
                yield StreamChunk(content="", done=True)
    
    def chat_completion_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMResponse:
        # Convert tools to OpenAI format
        openai_tools = [{"type": "function", "function": tool} for tool in tools]
        
        response = self.client.chat.completions.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            messages=messages,
            tools=openai_tools,
        )
        
        message = response.choices[0].message
        tool_calls = []
        
        if message.tool_calls:
            for tc in message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "args": json.loads(tc.function.arguments)
                })
        
        return LLMResponse(
            content=message.content or "",
            role="assistant",
            tool_calls=tool_calls
        )


class GroqProvider(BaseLLMProvider):
    """Groq provider"""
    
    def __init__(self, config: LLMConfig):
        if Groq is None:
            raise ImportError("groq package not installed")
        
        self.config = config
        self.client = Groq(api_key=config.api_key)
    
    def chat_completion(self, messages: List[Dict], **kwargs) -> LLMResponse:
        response = self.client.chat.completions.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            messages=messages,
        )
        
        return LLMResponse(
            content=response.choices[0].message.content or "",
            role="assistant"
        )
    
    def chat_completion_stream(self, messages: List[Dict], **kwargs) -> Iterator[StreamChunk]:
        response = self.client.chat.completions.create(
            model=self.config.model,
            max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
            temperature=kwargs.get("temperature", self.config.temperature),
            messages=messages,
            stream=True,
        )
        
        for chunk in response:
            if chunk.choices[0].delta.content:
                yield StreamChunk(content=chunk.choices[0].delta.content)
            if chunk.choices[0].finish_reason:
                yield StreamChunk(content="", done=True)
    
    def chat_completion_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMResponse:
        import re as _re
        # Convert tools to Groq format (same as OpenAI)
        groq_tools = [{"type": "function", "function": tool} for tool in tools]
        
        # Retry loop: Groq's llama-3.3-70b-versatile occasionally generates
        # XML-format tool calls that its own validator rejects (tool_use_failed).
        # Retrying with parallel_tool_calls=False fixes it in 1-2 tries.
        last_exc = None
        for attempt in range(3):
            try:
                create_kwargs = dict(
                    model=self.config.model,
                    max_tokens=kwargs.get("max_tokens", self.config.max_tokens),
                    temperature=kwargs.get("temperature", self.config.temperature),
                    messages=messages,
                    tools=groq_tools,
                )
                # After first failure, disable parallel tool calls to force one-at-a-time
                if attempt > 0:
                    create_kwargs["parallel_tool_calls"] = False
                response = self.client.chat.completions.create(**create_kwargs)
                break  # success
            except Exception as exc:
                last_exc = exc
                # Only retry on Groq tool_use_failed (XML format issue)
                err_str = str(exc)
                if "tool_use_failed" in err_str or "Failed to call a function" in err_str:
                    continue
                raise  # re-raise non-retryable errors immediately
        else:
            raise last_exc  # all retries exhausted
        
        message = response.choices[0].message
        tool_calls = []
        clean_content = message.content or ""
        xml_fallback = False
        
        if message.tool_calls:
            for tc in message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "args": json.loads(tc.function.arguments)
                })
        elif message.content:
            # Fallback: parse XML-format tool calls that some models emit in the
            # content field instead of structured tool_calls.
            # Pattern: <function=tool_name {...json...}>  (with optional whitespace)
            xml_tool_pattern = _re.compile(
                r"<function=(\w+)\s*(\{.*?\})>", _re.DOTALL
            )
            for i, match in enumerate(_re.finditer(xml_tool_pattern, message.content)):
                tool_name = match.group(1)
                raw_args  = match.group(2)
                try:
                    args = json.loads(raw_args)
                except json.JSONDecodeError:
                    args = {"raw": raw_args}
                tool_calls.append({
                    "id":   f"xml_fallback_{i}",
                    "name": tool_name,
                    "args": args,
                })
            if tool_calls:
                xml_fallback = True
                # Strip the XML blobs from the content so they don't get echoed back
                clean_content = _re.sub(xml_tool_pattern, "", message.content).strip()
        
        return LLMResponse(
            content=clean_content if xml_fallback else (message.content or ""),
            role="assistant",
            tool_calls=tool_calls
        )


class UnifiedLLM:
    """
    Unified LLM client supporting multiple providers with consistent interface.
    Handles provider selection, model versioning, and feature normalization.
    """
    
    # Predefined model configurations
    MODELS = {
        # Anthropic models
        "claude-3-5-sonnet": LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            model="claude-3-5-sonnet-20241022",
            api_key=settings.ANTHROPIC_API_KEY,
            max_tokens=8192,
            temperature=0.0
        ),
        "claude-3-opus": LLMConfig(
            provider=LLMProvider.ANTHROPIC,
            model="claude-3-opus-20240229", 
            api_key=settings.ANTHROPIC_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        
        # OpenAI models
        "gpt-4o": LLMConfig(
            provider=LLMProvider.OPENAI,
            model="gpt-4o-2024-11-20",
            api_key=settings.OPENAI_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        "gpt-4-turbo": LLMConfig(
            provider=LLMProvider.OPENAI,
            model="gpt-4-turbo-2024-04-09",
            api_key=settings.OPENAI_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        "gpt-3.5-turbo": LLMConfig(
            provider=LLMProvider.OPENAI,
            model="gpt-3.5-turbo-0125",
            api_key=settings.OPENAI_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        
        # Groq models
        "llama-3.1-70b": LLMConfig(
            provider=LLMProvider.GROQ,
            model="llama-3.3-70b-versatile",  # 3.1-70b-versatile decommissioned → replaced with 3.3
            api_key=settings.GROQ_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        "llama-3.3-70b": LLMConfig(
            provider=LLMProvider.GROQ,
            model="llama-3.3-70b-versatile",
            api_key=settings.GROQ_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        "llama-3-groq-70b-tool-use": LLMConfig(
            provider=LLMProvider.GROQ,
            model="llama3-groq-70b-8192-tool-use-preview",
            api_key=settings.GROQ_API_KEY,
            max_tokens=8192,
            temperature=0.0
        ),
        "llama-3-groq-8b-tool-use": LLMConfig(
            provider=LLMProvider.GROQ,
            model="llama3-groq-8b-8192-tool-use-preview",
            api_key=settings.GROQ_API_KEY,
            max_tokens=8192,
            temperature=0.0
        ),
        "llama-3.1-8b": LLMConfig(
            provider=LLMProvider.GROQ,
            model="llama-3.1-8b-instant",
            api_key=settings.GROQ_API_KEY,
            max_tokens=4096,
            temperature=0.0
        ),
        "mixtral-8x7b": LLMConfig(
            provider=LLMProvider.GROQ,
            model="mixtral-8x7b-32768",
            api_key=settings.GROQ_API_KEY,
            max_tokens=8192,
            temperature=0.0
        ),
        "gemma2-9b": LLMConfig(
            provider=LLMProvider.GROQ,
            model="gemma2-9b-it",
            api_key=settings.GROQ_API_KEY,
            max_tokens=4096,
            temperature=0.0
        )
    }
    
    def __init__(self, model_name: str = "claude-3-5-sonnet"):
        """
        Initialize with a model name from MODELS dict.
        
        Args:
            model_name: Key from MODELS dict (e.g., "claude-3-5-sonnet", "gpt-4o")
        """
        if model_name not in self.MODELS:
            available = ", ".join(self.MODELS.keys())
            raise ValueError(f"Model '{model_name}' not available. Choose from: {available}")
        
        self.config = self.MODELS[model_name]
        self.model_name = model_name
        
        # Initialize provider
        if self.config.provider == LLMProvider.ANTHROPIC:
            self.provider = AnthropicProvider(self.config)
        elif self.config.provider == LLMProvider.OPENAI:
            self.provider = OpenAIProvider(self.config)
        elif self.config.provider == LLMProvider.GROQ:
            self.provider = GroqProvider(self.config)
        else:
            raise ValueError(f"Unsupported provider: {self.config.provider}")
    
    def chat(self, messages: Union[List[Dict], str], **kwargs) -> LLMResponse:
        """
        Simple chat completion.
        
        Args:
            messages: Either a list of message dicts or a single string (converted to user message)
            **kwargs: Override config parameters (max_tokens, temperature, etc.)
        """
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        
        return self.provider.chat_completion(messages, **kwargs)
    
    def chat_stream(self, messages: Union[List[Dict], str], **kwargs) -> Iterator[StreamChunk]:
        """
        Streaming chat completion.
        
        Args:
            messages: Either a list of message dicts or a single string
            **kwargs: Override config parameters
        """
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        
        return self.provider.chat_completion_stream(messages, **kwargs)
    
    def chat_with_tools(self, messages: Union[List[Dict], str], tools: List[Union[Dict, BaseTool]], **kwargs) -> LLMResponse:
        """
        Chat completion with tool calling support.
        
        Args:
            messages: Message history
            tools: List of tool definitions or LangChain BaseTool objects
            **kwargs: Override config parameters
        """
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        
        # Convert LangChain tools to dict format
        tool_defs = []
        for tool in tools:
            if isinstance(tool, BaseTool):
                tool_defs.append({
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.args_schema.model_json_schema() if tool.args_schema else {}
                })
            else:
                tool_defs.append(tool)
        
        return self.provider.chat_completion_with_tools(messages, tool_defs, **kwargs)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the current model"""
        return {
            "name": self.model_name,
            "provider": self.config.provider.value,
            "model": self.config.model,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature
        }
    
    @classmethod
    def list_models(cls) -> List[str]:
        """List all available model names"""
        return list(cls.MODELS.keys())
    
    @classmethod
    def create_custom(cls, provider: LLMProvider, model: str, api_key: str, **kwargs) -> 'UnifiedLLM':
        """Create UnifiedLLM with custom configuration"""
        config = LLMConfig(
            provider=provider,
            model=model,
            api_key=api_key,
            **kwargs
        )
        
        llm = cls.__new__(cls)
        llm.config = config
        llm.model_name = f"custom-{model}"
        
        if provider == LLMProvider.ANTHROPIC:
            llm.provider = AnthropicProvider(config)
        elif provider == LLMProvider.OPENAI:
            llm.provider = OpenAIProvider(config)
        elif provider == LLMProvider.GROQ:
            llm.provider = GroqProvider(config)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        
        return llm


# Convenience functions for common use cases
def get_llm(model: str = "claude-3-5-sonnet") -> UnifiedLLM:
    """Get a UnifiedLLM instance with specified model"""
    return UnifiedLLM(model)


def chat(prompt: str, model: str = "claude-3-5-sonnet", **kwargs) -> str:
    """Quick chat function - returns just the text content"""
    llm = get_llm(model)
    response = llm.chat(prompt, **kwargs)
    return response.content


def chat_stream(prompt: str, model: str = "claude-3-5-sonnet", **kwargs) -> Iterator[str]:
    """Quick streaming chat - yields text content only"""
    llm = get_llm(model)
    for chunk in llm.chat_stream(prompt, **kwargs):
        if not chunk.done:
            yield chunk.content
