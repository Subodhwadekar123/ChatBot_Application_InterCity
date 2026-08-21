import google.generativeai as genai
from app.config import settings

print("Using GEMINI_API_KEY:", settings.GEMINI_API_KEY[:10] + "...")
genai.configure(api_key=settings.GEMINI_API_KEY)

try:
    print("Listing available models:")
    models = genai.list_models()
    for m in models:
        print(f" - {m.name} (methods: {m.supported_generation_methods})")
except Exception as e:
    print("Error occurred while listing models:", e)
