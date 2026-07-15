"""
Campaign Dispatcher — The Real Delivery Engine.

When a campaign transitions to 'active', this module:
1. Loads the campaign's segment → resolves audience members
2. Loads the template → interpolates placeholders per audience member
3. For each audience × channel, dispatches via the appropriate service
4. Tracks delivery status in DeliveryLog
5. Updates campaign sent/failed counts

Runs in a background thread so the API returns immediately.
"""

import json
import re
import logging
import datetime
import threading
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Campaign, Segment, Audience, Template, DeliveryLog
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp
from app.routes.audience import build_segment_filter_query
from app.config import settings


logger = logging.getLogger("commai.dispatcher")


def interpolate_template(template_text: str, audience: Audience) -> str:
    """
    Replace {placeholder} variables in a template with audience member data.
    
    Supports both {variable} and {{variable}} syntax.
    """
    if not template_text:
        return ""

    replacements = {
        "first_name": audience.first_name or "",
        "last_name": audience.last_name or "",
        "email": audience.email or "",
        "phone": audience.phone or "",
        "city": audience.city or "",
        "district": audience.district or "",
        "state": audience.state or "",
        "occupation": audience.occupation or "",
        "age": str(audience.age) if audience.age else "",
        "gender": audience.gender or "",
        "organization": audience.organization or "",
        "department": audience.department or "",
        "designation": audience.designation or "",
    }

    result = template_text
    for key, value in replacements.items():
        # Replace both {key} and {{key}} formats
        result = result.replace(f"{{{{{key}}}}}", value)
        result = result.replace(f"{{{key}}}", value)

    return result


def resolve_audience_members(db: Session, segment_id: str) -> List[Audience]:
    """
    Get all active, non-deleted audience members matching a segment's filter criteria.
    """
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        return []

    criteria = json.loads(segment.filter_criteria)
    query = db.query(Audience).filter(
        Audience.is_deleted == False,
        Audience.is_active == True
    )
    query = build_segment_filter_query(criteria, query)
    return query.all()


def dispatch_to_channel(
    channel: str,
    audience: Audience,
    subject: str,
    body: str
) -> tuple:
    """
    Dispatch a message to a specific channel for a specific audience member.
    
    Returns (success: bool, error: str, actual_channel: str)
    """
    if channel == "email":
        if not audience.email:
            return False, "No email address on file", "email"
        success, error = send_email(audience.email, subject, body)
        return success, error, "email"

    elif channel == "whatsapp":
        if not audience.phone:
            return False, "No phone number on file", "whatsapp"
        
        # Check for per-recipient CallMeBot API key in custom_fields
        apikey = None
        if audience.custom_fields:
            try:
                custom = json.loads(audience.custom_fields) if isinstance(audience.custom_fields, str) else audience.custom_fields
                apikey = custom.get("callmebot_apikey")
            except (json.JSONDecodeError, AttributeError):
                pass

        success, error = send_whatsapp(audience.phone, body, apikey)
        return success, error, "whatsapp"

    elif channel == "sms":
        # Fallback: Send SMS content as email with [SMS] prefix
        if not audience.email:
            return False, "No email for SMS fallback delivery", "sms"
        sms_subject = f"[SMS ALERT] {subject}"
        sms_body = f"--- SMS Content (delivered via email) ---\n\n{body}\n\n--- Original SMS intended for: {audience.phone} ---"
        success, error = send_email(audience.email, sms_subject, sms_body)
        return success, error, "sms"

    elif channel == "push":
        # Fallback: Send push notification content as email
        if not audience.email:
            return False, "No email for push fallback delivery", "push"
        push_subject = f"🔔 [PUSH] {subject}"
        push_body = f"--- Push Notification ---\n\n{body}\n\n--- This push notification was delivered via email ---"
        success, error = send_email(audience.email, push_subject, push_body)
        return success, error, "push"

    elif channel == "website":
        # Website channel: log-only, no direct delivery target
        logger.info(f"[WEBSITE] Banner content for {audience.first_name}: {body[:80]}...")
        return True, "website_logged", "website"

    else:
        return False, f"Unknown channel: {channel}", channel


def dispatch_campaign(campaign_id: str):
    """
    Execute campaign delivery in a background thread.
    
    This is the main entry point called from the campaign route
    when status transitions to 'active'.
    """
    thread = threading.Thread(
        target=_dispatch_campaign_worker,
        args=(campaign_id,),
        daemon=True,
        name=f"dispatcher-{campaign_id[:8]}"
    )
    thread.start()
    logger.info(f"[DISPATCHER] Started background dispatch for campaign {campaign_id}")


def _dispatch_campaign_worker(campaign_id: str):
    """
    Background worker that performs the actual delivery.
    Uses its own DB session (since we're in a separate thread).
    """
    db = SessionLocal()

    try:
        # 1. Load campaign
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            logger.error(f"[DISPATCHER] Campaign {campaign_id} not found")
            return

        # 2. Load template
        template = db.query(Template).filter(Template.id == campaign.template_id).first()
        if not template:
            logger.error(f"[DISPATCHER] Template not found for campaign {campaign_id}")
            return

        # 3. Resolve audience
        print(f"[DISPATCHER-DEBUG] Campaign ID: {campaign_id}")
        print(f"[DISPATCHER-DEBUG] Segment ID: {campaign.segment_id}")
        segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
        if segment:
            print(f"[DISPATCHER-DEBUG] Segment Name: {segment.name}")
            print(f"[DISPATCHER-DEBUG] Segment Criteria: {segment.filter_criteria}")
        else:
            print(f"[DISPATCHER-DEBUG] Segment NOT found in database!")

        audience_members = resolve_audience_members(db, campaign.segment_id)
        print(f"[DISPATCHER-DEBUG] Resolved audience members count: {len(audience_members)}")
        if not audience_members:
            logger.warning(f"[DISPATCHER] No audience members found for campaign {campaign_id}")
            campaign.dispatched_at = datetime.datetime.utcnow()
            db.commit()
            return

        # 4. Parse campaign channels
        channels = json.loads(campaign.channel_preferences) if campaign.channel_preferences else []
        if not channels:
            logger.error(f"[DISPATCHER] No channels configured for campaign {campaign_id}")
            return

        logger.info(
            f"[DISPATCHER] Campaign '{campaign.title}': "
            f"Sending to {len(audience_members)} members via {channels}"
        )

        # --- Daily Caps Check ---
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        from sqlalchemy import func
        sent_counts_today = db.query(
            DeliveryLog.channel, 
            func.count(DeliveryLog.id)
        ).filter(
            DeliveryLog.status == "sent", 
            DeliveryLog.sent_at >= today_start
        ).group_by(DeliveryLog.channel).all()
        
        sent_today = {channel: count for channel, count in sent_counts_today}
        
        caps = {
            "email": settings.DAILY_CAP_EMAIL,
            "sms": settings.DAILY_CAP_SMS,
            "whatsapp": settings.DAILY_CAP_WHATSAPP
        }
        
        caps_breached = []
        for channel in channels:
            if channel in caps:
                planned_send = 0
                for member in audience_members:
                    pref_ch = []
                    if member.preferred_channels:
                        try:
                            pref_ch = json.loads(member.preferred_channels) if isinstance(member.preferred_channels, str) else member.preferred_channels
                        except Exception:
                            pref_ch = []
                    if not pref_ch or channel in pref_ch:
                        planned_send += 1
                
                already_sent = sent_today.get(channel, 0)
                limit = caps[channel]
                if already_sent + planned_send > limit:
                    caps_breached.append(f"{channel.upper()} (Limit: {limit}, Already Sent: {already_sent}, Planned: {planned_send})")
                    
        if caps_breached:
            logger.error(f"[DISPATCHER] Campaign {campaign_id} aborted due to Daily Send Caps breach: {', '.join(caps_breached)}")
            campaign.status = "failed"
            campaign.failed_count = len(audience_members) * len(channels)
            
            from app.models import AuditLog
            audit = AuditLog(
                user_id="SYSTEM",
                campaign_id=campaign_id,
                action="STATUS_CHANGE",
                old_status="active",
                new_status="failed",
                changes=json.dumps({"reason": f"Daily Send Cap Breached: {', '.join(caps_breached)}"})
            )
            db.add(audit)
            db.commit()
            return

        # Fetch the opt-out blacklist
        from app.models import Blacklist
        blacklist_entries = db.query(Blacklist.value).all()
        blacklist_set = {entry[0].strip().lower() for entry in blacklist_entries}

        # 4.5. Pre-group and pre-translate unique languages to avoid per-recipient API calls
        unique_target_langs = set()
        for member in audience_members:
            pref_langs = []
            if member.preferred_languages:
                try:
                    pref_langs = json.loads(member.preferred_languages) if isinstance(member.preferred_languages, str) else member.preferred_languages
                except Exception:
                    pref_langs = []
            if pref_langs and isinstance(pref_langs, list) and len(pref_langs) > 0:
                primary_lang = pref_langs[0].strip()
                if primary_lang and primary_lang.lower() != template.default_language.strip().lower():
                    unique_target_langs.add(primary_lang)

        # Read template's existing pre-translations from DB
        translations_dict = {}
        if template.translations:
            try:
                translations_dict = json.loads(template.translations) if isinstance(template.translations, str) else template.translations
            except Exception:
                translations_dict = {}

        # Dynamically pre-translate unique languages that are missing from template cache
        dynamic_translations = {}
        for target_lang in unique_target_langs:
            if target_lang not in translations_dict and settings.GROQ_API_KEY:
                try:
                    logger.info(f"[DISPATCHER] Pre-translating campaign template for target language '{target_lang}' to prevent loop rate-limiting...")
                    from app.services.translation_service import translate_text
                    t_subject = ""
                    if template.subject_template:
                        t_subject = translate_text(template.subject_template, target_lang, template.default_language)
                    t_body = translate_text(template.body_template, target_lang, template.default_language)
                    
                    if t_body and t_body.strip() != template.body_template.strip():
                        dynamic_translations[target_lang] = {
                            "subject": t_subject,
                            "body": t_body
                        }
                except Exception as ex:
                    logger.error(f"[DISPATCHER] Failed dynamic pre-translation for '{target_lang}': {ex}")

        sent_count = 0
        failed_count = 0

        # 5. Dispatch to each audience member × channel
        for member in audience_members:
            # Check blacklist
            is_blacklisted = False
            if member.email and member.email.strip().lower() in blacklist_set:
                is_blacklisted = True
            if member.phone and member.phone.strip().lower() in blacklist_set:
                is_blacklisted = True
                
            if is_blacklisted:
                logger.info(f"[DISPATCHER] Skipping dispatch for {member.first_name} {member.last_name} due to opt-out blacklist")
                for channel in channels:
                    log = DeliveryLog(
                        campaign_id=campaign_id,
                        audience_id=member.id,
                        channel=channel,
                        status="failed",
                        recipient_info=member.email if channel in ["email", "sms", "push"] else member.phone,
                        error_message="Recipient has opted out (blacklisted)",
                        sent_at=datetime.datetime.utcnow()
                    )
                    db.add(log)
                    failed_count += 1
                continue

            # Interpolate template for this member
            subject = interpolate_template(template.subject_template, member)
            body = interpolate_template(template.body_template, member)

            # Resolve recipient preferred languages
            pref_langs = []
            if member.preferred_languages:
                try:
                    pref_langs = json.loads(member.preferred_languages) if isinstance(member.preferred_languages, str) else member.preferred_languages
                except Exception:
                    pref_langs = []

            # Determine target translation language
            target_lang = None
            if pref_langs and isinstance(pref_langs, list) and len(pref_langs) > 0:
                primary_lang = pref_langs[0]
                if primary_lang and primary_lang.strip().lower() != template.default_language.strip().lower():
                    target_lang = primary_lang.strip()

            subject_to_send = subject
            body_to_send = body

            # Look up translation in template cache or dynamic pre-cache
            translated_subject_raw = None
            translated_body_raw = None

            if target_lang:
                if target_lang in translations_dict:
                    translated_subject_raw = translations_dict[target_lang].get("subject", "")
                    translated_body_raw = translations_dict[target_lang].get("body", "")
                elif target_lang in dynamic_translations:
                    translated_subject_raw = dynamic_translations[target_lang].get("subject", "")
                    translated_body_raw = dynamic_translations[target_lang].get("body", "")

            if translated_body_raw:
                subject_to_send = interpolate_template(translated_subject_raw, member)
                body_to_send = interpolate_template(translated_body_raw, member)
                logger.info(f"[DISPATCHER] Used pre-generated or pre-cached translation for {member.first_name} {member.last_name} in {target_lang}")

            for channel in channels:
                # Check if member has this channel in their preferences
                member_channels = []
                try:
                    member_channels = json.loads(member.preferred_channels) if member.preferred_channels else []
                except (json.JSONDecodeError, TypeError):
                    member_channels = []

                success, error, actual_channel = dispatch_to_channel(
                    channel, member, subject_to_send, body_to_send
                )

                # Log the delivery
                log = DeliveryLog(
                    campaign_id=campaign_id,
                    audience_id=member.id,
                    channel=actual_channel,
                    status="sent" if success else "failed",
                    recipient_info=member.email if channel in ["email", "sms", "push"] else member.phone,
                    error_message=error if not success else None,
                    sent_at=datetime.datetime.utcnow()
                )
                db.add(log)

                if success:
                    sent_count += 1
                else:
                    failed_count += 1

        # 6. Update campaign counters
        campaign.sent_count = sent_count
        campaign.failed_count = failed_count
        campaign.dispatched_at = datetime.datetime.utcnow()

        # Auto-mark as completed after dispatch
        if sent_count > 0:
            campaign.status = "completed"

        db.commit()

        logger.info(
            f"[DISPATCHER] Campaign '{campaign.title}' complete: "
            f"{sent_count} sent, {failed_count} failed"
        )

    except Exception as e:
        logger.error(f"[DISPATCHER] Fatal error in campaign {campaign_id}: {e}", exc_info=True)
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.failed_count = -1  # Signal error
                db.commit()
        except Exception:
            pass

    finally:
        db.close()
