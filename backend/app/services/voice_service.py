"""
Indic AI Voice Bulletin Service — Speech Synthesis & Indic Language Engine.

Supports 22 official scheduled Indian languages + English (23 total).
Uses gTTS (Google Text-to-Speech) for natural spoken audio bulletins
and caches synthesized MP3 files for zero-latency streaming.
"""

import os
import io
import hashlib
import logging
from typing import Tuple, Dict, Any, List
from gtts import gTTS

from app.services.translation_service import translate_text
from app.config import settings

logger = logging.getLogger("commai.voice")

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "audio_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

SUPPORTED_LANGUAGES: Dict[str, Dict[str, str]] = {
    "hi": {"name": "Hindi", "native": "हिंदी", "flag": "🇮🇳", "gtts_code": "hi"},
    "en": {"name": "English", "native": "English", "flag": "🇬🇧", "gtts_code": "en"},
    "bn": {"name": "Bengali", "native": "বাংলা", "flag": "🇮🇳", "gtts_code": "bn"},
    "ta": {"name": "Tamil", "native": "தமிழ்", "flag": "🇮🇳", "gtts_code": "ta"},
    "te": {"name": "Telugu", "native": "తెలుగు", "flag": "🇮🇳", "gtts_code": "te"},
    "mr": {"name": "Marathi", "native": "मराठी", "flag": "🇮🇳", "gtts_code": "mr"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "flag": "🇮🇳", "gtts_code": "gu"},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "flag": "🇮🇳", "gtts_code": "pa"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "flag": "🇮🇳", "gtts_code": "kn"},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "flag": "🇮🇳", "gtts_code": "ml"},
    "or": {"name": "Odia", "native": "ଓଡ଼ିଆ", "flag": "🇮🇳", "gtts_code": "or"},
    "as": {"name": "Assamese", "native": "অসমীয়া", "flag": "🇮🇳", "gtts_code": "bn"},
    "ur": {"name": "Urdu", "native": "اردو", "flag": "🇮🇳", "gtts_code": "ur"},
    "mai": {"name": "Maithili", "native": "मैथिली", "flag": "🇮🇳", "gtts_code": "hi"},
    "sat": {"name": "Santali", "native": "संथाली", "flag": "🇮🇳", "gtts_code": "hi"},
    "ks": {"name": "Kashmiri", "native": "कॉशुर", "flag": "🇮🇳", "gtts_code": "ur"},
    "ne": {"name": "Nepali", "native": "नेपाली", "flag": "🇮🇳", "gtts_code": "ne"},
    "kok": {"name": "Konkani", "native": "कोंकणी", "flag": "🇮🇳", "gtts_code": "mr"},
    "sd": {"name": "Sindhi", "native": "सिंधी", "flag": "🇮🇳", "gtts_code": "sd"},
    "doi": {"name": "Dogri", "native": "डोगरी", "flag": "🇮🇳", "gtts_code": "hi"},
    "mni": {"name": "Manipuri (Meitei)", "native": "मणिपुरी", "flag": "🇮🇳", "gtts_code": "bn"},
    "brx": {"name": "Bodo", "native": "बोडो", "flag": "🇮🇳", "gtts_code": "hi"},
    "sa": {"name": "Sanskrit", "native": "संस्कृतम्", "flag": "🇮🇳", "gtts_code": "hi"},
}


def get_supported_languages() -> List[Dict[str, str]]:
    """Return list of all 23 supported Indic languages."""
    return [
        {
            "code": code,
            "name": info["name"],
            "native": info["native"],
            "flag": info["flag"],
        }
        for code, info in SUPPORTED_LANGUAGES.items()
    ]


def normalize_lang_code(lang_input: str) -> str:
    """Resolve language input (code or name) to normalized language code."""
    if not lang_input:
        return "hi"
    clean = lang_input.strip().lower()
    if clean in SUPPORTED_LANGUAGES:
        return clean
    for code, info in SUPPORTED_LANGUAGES.items():
        if info["name"].lower() == clean or info["native"].lower() == clean:
            return code
    return "hi"


def synthesize_voice_bulletin(
    text: str,
    target_lang: str = "hi",
    slow: bool = False,
    source_lang: str = "en"
) -> Tuple[str, str, str]:
    """
    Synthesize spoken audio for a bulletin text.
    
    1. Resolves target language code.
    2. Translates text to target language if required.
    3. Synthesizes MP3 speech audio via gTTS.
    4. Caches file in static/audio_cache.
    
    Returns: (audio_filename, translated_text, resolved_lang_code)
    """
    if not text or not text.strip():
        raise ValueError("Cannot synthesize audio for empty text.")

    lang_code = normalize_lang_code(target_lang)
    lang_info = SUPPORTED_LANGUAGES.get(lang_code, SUPPORTED_LANGUAGES["hi"])
    gtts_lang = lang_info["gtts_code"]

    # Translate text if target language is different from source
    translated_text = text
    if lang_code != source_lang and lang_code != "en" and settings.GROQ_API_KEY:
        try:
            t = translate_text(text, target_language=lang_info["name"], source_language=source_lang)
            if t and t.strip():
                translated_text = t
        except Exception as e:
            logger.warning(f"[VOICE] Translation fallback used due to error: {e}")

    # Generate cache key
    text_hash = hashlib.md5(f"{translated_text}_{lang_code}_{slow}".encode("utf-8")).hexdigest()
    filename = f"bulletin_{lang_code}_{text_hash[:12]}.mp3"
    filepath = os.path.join(CACHE_DIR, filename)

    # Return cached audio file if present
    if not os.path.exists(filepath):
        logger.info(f"[VOICE] Synthesizing speech for language '{lang_info['name']}' ({lang_code})...")
        try:
            tts = gTTS(text=translated_text, lang=gtts_lang, slow=slow)
            tts.save(filepath)
        except Exception as ex:
            logger.error(f"[VOICE] gTTS synthesis error for {lang_code}: {ex}")
            # Fallback to English synthesis if gTTS fails for specific Indic dialect code
            tts = gTTS(text=translated_text, lang="hi" if lang_code != "en" else "en", slow=slow)
            tts.save(filepath)

    return filename, translated_text, lang_code
