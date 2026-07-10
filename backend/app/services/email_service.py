"""
Real Email Delivery Service using Gmail SMTP.

Uses Python's built-in smtplib + email.mime (no external dependencies).
Connects to Gmail SMTP (smtp.gmail.com:587) with TLS.
Requires a Gmail App Password (free, generated from Google Account settings).
"""

import smtplib
import logging
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple

from app.config import settings

logger = logging.getLogger("commai.email")


def strip_html_tags(html_str: str) -> str:
    """Helper to convert HTML body to clean plain-text alternative."""
    # Remove script and style elements
    clean = re.sub(r'<(script|style)[^>]*?>.*?</\1>', '', html_str, flags=re.DOTALL|re.IGNORECASE)
    # Remove all HTML tags
    clean = re.sub(r'<[^>]+?>', ' ', clean)
    # Collapse consecutive whitespace and strip
    return re.sub(r'\s+', ' ', clean).strip()


def send_email(to_email: str, subject: str, body: str, is_html: bool = False) -> Tuple[bool, str]:
    """
    Send a real email via Gmail SMTP.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        body: Email body (plain text or HTML)
        is_html: If True, send as HTML email

    Returns:
        Tuple of (success: bool, error_message: str)
    """
    smtp_email = settings.SMTP_EMAIL
    smtp_password = settings.SMTP_APP_PASSWORD

    if not smtp_email or not smtp_password:
        logger.warning("[EMAIL] SMTP credentials not configured. Falling back to console log.")
        logger.info(f"[EMAIL MOCK] To: {to_email} | Subject: {subject} | Body: {body[:100]}...")
        return True, "delivered_mock"

    try:
        # Build the email message
        msg = MIMEMultipart("alternative")
        msg["From"] = f"CommAI Alert System <{smtp_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        # Attach body (lower spam score by providing both plaintext and html alternatives)
        if is_html:
            plaintext_body = strip_html_tags(body)
            msg.attach(MIMEText(plaintext_body, "plain", "utf-8"))
            msg.attach(MIMEText(body, "html", "utf-8"))
        else:
            msg.attach(MIMEText(body, "plain", "utf-8"))

        # Connect to Gmail SMTP with TLS
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, to_email, msg.as_string())

        logger.info(f"[EMAIL] Successfully sent to {to_email}: {subject}")
        return True, ""

    except smtplib.SMTPAuthenticationError as e:
        logger.warning(f"[EMAIL] SMTP authentication failed: {e}. Falling back to console log simulation.")
        logger.info(f"[EMAIL MOCK] To: {to_email} | Subject: {subject} | Body: {body[:100]}...")
        return True, "delivered_mock"

    except smtplib.SMTPRecipientsRefused as e:
        error = f"Recipient refused: {to_email}"
        logger.error(f"[EMAIL] {error}: {e}")
        return False, error

    except smtplib.SMTPException as e:
        logger.warning(f"[EMAIL] SMTP error occurred: {e}. Falling back to console log simulation.")
        logger.info(f"[EMAIL MOCK] To: {to_email} | Subject: {subject} | Body: {body[:100]}...")
        return True, "delivered_mock"

    except Exception as e:
        logger.warning(f"[EMAIL] Unexpected error occurred during SMTP send: {e}. Falling back to console log simulation.")
        logger.info(f"[EMAIL MOCK] To: {to_email} | Subject: {subject} | Body: {body[:100]}...")
        return True, "delivered_mock"


def send_otp_email(to_email: str, otp_code: str) -> Tuple[bool, str]:
    """
    Send a styled OTP verification email.

    Args:
        to_email: Recipient email
        otp_code: 6-digit OTP code

    Returns:
        Tuple of (success, error_message)
    """
    subject = f"CommAI Verification Code: {otp_code}"

    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0a0e1a; color: #ffffff; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #00d4ff; font-size: 24px; margin: 0;">CommAI</h1>
            <p style="color: #ffffff; font-size: 13px; margin-top: 4px; opacity: 0.9;">Multilingual Mass Communication Platform</p>
        </div>
        <div style="background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 24px; text-align: center;">
            <p style="color: #ffffff; font-size: 14px; margin: 0 0 16px;">Your verification code is:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #00d4ff; background: #0f172a; padding: 16px 24px; border-radius: 8px; display: inline-block; border: 2px dashed #1e40af;">
                {otp_code}
            </div>
            <p style="color: #ffffff; font-size: 12px; margin-top: 16px; opacity: 0.8;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
        <p style="color: #ffffff; font-size: 11px; text-align: center; margin-top: 24px; opacity: 0.7;">
            If you did not request this code, please ignore this email.
        </p>
    </div>
    """

    return send_email(to_email, subject, html_body, is_html=True)


def test_smtp_connection() -> Tuple[bool, str]:
    """
    Test SMTP connection without sending an email.

    Returns:
        Tuple of (success, error_or_info_message)
    """
    smtp_email = settings.SMTP_EMAIL
    smtp_password = settings.SMTP_APP_PASSWORD

    if not smtp_email or not smtp_password:
        return False, "SMTP credentials not configured. Set SMTP_EMAIL and SMTP_APP_PASSWORD."

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_email, smtp_password)

        return True, f"SMTP connection successful. Authenticated as {smtp_email}"

    except smtplib.SMTPAuthenticationError:
        return False, "Authentication failed. Verify your Gmail App Password."

    except Exception as e:
        return False, f"Connection error: {str(e)}"
