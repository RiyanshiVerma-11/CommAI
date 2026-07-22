from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from app.database import get_db
from app.models import User, OperatorMessage
from app.schemas import OperatorMessageCreate, OperatorMessageResponse
from app.auth import require_manager_or_higher

router = APIRouter(prefix="/operator-chat", tags=["Operator Staff Chat"])

@router.get("/messages", response_model=List[OperatorMessageResponse])
def get_operator_messages(
    channel: Optional[str] = Query(default="general"),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_higher),
):
    """
    Fetch chat messages for internal staff/operator coordination.
    STRICTLY restricted to Admins and Campaign Managers only.
    Audience users receive 403 Forbidden.
    """
    messages = (
        db.query(OperatorMessage)
        .filter(OperatorMessage.channel == channel)
        .order_by(OperatorMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return messages

@router.post("/messages", response_model=OperatorMessageResponse, status_code=status.HTTP_201_CREATED)
def send_operator_message(
    msg_in: OperatorMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_higher),
):
    """
    Send an internal chat message between Admins and Campaign Managers.
    STRICTLY restricted to Admins and Campaign Managers only.
    Audience users receive 403 Forbidden.
    """
    msg = OperatorMessage(
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        sender_role=current_user.role,
        channel=msg_in.channel or "general",
        message=msg_in.message.strip()
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@router.delete("/messages/{message_id}", status_code=status.HTTP_200_OK)
def delete_operator_message(
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_higher),
):
    """
    Delete an operator message. Only the message sender or an Admin can delete.
    """
    msg = db.query(OperatorMessage).filter(OperatorMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    
    if current_user.role != "admin" and msg.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages unless you are an Admin."
        )
    
    db.delete(msg)
    db.commit()
    return {"message": "Message deleted successfully"}
