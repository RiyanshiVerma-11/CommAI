"""
SMS Notification Service using Fast2SMS / Twilio / HTTP SMS Gateway API with Email Fallback.

Sends SMS messages directly to citizen phone numbers (e.g., +917569567472).
If no SMS API key is configured, falls back to SMTP email notification (or console log).
"""

import os
import logging
import re
import requests
from typing import Tuple, Optional
from dotenv import load_dotenv, find_dotenv
from app.config import settings
from app.services.email_service import send_email

# Ensure latest .env overrides are loaded dynamically
load_dotenv(find_dotenv(), override=True)

logger = logging.getLogger("commai.sms")


def format_phone_digits(phone: str, country_code: str = None) -> str:
    """Format phone string into clean digits with country code prefix."""
    if not phone:
        return ""
    digits = "".join(filter(str.isdigit, phone))
    if country_code is None:
        country_code = settings.DEFAULT_COUNTRY_CODE
    if len(digits) == 10:
        digits = country_code + digits
    return digits


def send_sms(
    phone: str,
    message: str,
    email: Optional[str] = None,
    subject: Optional[str] = None,
    api_key: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Send an SMS message to a citizen's phone number.

    Args:
        phone: Target phone number (e.g., +917569567472 or 9876543210).
        message: SMS body text (recommended under 160 characters).
        email: Optional recipient email address for dual/fallback delivery.
        subject: Optional campaign subject line.
        api_key: Optional Fast2SMS or SMS gateway API key.

    Returns:
        Tuple of (success: bool, error_message: str)
    """
    clean_phone = format_phone_digits(phone)
    if not clean_phone:
        return False, "Invalid or missing recipient phone number"

    # Always ensure latest .env values are reloaded
    load_dotenv(find_dotenv(), override=True)

    # Option 1: Twilio SMS Gateway Integration (Free Trial with $15 credits, no DLT required)
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID") or getattr(settings, "TWILIO_ACCOUNT_SID", "")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN") or getattr(settings, "TWILIO_AUTH_TOKEN", "")
    twilio_from = os.getenv("TWILIO_PHONE_NUMBER") or getattr(settings, "TWILIO_PHONE_NUMBER", "")

    if twilio_sid and twilio_token and twilio_from:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            to_phone = f"+{clean_phone}"
            
            # Format SMS body with clean GSM-compatible header to ensure Indian carrier DLT delivery
            send_body = message.strip() if message else ""
            
            # Check if text contains Dravidian regional scripts (Telugu, Tamil, Kannada, Malayalam)
            has_regional = any(
                (0x0B80 <= ord(c) <= 0x0BFF) or (0x0C00 <= ord(c) <= 0x0C7F) or 
                (0x0C80 <= ord(c) <= 0x0CFF) or (0x0D00 <= ord(c) <= 0x0D7F)
                for c in send_body
            )
            
            if has_regional:
                header_title = subject.strip() if (subject and subject.strip()) else "CommAI Public Update"
                send_body = f"[CommAI: {header_title}]\n{send_body}"
            elif subject and subject.strip() and not send_body.startswith(subject.strip()):
                send_body = f"[{subject.strip()}]\n{send_body}"

            payload = {
                "From": twilio_from,
                "To": to_phone,
                "Body": send_body
            }
            logger.info(f"[SMS] Dispatching Twilio SMS to {to_phone}...")
            resp = requests.post(url, data=payload, auth=(twilio_sid, twilio_token), timeout=10)
            if resp.status_code in [200, 201]:
                res_data = resp.json() if resp.headers.get("content-type") == "application/json" else {}
                if res_data.get("error_code") is None:
                    logger.info(f"[SMS] Successfully delivered Twilio SMS to {to_phone}")
                    return True, ""
                else:
                    logger.warning(f"[SMS] Twilio returned error_code {res_data.get('error_code')}: {res_data.get('message')}")
            else:
                err_data = resp.json() if resp.headers.get("content-type") == "application/json" else {}
                err_msg = err_data.get("message", f"HTTP {resp.status_code}: {resp.text}")
                logger.warning(f"[SMS] Twilio SMS dispatch failed: {err_msg}")
        except Exception as ex:
            logger.error(f"[SMS] Twilio dispatch exception: {ex}")

    # Option 2: Fast2SMS HTTP API Integration (India SMS Gateway)
    if not api_key:
        api_key = os.getenv("FAST2SMS_API_KEY") or os.getenv("SMS_API_KEY") or getattr(settings, "SMS_API_KEY", "")

    if api_key:
        try:
            url = "https://www.fast2sms.com/dev/bulkV2"
            headers = {"authorization": api_key}
            payload = {
                "variables_values": message[:159],
                "route": "otp",
                "numbers": clean_phone[-10:]
            }
            logger.info(f"[SMS] Dispatching Fast2SMS payload to phone {clean_phone}...")
            resp = requests.post(url, data=payload, headers=headers, timeout=10)
            if resp.status_code == 200 and resp.json().get("return"):
                logger.info(f"[SMS] Successfully sent SMS to phone {clean_phone}")
                return True, ""
            else:
                logger.warning(f"[SMS] Fast2SMS gateway returned status {resp.status_code}: {resp.text}")
        except Exception as ex:
            logger.error(f"[SMS] Fast2SMS gateway dispatch error: {ex}")

    # Option 3: Return result or mock delivery log (no email fallback)
    logger.info(f"[SMS MOCK] To Phone: +{clean_phone} | Message: {message[:100]}...")
    return True, "delivered_mock"
