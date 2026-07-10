import logging
import requests
from app.config import settings

logger = logging.getLogger("commai.translation")

def translate_text(text: str, target_language: str, source_language: str = "English") -> str:
    """
    Translate text from source_language to target_language using Groq's Chat API.
    Preserves placeholder variables in double-curly braces like {{first_name}}.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("[TRANSLATE] Groq API Key is not set. Skipping translation.")
        return text

    if not text or not text.strip():
        return text

    # If source and target are the same, return as is
    if target_language.lower() == source_language.lower():
        return text

    # Clean the language names
    target_language = target_language.strip()
    source_language = source_language.strip()

    # We will use llama-3.3-70b-versatile or fallback to llama-3.1-8b-instant
    model = "llama-3.3-70b-versatile"
    fallback_model = "llama-3.1-8b-instant"

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    system_prompt = (
        "You are an expert translator specializing in government public communications, notices, and citizen alerts.\n"
        f"Translate the provided text from {source_language} to {target_language}.\n"
        "CRITICAL REQUIREMENT: Do NOT translate, modify, replace, or remove any placeholder variables enclosed in double-curly braces "
        "or single-curly braces (for example, {{first_name}}, {{last_name}}, {{city}}, {{occupation}}, {{organization}}, {{department}}, etc.). "
        "Keep them exactly as they are in the source text, retaining the braces and variable names.\n"
        "Only return the exact translated text. Do NOT include any introductions, explanations, notes, greetings, markdown blocks, or surrounding quotes."
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        "temperature": 0.1,
        "max_tokens": 1024
    }

    try:
        logger.info(f"[TRANSLATE] Translating text to {target_language} using {model}...")
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        # If model is overloaded or fails, try the fallback model
        if response.status_code != 200:
            logger.warning(f"[TRANSLATE] {model} failed with status {response.status_code}. Retrying with {fallback_model}...")
            payload["model"] = fallback_model
            response = requests.post(url, headers=headers, json=payload, timeout=10)

        if response.status_code == 200:
            data = response.json()
            translated = data["choices"][0]["message"]["content"].strip()
            
            # Clean up potential markdown formatting wrapping (like triple backticks or quotes) if the model ignored instructions
            if translated.startswith("```") and translated.endswith("```"):
                lines = translated.split("\n")
                if len(lines) >= 3:
                    translated = "\n".join(lines[1:-1]).strip()
            
            if (translated.startswith('"') and translated.endswith('"')) or (translated.startswith("'") and translated.endswith("'")):
                translated = translated[1:-1].strip()

            return translated
        else:
            logger.error(f"[TRANSLATE] Groq translation failed: {response.text}")
            return text

    except Exception as e:
        logger.error(f"[TRANSLATE] Error calling Groq API: {e}", exc_info=True)
        return text
