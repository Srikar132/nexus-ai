"""
examples/llm_usage.py

Example usage of the unified LLM class showing how to easily switch between models.
"""
from app.core.llm import get_llm, chat, chat_stream, UnifiedLLM

def basic_usage():
    """Basic usage examples"""
    print("=== Basic Usage Examples ===\n")
    
    # Quick chat function
    response = chat("What is Python?", model="claude-3-5-sonnet")
    print(f"Claude Sonnet: {response[:100]}...\n")
    
    # Try different model
    response = chat("What is Python?", model="gpt-4o")
    print(f"GPT-4o: {response[:100]}...\n")
    
    # Try Groq model
    response = chat("What is Python?", model="llama-3.1-70b")
    print(f"LLaMA 3.1 70B: {response[:100]}...\n")

def streaming_example():
    """Streaming example"""
    print("=== Streaming Example ===\n")
    
    print("Claude streaming:")
    for chunk in chat_stream("Count from 1 to 5", model="claude-3-5-sonnet"):
        print(chunk, end="", flush=True)
    print("\n")

def advanced_usage():
    """Advanced usage with LLM instances"""
    print("=== Advanced Usage ===\n")
    
    # Create specific model instances
    claude = get_llm("claude-3-5-sonnet")
    gpt = get_llm("gpt-4o")
    llama = get_llm("llama-3.1-70b")
    
    # Check model info
    print("Claude info:", claude.get_model_info())
    print("GPT info:", gpt.get_model_info())
    print("LLaMA info:", llama.get_model_info())
    
    # Use with different parameters
    response = claude.chat("Explain AI briefly", max_tokens=100, temperature=0.7)
    print(f"Claude response: {response.content}")
    
def tool_usage_example():
    """Example with tools (for ReAct agents)"""
    print("=== Tool Usage Example ===\n")
    
    # Mock tool for demonstration
    mock_tools = [{
        "name": "get_weather",
        "description": "Get weather for a city", 
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"}
            },
            "required": ["city"]
        }
    }]
    
    llm = get_llm("claude-3-5-sonnet")
    
    # This would be used in ReAct loop
    response = llm.chat_with_tools(
        "What's the weather in Paris?", 
        tools=mock_tools
    )
    
    print(f"Response: {response.content}")
    print(f"Tool calls: {response.tool_calls}")

def model_switching_demo():
    """Demo showing easy model switching"""
    print("=== Model Switching Demo ===\n")
    
    prompt = "Explain quantum computing in one sentence"
    
    # Test all available models
    for model_name in UnifiedLLM.list_models():
        try:
            llm = get_llm(model_name)
            response = llm.chat(prompt, max_tokens=50)
            print(f"{model_name}: {response.content}")
        except Exception as e:
            print(f"{model_name}: Error - {e}")
        print()

if __name__ == "__main__":
    print("Unified LLM Usage Examples")
    print("=" * 50)
    
    # List available models
    print("Available models:", UnifiedLLM.list_models())
    print()
    
    # Run examples
    try:
        basic_usage()
        streaming_example() 
        advanced_usage()
        tool_usage_example()
        model_switching_demo()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure to set ANTHROPIC_API_KEY and/or OPENAI_API_KEY in your .env file")
