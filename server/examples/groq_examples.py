"""
examples/groq_examples.py

Examples specifically for Groq models showing their capabilities and usage.
"""
from app.core.llm import get_llm, chat, chat_stream, UnifiedLLM, LLMProvider

def groq_model_comparison():
    """Compare different Groq models"""
    print("=== Groq Model Comparison ===\n")
    
    prompt = "Explain machine learning in one sentence."
    groq_models = ["llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b", "gemma2-9b"]
    
    for model in groq_models:
        try:
            response = chat(prompt, model=model, max_tokens=100)
            print(f"{model}: {response}")
        except Exception as e:
            print(f"{model}: Error - {e}")
        print()

def groq_streaming_demo():
    """Demonstrate Groq streaming capabilities"""
    print("=== Groq Streaming Demo ===\n")
    
    print("LLaMA 3.1 70B streaming response:")
    for chunk in chat_stream("Write a short poem about AI", model="llama-3.1-8b"):
        print(chunk, end="", flush=True)
    print("\n")

def groq_code_generation():
    """Show Groq's code generation capabilities"""
    print("=== Groq Code Generation ===\n")
    
    llm = get_llm("llama-3.1-70b")  # Mixtral is good for code
    
    response = llm.chat(
        "Write a Python function to calculate fibonacci numbers recursively",
        max_tokens=300,
        temperature=0.1
    )
    
    print("Mixtral-8x7B generated code:")
    print(response.content)

def groq_tool_usage():
    """Demo Groq with tool calling"""
    print("=== Groq Tool Usage ===\n")
    
    # Mock tools for demonstration
    tools = [{
        "name": "calculate",
        "description": "Perform mathematical calculations",
        "parameters": {
            "type": "object", 
            "properties": {
                "expression": {"type": "string", "description": "Math expression to evaluate"}
            },
            "required": ["expression"]
        }
    }, {
        "name": "search_web",
        "description": "Search the web for information",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"]
        }
    }]
    
    llm = get_llm("llama-3.1-70b")
    
    response = llm.chat_with_tools(
        "What is 25 * 47? Also search for latest AI news.",
        tools=tools
    )
    
    print(f"Response: {response.content}")
    print(f"Tool calls: {response.tool_calls}")

def groq_creative_writing():
    """Show Groq's creative capabilities"""
    print("=== Groq Creative Writing ===\n")
    
    llm = get_llm("llama-3.1-8b")  # Fast model for creative tasks
    
    response = llm.chat(
        "Write a creative short story about a robot learning to paint (max 200 words)",
        max_tokens=250,
        temperature=0.8  # Higher temperature for creativity
    )
    
    print("LLaMA 3.1 8B creative story:")
    print(response.content)

def groq_performance_test():
    """Test Groq's speed and performance"""
    print("=== Groq Performance Test ===\n")
    
    import time
    
    models = ["llama-3.1-8b", "llama-3.1-70b", "mixtral-8x7b"]
    prompt = "List 5 benefits of renewable energy"
    
    for model in models:
        try:
            start_time = time.time()
            response = chat(prompt, model=model, max_tokens=150)
            end_time = time.time()
            
            print(f"{model}:")
            print(f"  Response time: {end_time - start_time:.2f} seconds")
            print(f"  Response length: {len(response)} characters")
            print(f"  Response: {response[:100]}...")
            print()
        except Exception as e:
            print(f"{model}: Error - {e}\n")

def groq_model_details():
    """Show detailed information about Groq models"""
    print("=== Groq Model Details ===\n")
    
    groq_models = ["llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b", "gemma2-9b"]
    
    for model_name in groq_models:
        try:
            llm = get_llm(model_name)
            info = llm.get_model_info()
            print(f"Model: {model_name}")
            print(f"  Provider: {info['provider']}")
            print(f"  Full model name: {info['model']}")
            print(f"  Max tokens: {info['max_tokens']}")
            print(f"  Temperature: {info['temperature']}")
            print()
        except Exception as e:
            print(f"{model_name}: Error - {e}\n")

if __name__ == "__main__":
    print("Groq LLM Examples")
    print("=" * 50)
    
    # Check if Groq models are available
    available_models = [m for m in UnifiedLLM.list_models() if "llama" in m or "mixtral" in m or "gemma" in m]
    print(f"Available Groq models: {available_models}")
    print()
    
    if not available_models:
        print("No Groq models available. Make sure GROQ_API_KEY is set in your .env file")
        exit(1)
    
    try:
        groq_model_details()
        # groq_model_comparison()
        # groq_streaming_demo()
        # groq_code_generation() 
        # groq_tool_usage()
        # groq_creative_writing()
        # groq_performance_test()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure to set GROQ_API_KEY in your .env file")
        print("Also install groq: pip install groq")
