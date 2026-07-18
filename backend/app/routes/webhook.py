"""
Webhook Routes — Two-way citizen communication via RAG-powered auto-replies.
Handles inbound citizen messages and generates contextual responses.
"""
import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models import Audience, CitizenMessage
from app.auth import require_any_authenticated, require_manager_or_higher
from app.services.rag_service import generate_rag_response, populate_knowledge_base

logger = logging.getLogger("commai.webhook")

router = APIRouter(prefix="/webhook", tags=["Citizen Webhooks"])


class CitizenMessageRequest(BaseModel):
    audience_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: str = "whatsapp"
    content: str

    @validator("content")
    def content_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Message content cannot be empty")
        return v.strip()


class CitizenMessageResponse(BaseModel):
    id: str
    audience_id: str
    audience_name: str
    direction: str
    channel: str
    content: str
    auto_reply: Optional[str] = None
    created_at: str


@router.post("/citizen-reply", response_model=CitizenMessageResponse)
def receive_citizen_message(
    request: CitizenMessageRequest,
    db: Session = Depends(get_db),
):
    """
    Receive an inbound citizen message (from SMS/WhatsApp gateway callback),
    run RAG pipeline, store the message and auto-reply.
    """
    # Resolve the audience member
    audience = None
    if request.audience_id:
        audience = db.query(Audience).filter(
            Audience.id == request.audience_id,
            Audience.is_deleted == False
        ).first()
    elif request.phone:
        audience = db.query(Audience).filter(
            Audience.phone == request.phone,
            Audience.is_deleted == False
        ).first()
    elif request.email:
        audience = db.query(Audience).filter(
            Audience.email == request.email,
            Audience.is_deleted == False
        ).first()

    if not audience:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audience member not found. Register first."
        )

    # Ensure knowledge base is populated
    populate_knowledge_base(db)

    # Generate RAG response
    auto_reply = generate_rag_response(request.content, db)

    # Store inbound message
    inbound = CitizenMessage(
        audience_id=audience.id,
        direction="inbound",
        channel=request.channel,
        content=request.content,
    )
    db.add(inbound)

    # Store outbound auto-reply
    outbound = CitizenMessage(
        audience_id=audience.id,
        direction="outbound",
        channel=request.channel,
        content=auto_reply,
    )
    db.add(outbound)
    db.commit()
    db.refresh(inbound)

    return CitizenMessageResponse(
        id=inbound.id,
        audience_id=audience.id,
        audience_name=f"{audience.first_name} {audience.last_name}",
        direction="inbound",
        channel=request.channel,
        content=request.content,
        auto_reply=auto_reply,
        created_at=inbound.created_at.isoformat(),
    )


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_higher),
):
    """List all citizen conversations grouped by audience member (manager/admin view)."""
    from sqlalchemy import func

    # Get distinct audience IDs with message counts
    convos = (
        db.query(
            CitizenMessage.audience_id,
            func.count(CitizenMessage.id).label("message_count"),
            func.max(CitizenMessage.created_at).label("last_message_at"),
        )
        .group_by(CitizenMessage.audience_id)
        .order_by(func.max(CitizenMessage.created_at).desc())
        .all()
    )

    result = []
    for aud_id, msg_count, last_at in convos:
        aud = db.query(Audience).filter(Audience.id == aud_id).first()
        if aud:
            result.append({
                "audience_id": aud_id,
                "audience_name": f"{aud.first_name} {aud.last_name}",
                "phone": aud.phone,
                "email": aud.email,
                "state": aud.state,
                "city": aud.city,
                "message_count": msg_count,
                "last_message_at": last_at.isoformat() if last_at else None,
            })

    return result


@router.get("/conversations/{audience_id}")
def get_conversation_thread(
    audience_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_authenticated),
):
    """Get the full conversation thread for a specific audience member."""
    messages = (
        db.query(CitizenMessage)
        .filter(CitizenMessage.audience_id == audience_id)
        .order_by(CitizenMessage.created_at.asc())
        .all()
    )

    aud = db.query(Audience).filter(Audience.id == audience_id).first()
    aud_name = f"{aud.first_name} {aud.last_name}" if aud else "Unknown"

    return {
        "audience_id": audience_id,
        "audience_name": aud_name,
        "messages": [
            {
                "id": m.id,
                "direction": m.direction,
                "channel": m.channel,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }
