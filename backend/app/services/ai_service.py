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


def _clean_json_string(text: str) -> str:
    """Clean and repair common LLM JSON errors, especially unicode typos like \\u093i."""
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    
    # Replace common LLM Devanagari unicode escape typos (like \u093i instead of \u093f)
    cleaned = cleaned.replace(r"\u093i", r"\u093f")
    cleaned = cleaned.replace(r"\u093I", r"\u093f")
    
    # Generic regex cleanup for other invalid \uXXXX where the 4th char is 'i' or 'I' (common typos)
    # e.g., \u093i -> \u093f, or any \u[0-9a-fA-F]{3}i -> \u[0-9a-fA-F]{3}f
    cleaned = re.sub(r'\\u([0-9a-fA-F]{3})i', r'\\u\1f', cleaned)
    cleaned = re.sub(r'\\u([0-9a-fA-F]{3})I', r'\\u\1f', cleaned)
    
    return cleaned


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


# ---------------------------------------------------------------------------
# 6. plan_complete_campaign
# ---------------------------------------------------------------------------
def plan_complete_campaign(brief: str, category_hint: str = "awareness_drive") -> dict:
    """
    Generate a complete campaign plan from a user prompt using Groq.
    Returns a structured dictionary matching our JSON schema.
    """
    import json

    valid_types = [
        "awareness_drive",
        "emergency_alert",
        "educational_notification",
        "organizational_announcement"
    ]

    category_mapped = "awareness_drive"
    for vt in valid_types:
        if vt in category_hint or category_hint in vt:
            category_mapped = vt
            break

    system_prompt = (
        "You are an expert Government Campaign Planner and Mass Communication strategist.\n"
        "Your task is to plan, write, audit, and estimate success metrics for a citizen communication campaign.\n"
        "You MUST return a JSON object ONLY. Do not wrap in markdown fences (like ```json), write notes, or introduce your text.\n"
        "\n"
        "CRITICAL: Output Devanagari / Hindi text as RAW UTF-8 CHARACTERS (e.g., 'साफ', 'स्थिति', 'स्थानीय'). Do NOT escape them as unicode sequences (do NOT use \\uXXXX or backslashes). Writing unicode escapes leads to spelling errors.\n"
        "\n"
        "JSON SCHEMA RULES:\n"
        "{\n"
        "  \"campaign\": {\n"
        "    \"title\": \"String (<60 chars) - Clear, catchy campaign title (e.g. Ludhiana Swachh Water 2026)\",\n"
        "    \"objective\": \"String (<150 chars) - Campaign goal\",\n"
        "    \"campaign_type\": \"One of: awareness_drive, emergency_alert, educational_notification, organizational_announcement\",\n"
        "    \"description\": \"String - Detailed campaign contextual description\"\n"
        "  },\n"
        "  \"message\": {\n"
        "    \"subject\": \"String - A concise message subject (for emails or push notifications)\",\n"
        "    \"body\": \"String - The main communication body copy. Include personalization placeholders (e.g., {{first_name}}, {{city}}, {{district}}) where appropriate.\"\n"
        "  },\n"
        "  \"delivery\": {\n"
        "    \"channels\": \"Array of strings (at least 2 from: email, sms, whatsapp, push, website)\",\n"
        "    \"audiences\": \"Array of strings (e.g. ['School Parents', 'Healthcare Workers', 'Farmers', 'General Public'] representing target demographics)\",\n"
        "    \"schedule\": {\n"
        "      \"time\": \"String (e.g. 09:00 AM, 02:30 PM)\",\n"
        "      \"day\": \"String (e.g. Tomorrow, Wednesday, Next Monday)\",\n"
        "      \"reason\": \"String - Briefly explain why this sending time is recommended for this demographic\"\n"
        "    }\n"
        "  },\n"
        "  \"kpis\": {\n"
        "    \"expected_reach_pct\": \"Integer between 1 and 100 - Estimated percentage of reachable members in segment\",\n"
        "    \"ctr_goal_pct\": \"Integer between 1 and 100 - Targeted Click-Through Rate or action response rate\",\n"
        "    \"delivery_goal_pct\": \"Integer between 1 and 100 - Targeted successful delivery percentage\",\n"
        "    \"awareness_goal_description\": \"String - Measurable goal statement\"\n"
        "  },\n"
        "  \"risks\": \"Array of objects. Each object has: {'severity': 'warning' | 'info' | 'error', 'message': 'String'}. Audit the drafted copy for length, missing emergency details, lack of local translation hints, or spelling/formatting issues.\",\n"
        "  \"metadata\": {\n"
        "    \"confidence\": \"Float between 0.0 and 1.0 (e.g. 0.95)\",\n"
        "    \"reasoning\": {\n"
        "      \"campaign_type\": \"Why this category was chosen\",\n"
        "      \"channels\": \"Why these delivery channels are recommended\"\n"
        "    },\n"
        "    \"suggestions\": \"Array of strings - Actionable advice (e.g. 'Translate to Punjabi', 'Add helpline phone number')\"\n"
        "  }\n"
        "}\n"
        "CRITICAL REQUIREMENT: Preserving Placeholders\n"
        "Do NOT translate, modify, or remove placeholder tags in double braces like {{first_name}} or {{city}}.\n"
        "Do NOT escape non-English characters with unicode escapes (like \\u093f). Output raw UTF-8 characters (e.g. write 'प्रिय' and 'स्थिति' directly in Hindi) inside the JSON string."
    )

    user_content = f"Campaign Brief: {brief}\nCategory Hint: {category_mapped}"

    result = _call_groq(system_prompt, user_content, temperature=0.25, max_tokens=1800)

    if not result:
        return {"error": "AI service is currently unavailable. Please try again later."}

    try:
        cleaned = _clean_json_string(result)

        parsed = json.loads(cleaned)
        if "campaign" in parsed and "campaign_type" in parsed["campaign"]:
            ctype = parsed["campaign"]["campaign_type"]
            if ctype not in valid_types:
                parsed["campaign"]["campaign_type"] = category_mapped
        else:
            if "campaign" not in parsed:
                parsed["campaign"] = {}
            parsed["campaign"]["campaign_type"] = category_mapped

        return parsed
    except Exception as e:
        logger.error(f"[AI] Error parsing JSON campaign plan: {e}. Output was: {result}")
        return {
            "error": "Failed to parse AI response as valid campaign JSON structure. Please try again.",
            "raw_output": result
        }


# ---------------------------------------------------------------------------
# 7. refine_campaign_plan
# ---------------------------------------------------------------------------
def refine_campaign_plan(current_plan_str: str, instruction: str) -> dict:
    """
    Refine an existing campaign plan based on an instruction (e.g., shorten body, change tone, translate).
    Returns a modified structured JSON campaign plan.
    """
    import json

    system_prompt = (
        "You are an expert Government Campaign Planner and Copywriter.\n"
        "You are given a current campaign plan in JSON format, and a refinement instruction.\n"
        "Your task is to modify the relevant parts of the JSON object (e.g. shortening the body text, changing its tone, adjusting KPIs, or altering suggested channels) to fulfill the instruction.\n"
        "Keep other fields unchanged unless they are contextually affected by the instruction.\n"
        "You MUST return a JSON object ONLY matching the same structure. Do not wrap in markdown fences (like ```json), write notes, or introduce your text.\n"
        "\n"
        "CRITICAL: Output Devanagari / Hindi text as RAW UTF-8 CHARACTERS (e.g., 'साफ', 'स्थिति', 'स्थानीय'). Do NOT escape them as unicode sequences (do NOT use \\uXXXX or backslashes). Writing unicode escapes leads to spelling errors.\n"
        "\n"
        "Rules:\n"
        "1. campaign_type must remain one of: awareness_drive, emergency_alert, educational_notification, organizational_announcement.\n"
        "2. Do NOT touch, translate, or remove placeholder tags in double braces like {{first_name}} or {{city}}.\n"
        "3. Do NOT escape non-English characters with unicode escapes (like \\u093f). Output raw UTF-8 characters directly in the JSON object."
    )

    user_content = f"Current Plan JSON:\n{current_plan_str}\n\nRefinement Instruction: {instruction}"

    result = _call_groq(system_prompt, user_content, temperature=0.2, max_tokens=1800)

    if not result:
        return {"error": "AI service is currently unavailable. Please try again later."}

    print(f"[AI] Raw Groq response: {result}")
    try:
        cleaned = _clean_json_string(result)
        print(f"[AI] Cleaned response: {cleaned}")

        parsed = json.loads(cleaned)
        return parsed
    except Exception as e:
        logger.error(f"[AI] Error parsing refined JSON plan: {e}. Output was: {result}")
        return {
            "error": "Failed to parse refined AI response as a valid campaign JSON structure.",
            "raw_output": result
        }


def auto_tag_audience(db, audience_id: str) -> list:
    """Analyze audience profile demographics and review feedback comments to suggest tags using LLM."""
    from app.models import Audience, CampaignFeedback
    import json
    import re

    aud = db.query(Audience).filter(Audience.id == audience_id).first()
    if not aud:
        return []

    # Get all feedback reviews submitted by this audience member
    feedbacks = db.query(CampaignFeedback).filter(CampaignFeedback.user_id == aud.id).all()
    feedback_text = ""
    if feedbacks:
        feedback_text = "\n".join([f"- Rated {f.rating}/5 stars for Campaign (Feedback Type: {f.feedback_type}): '{f.comment}'" for f in feedbacks])
    else:
        feedback_text = "No feedback comments submitted yet."

    system_prompt = (
        "You are an AI data classifier for a public communication platform. "
        "Your task is to analyze a citizen's profile and feedback history, "
        "and suggest 2 to 4 concise interest/classification tags (e.g., 'Interested in Agriculture', "
        "'Safety Active', 'Prefers Email', 'Frequent Reviewer', 'High Engagement', 'Needs Support'). "
        "Return the output strictly as a JSON array of strings, without any explanation, code blocks, or preamble. "
        "Example: [\"Interested in Farming\", \"Active Reviewer\"]"
    )

    user_content = (
        f"Citizen Demographics:\n"
        f"- Age: {aud.age}\n"
        f"- Gender: {aud.gender}\n"
        f"- Occupation: {aud.occupation}\n"
        f"- Location: {aud.city}, {aud.district}, {aud.state}\n"
        f"- Preferred Channels: {aud.preferred_channels}\n\n"
        f"Recent Feedback & Alert Reactions:\n"
        f"{feedback_text}"
    )

    tags_str = _call_groq(system_prompt, user_content, temperature=0.1, max_tokens=100)
    if not tags_str:
        # Fallback tags if Groq fails or API key is not set
        fallback_tags = ["General Audience"]
        if aud.occupation:
            fallback_tags.append(f"Interested in {aud.occupation}")
        if feedbacks:
            fallback_tags.append("Active Contributor")
        return fallback_tags

    try:
        match = re.search(r'\[.*\]', tags_str, re.DOTALL)
        if match:
            tags = json.loads(match.group(0))
        else:
            tags = json.loads(tags_str)
        if isinstance(tags, list):
            return [str(t).strip() for t in tags]
    except Exception:
        pass

    fallback_tags = ["General Audience"]
    if aud.occupation:
        fallback_tags.append(f"Interested in {aud.occupation}")
    return fallback_tags


def draft_emergency_response(subject: str, message: str, urgency: str) -> str:
    """Generate an AI-assisted response to a citizen emergency message using Groq."""
    system_prompt = (
        "You are an AI assistant for a government and community emergency response desk. "
        "Your task is to write a helpful, reassuring, clear, and action-oriented response "
        "to a citizen who has reported an emergency or urgent situation. "
        "Keep the response concise (max 3-4 sentences), highly professional, and informative. "
        "Do NOT use any emojis. "
        "Only return the exact message body. Do NOT include greetings like 'Dear citizen', "
        "closing sign-offs, or introductions like 'Here is the response'."
    )
    user_content = f"Urgency: {urgency}\nSubject: {subject}\nMessage: {message}"

    draft = _call_groq(system_prompt, user_content, temperature=0.3, max_tokens=300)
    if draft:
        return draft.strip()

    # Dynamic fallback drafts if Groq is unavailable
    if urgency == "critical" or urgency == "urgent":
        return f"Thank you for reporting this issue. We have flagged this report as {urgency.upper()} priority. Our emergency response team has been notified and is looking into the situation. Please stay safe and follow active safety protocols in your area."
    return "Thank you for sharing this feedback. We have acknowledged your report and regional operators are reviewing the details. We will update you as soon as action is taken."


