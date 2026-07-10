import logging
import re
import requests
from app.config import settings

logger = logging.getLogger("commai.ai_service")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_PRIMARY = "llama-3.3-70b-versatile"
MODEL_FALLBACK = "llama-3.1-8b-instant"

PLACEHOLDER_GUARD = (
    "CRITICAL REQUIREMENT: Do NOT translate, modify, replace, or remove any "
    "placeholder variables enclosed in double-curly braces (for example, "
    "{{first_name}}, {{last_name}}, {{city}}, {{occupation}}, {{organization}}, "
    "{{department}}, etc.). Keep them exactly as they are in the source text, "
    "retaining the braces and variable names.\n"
)

OUTPUT_GUARD = (
    "Only return the exact output text. Do NOT include any introductions, "
    "explanations, notes, greetings, markdown blocks, or surrounding quotes."
)

# Structured prompt templates keyed by campaign category
CATEGORY_PROMPTS = {
    "awareness": (
        "You are drafting a public awareness campaign message for a government "
        "communication platform. The tone should be clear, informative, and "
        "engaging. Include a call-to-action that empowers the citizen."
    ),
    "emergency": (
        "You are drafting an urgent emergency alert for a government mass "
        "communication system. The tone must convey urgency and clarity. "
        "Include specific action items the citizen must take immediately. "
        "Keep sentences short and impactful."
    ),
    "education": (
        "You are drafting an educational notification for a government outreach "
        "platform. The tone should be informative, accessible, and supportive. "
        "Break complex topics into simple language."
    ),
    "announcement": (
        "You are drafting a formal government announcement. The tone should be "
        "professional, authoritative, and clear. Use structured sentences and "
        "maintain an official register."
    ),
}

TONE_INSTRUCTIONS = {
    "urgent": "Rewrite the text with maximum urgency. Use short imperative sentences, action-oriented language, and stress the time-sensitivity.",
    "empathetic": "Rewrite the text with warmth and empathy. Acknowledge the reader's difficulties and offer reassurance while keeping the core message intact.",
    "formal": "Rewrite the text in a formal, official tone suitable for government gazettes. Use complete sentences, passive voice where appropriate, and precise language.",
    "simplified": "Rewrite the text so that it can be easily understood by a reader with limited literacy. Use very short sentences, common words, and avoid jargon.",
}

AUDIENCE_PROFILES = {
    "healthcare_worker": "Adapt the message for healthcare professionals. Use medical terminology appropriately and reference clinical workflows.",
    "student": "Adapt the message for students (ages 15-25). Use relatable language, add context about how it affects their studies or campus life.",
    "rural_audience": "Adapt the message for rural communities. Use simple, everyday language. Reference agricultural or village life contexts where appropriate.",
    "senior_citizen": "Adapt the message for senior citizens (age 60+). Use larger conceptual framing, be respectful, avoid slang, and add reassurances.",
    "general": "Keep the message suitable for a general audience with diverse backgrounds.",
}

# Compliance rule checkers
SPAM_PHRASES = [
    "win free", "click here now", "limited time offer", "act now",
    "congratulations you have won", "cash prize", "100% free",
    "no obligation", "risk free", "double your", "earn extra cash",
    "make money fast", "be your own boss",
]

SENSITIVE_PHRASES = [
    "caste", "religion", "political party", "vote for",
    "anti-national", "terrorist",
]

MAX_RECOMMENDED_LENGTH = 5000


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _call_groq(system_prompt: str, user_content: str, temperature: float = 0.3, max_tokens: int = 1500) -> str | None:
    """Send a chat completion request to Groq, with automatic fallback."""
    if not settings.GROQ_API_KEY:
        logger.warning("[AI] Groq API Key is not set.")
        return None

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL_PRIMARY,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code != 200:
            logger.warning(f"[AI] Primary model failed ({resp.status_code}). Trying fallback...")
            payload["model"] = MODEL_FALLBACK
            resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)

        if resp.status_code == 200:
            text = resp.json()["choices"][0]["message"]["content"].strip()
            return _clean_output(text)
        else:
            logger.error(f"[AI] Groq call failed: {resp.text}")
            return None
    except Exception as e:
        logger.error(f"[AI] Error calling Groq API: {e}", exc_info=True)
        return None


def _clean_output(text: str) -> str:
    """Strip stray markdown fences or wrapping quotes that models sometimes add."""
    if text.startswith("```") and text.endswith("```"):
        lines = text.split("\n")
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()
    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()
    return text


# ---------------------------------------------------------------------------
# 1. generate_campaign_content
# ---------------------------------------------------------------------------
def generate_campaign_content(
    prompt: str,
    category: str = "awareness",
    channel: str = "email",
    tone: str = "formal",
) -> dict:
    """
    Generate subject + body for a campaign message.
    Returns {"subject": str, "body": str} or {"error": str}.
    """
    category_guide = CATEGORY_PROMPTS.get(category, CATEGORY_PROMPTS["awareness"])
    tone_guide = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["formal"])

    channel_note = ""
    if channel == "sms":
        channel_note = "The output is for SMS. Keep the body under 160 characters. No subject line needed."
    elif channel == "whatsapp":
        channel_note = "The output is for WhatsApp. Keep it conversational but concise."
    elif channel == "email":
        channel_note = "The output is for email. Provide a compelling subject line AND a detailed body."
    elif channel == "push":
        channel_note = "The output is for push notification. Keep it ultra-short (max 100 characters body)."

    system = (
        f"{category_guide}\n\n"
        f"Tone: {tone_guide}\n\n"
        f"Channel: {channel_note}\n\n"
        f"{PLACEHOLDER_GUARD}\n"
        "Include placeholder variables like {{first_name}} and {{city}} where contextually appropriate.\n\n"
        "Return your output in EXACTLY this format (no markdown, no extra text):\n"
        "SUBJECT: <subject line here>\n"
        "BODY: <body text here>\n\n"
        f"{OUTPUT_GUARD}"
    )

    result = _call_groq(system, f"Campaign brief: {prompt}", temperature=0.4, max_tokens=1500)
    if result is None:
        return {"error": "AI service is currently unavailable. Please try again later or write manually."}

    # Parse SUBJECT: and BODY: from the output
    subject = ""
    body = result
    subject_match = re.search(r"SUBJECT:\s*(.*?)(?:\nBODY:|\Z)", result, re.DOTALL | re.IGNORECASE)
    body_match = re.search(r"BODY:\s*(.*)", result, re.DOTALL | re.IGNORECASE)
    if subject_match:
        subject = subject_match.group(1).strip()
    if body_match:
        body = body_match.group(1).strip()

    return {"subject": subject, "body": body}


# ---------------------------------------------------------------------------
# 2. optimize_content
# ---------------------------------------------------------------------------
def optimize_content(text: str, target_tone: str = "formal") -> dict:
    """
    Rewrite text in the requested tone while preserving placeholders.
    Returns {"optimized_text": str} or {"error": str}.
    """
    tone_guide = TONE_INSTRUCTIONS.get(target_tone, TONE_INSTRUCTIONS["formal"])

    system = (
        f"You are a professional government communications editor.\n"
        f"Task: {tone_guide}\n\n"
        f"{PLACEHOLDER_GUARD}\n"
        f"{OUTPUT_GUARD}"
    )

    result = _call_groq(system, text, temperature=0.3, max_tokens=1500)
    if result is None:
        return {"error": "AI service is currently unavailable. Please try again later."}
    return {"optimized_text": result}


# ---------------------------------------------------------------------------
# 3. translate_content
# ---------------------------------------------------------------------------
def translate_content(
    text: str,
    target_language: str,
    source_language: str = "English",
) -> dict:
    """
    Translate text while preserving placeholders.
    Returns {"translated_text": str} or {"error": str}.
    """
    if target_language.strip().lower() == source_language.strip().lower():
        return {"translated_text": text}

    system = (
        "You are an expert translator specializing in government public communications.\n"
        f"Translate from {source_language} to {target_language}.\n\n"
        f"{PLACEHOLDER_GUARD}\n"
        f"{OUTPUT_GUARD}"
    )

    result = _call_groq(system, text, temperature=0.1, max_tokens=1500)
    if result is None:
        return {"error": "AI service is currently unavailable. Please try again later."}
    return {"translated_text": result}


# ---------------------------------------------------------------------------
# 4. personalize_content
# ---------------------------------------------------------------------------
def personalize_content(
    text: str,
    audience_profile: str = "general",
    communication_objective: str = "awareness",
) -> dict:
    """
    Adapt the message for a specific audience profile + communication objective.
    Returns {"personalized_text": str} or {"error": str}.
    """
    profile_guide = AUDIENCE_PROFILES.get(audience_profile, AUDIENCE_PROFILES["general"])
    objective_guide = CATEGORY_PROMPTS.get(communication_objective, CATEGORY_PROMPTS["awareness"])

    system = (
        "You are a government communications specialist adapting messages for specific audiences.\n\n"
        f"Target audience: {profile_guide}\n\n"
        f"Communication objective: {objective_guide}\n\n"
        f"{PLACEHOLDER_GUARD}\n"
        "Rewrite the provided text to suit this audience while preserving the core information.\n"
        f"{OUTPUT_GUARD}"
    )

    result = _call_groq(system, text, temperature=0.35, max_tokens=1500)
    if result is None:
        return {"error": "AI service is currently unavailable. Please try again later."}
    return {"personalized_text": result}


# ---------------------------------------------------------------------------
# 5. check_compliance_and_quality
# ---------------------------------------------------------------------------
def check_compliance_and_quality(text: str, category: str = "awareness") -> dict:
    """
    Locally audits text for common compliance issues. Returns a structured report.
    This runs entirely offline — no LLM call needed.
    """
    issues = []
    score = 100  # Start with a perfect score and deduct

    if not text or not text.strip():
        return {"score": 0, "issues": [{"severity": "error", "message": "Message body is empty."}]}

    lower_text = text.lower()

    # 1. Placeholder consistency
    placeholders = re.findall(r"\{\{(\w+)\}\}", text)
    unclosed = re.findall(r"\{\{[^}]*$", text, re.MULTILINE)
    if unclosed:
        issues.append({"severity": "error", "message": f"Found {len(unclosed)} unclosed placeholder braces."})
        score -= 15

    # Check for common broken placeholder patterns
    broken = re.findall(r"\{[^{]|[^}]\}", text)
    single_braces = [b for b in broken if "{{" not in b and "}}" not in b]
    # More targeted: look for single { or } that aren't part of doubles
    if re.search(r"(?<!\{)\{(?!\{)", text) or re.search(r"(?<!\})\}(?!\})", text):
        issues.append({"severity": "warning", "message": "Possible single-brace placeholder detected. Use double braces {{variable}}."})
        score -= 5

    # 2. Empty / duplicate placeholders
    if placeholders:
        seen = set()
        for p in placeholders:
            if p in seen:
                issues.append({"severity": "info", "message": f"Placeholder '{{{{{p}}}}}' appears multiple times."})
            seen.add(p)

    # 3. Excessive length
    char_count = len(text)
    word_count = len(text.split())
    if char_count > MAX_RECOMMENDED_LENGTH:
        issues.append({"severity": "warning", "message": f"Message is {char_count} characters. Recommended max is {MAX_RECOMMENDED_LENGTH}."})
        score -= 10

    # 4. Spam wording
    spam_found = [p for p in SPAM_PHRASES if p in lower_text]
    if spam_found:
        issues.append({"severity": "error", "message": f"Spam-like phrases detected: {', '.join(spam_found)}"})
        score -= 20

    # 5. Sensitive language
    sensitive_found = [p for p in SENSITIVE_PHRASES if p in lower_text]
    if sensitive_found:
        issues.append({"severity": "warning", "message": f"Potentially sensitive terms detected: {', '.join(sensitive_found)}"})
        score -= 15

    # 6. Readability (simple heuristic: average words per sentence)
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if sentences:
        avg_words_per_sentence = word_count / len(sentences)
        if avg_words_per_sentence > 30:
            issues.append({"severity": "info", "message": f"Average sentence length is {avg_words_per_sentence:.0f} words. Consider shortening sentences for readability."})
            score -= 5
    else:
        issues.append({"severity": "info", "message": "No clear sentence boundaries detected."})
        score -= 5

    # 7. Very short content
    if word_count < 5:
        issues.append({"severity": "warning", "message": "Message is very short. Consider adding more detail."})
        score -= 10

    # 8. ALL CAPS abuse
    words = text.split()
    caps_words = [w for w in words if w.isupper() and len(w) > 2]
    if len(caps_words) > max(3, len(words) * 0.3):
        issues.append({"severity": "warning", "message": "Excessive use of ALL CAPS. This may be perceived as shouting."})
        score -= 10

    # 9. Duplicate content (repeated phrases)
    ngram_size = 6
    if word_count >= ngram_size * 2:
        ngrams = [" ".join(words[i:i + ngram_size]) for i in range(len(words) - ngram_size + 1)]
        ngram_set = set()
        duplicates = set()
        for ng in ngrams:
            if ng in ngram_set:
                duplicates.add(ng)
            ngram_set.add(ng)
        if duplicates:
            issues.append({"severity": "info", "message": f"Possible duplicate content detected ({len(duplicates)} repeated phrases)."})
            score -= 5

    score = max(0, score)

    if not issues:
        issues.append({"severity": "success", "message": "Message passes all compliance checks."})

    return {
        "score": score,
        "char_count": char_count,
        "word_count": word_count,
        "placeholder_count": len(placeholders),
        "issues": issues,
    }
