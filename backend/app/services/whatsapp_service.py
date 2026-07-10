"""
Real WhatsApp Delivery Service using CallMeBot API.

Free API — no sign-up, no monthly fees, no API key from us.
Each recipient needs to send a one-time activation message to CallMeBot:
  1. Save +34 644 71 81 84 in contacts as "CallMeBot"
  2. Send "I allow callmebot to send me messages" via WhatsApp
  3. They receive an API key — store it in audience custom_fields["callmebot_apikey"]

API docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
"""

import logging
import urllib.parse
import urllib.request
import urllib.error
from typing import Tuple

from app.config import settings

logger = logging.getLogger("commai.whatsapp")

CALLMEBOT_API_URL = "https://api.callmebot.com/whatsapp.php"


def format_phone_number(phone: str, country_code: str = None) -> str:
    """
    Format a phone number to international format (no + prefix, just digits).
    
    Examples:
        "9876543210" with country_code "91" → "919876543210"
        "+919876543210" → "919876543210"
        "919876543210" → "919876543210"
    """
    # Strip all non-digit characters
    digits = "".join(filter(str.isdigit, phone))

    # Use configured default country code if not already prefixed
    if country_code is None:
        country_code = settings.DEFAULT_COUNTRY_CODE

    # If number is 10 digits (no country code), prepend it
    if len(digits) == 10:
        digits = country_code + digits

    return digits


def send_whatsapp(phone: str, message: str, apikey: str = None) -> Tuple[bool, str]:
    """
    Send WhatsApp message using CallMeBot API.
    If no API key is configured, falls back to console logging (mock delivery).
    """
    import requests

    # Use default key if none provided
    if not apikey:
        apikey = settings.CALLMEBOT_DEFAULT_APIKEY

    if not apikey:
        logger.info(f"[WHATSAPP MOCK] To: {phone} | Message: {message[:100]}...")
        return True, "delivered_mock"

    try:
        formatted_phone = format_phone_number(phone)
        payload = {
            "phone": "+" + formatted_phone,
            "text": message,
            "apikey": apikey
        }
        
        logger.info(f"[WHATSAPP] Dispatching message via CallMeBot to {formatted_phone}...")
        
        # CallMeBot sends messages via HTTP GET
        response = requests.get(CALLMEBOT_API_URL, params=payload, timeout=15)
        
        if response.status_code == 200:
            logger.info(f"[WHATSAPP] Successfully sent to {formatted_phone}")
            return True, ""
        else:
            error_msg = f"CallMeBot responded with status code {response.status_code}: {response.text}"
            logger.error(f"[WHATSAPP] Delivery failed: {error_msg}")
            return False, error_msg

    except Exception as e:
        error_msg = f"Connection error: {str(e)}"
        logger.error(f"[WHATSAPP] CallMeBot API error: {error_msg}", exc_info=True)
        return False, error_msg



def test_whatsapp_connection(phone: str, apikey: str = None) -> Tuple[bool, str]:
    """
    Send a test WhatsApp message to verify the integration works.

    Args:
        phone: Test recipient phone number
        apikey: CallMeBot API key (uses default if not provided)

    Returns:
        Tuple of (success, message)
    """
    test_message = "✅ CommAI WhatsApp Integration Test — This message confirms your WhatsApp channel is working correctly!"
    success, error = send_whatsapp(phone, test_message, apikey)

    if success:
        if error == "delivered_mock":
            return True, "Mock delivery — No CallMeBot API key configured. Set up CallMeBot to enable real WhatsApp delivery."
        return True, f"Test message sent successfully to {format_phone_number(phone)}"
    else:
        return False, f"Test failed: {error}"
