"""
User Management Routes — Admin-only CRUD for platform operator accounts.
Provides listing, updating roles/status, and deactivating user accounts.
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Any

from app.database import get_db
from app.models import User
from app.schemas import UserResponse, UserUpdate, UserCreate
from app.auth import (
    get_password_hash,
    require_admin,
    require_manager_or_higher,
    get_current_user,
)
from app.config import settings

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
def list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all platform users. Admin-only."""
    query = db.query(User)

    if role:
        if role not in settings.ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role filter. Allowed: {settings.ROLES}",
            )
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                User.full_name.ilike(search_term),
                User.email.ilike(search_term),
                User.organization.ilike(search_term),
            )
        )

    return query.order_by(User.created_at.desc()).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get a specific user by ID. Admin-only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a user's profile, role, or active status. Admin-only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Prevent admin from deactivating themselves
    if user.id == current_user.id and user_in.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Prevent admin from changing their own role
    if user.id == current_user.id and user_in.role is not None and user_in.role != user.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        if user_in.role not in settings.ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Allowed: {settings.ROLES}",
            )
        user.role = user_in.role
    if user_in.organization is not None:
        user.organization = user_in.organization
    if user_in.designation is not None:
        user.designation = user_in.designation
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password is not None and user_in.password.strip():
        user.hashed_password = get_password_hash(user_in.password)

    user.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def deactivate_user(
    user_id: str,
    permanent: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft-deactivate or permanently delete a user account. Admin-only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    if permanent:
        db.delete(user)
        db.commit()
        return {"message": f"User '{user.full_name}' permanently deleted", "id": user_id}
    else:
        user.is_active = False
        user.updated_at = datetime.datetime.utcnow()
        db.commit()
        return {"message": "User deactivated successfully", "id": user_id}


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new platform operator. Admin-only."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    if user_in.role not in settings.ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed: {settings.ROLES}",
        )

    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        organization=user_in.organization,
        designation=user_in.designation,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
