from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- AUTH SCHEMAS ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    organization: Optional[str] = None
    designation: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    organization: Optional[str] = None
    designation: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, description="New password (min 6 chars)")

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[str] = None

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str


# --- AUDIENCE SCHEMAS ---

class AudienceBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: str
    preferred_languages: List[str] = Field(default_factory=list)
    occupation: str
    age: int = Field(..., ge=0, le=120)
    gender: str
    state: str
    district: str
    city: str
    organization: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    preferred_channels: List[str] = Field(default_factory=list)
    custom_fields: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_active: bool = True

class AudienceCreate(AudienceBase):
    @field_validator("phone")
    def validate_phone(cls, v):
        # Allow numbers with optional country prefix like +91
        digits = "".join(filter(str.isdigit, v))
        if len(digits) < 10 or len(digits) > 15:
            raise ValueError("Phone number must contain between 10 and 15 digits")
        return v

class AudienceUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    preferred_languages: Optional[List[str]] = None
    occupation: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    preferred_channels: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class AudienceResponse(AudienceBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- SEGMENT SCHEMAS ---

class SegmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    filter_criteria: Dict[str, Any]  # Dictionary representing the filter logic (e.g. {"state": "UP", "age_gte": 40})
    is_dynamic: bool = True

class SegmentCreate(SegmentBase):
    pass

class SegmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filter_criteria: Optional[Dict[str, Any]] = None
    is_dynamic: Optional[bool] = None

class SegmentResponse(SegmentBase):
    id: str
    estimated_size: int
    last_refreshed: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# --- TEMPLATE SCHEMAS ---

class TemplateBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str  # emergency, awareness, education, announcement
    channel: str  # email, sms, whatsapp, push, website
    default_language: str
    subject_template: Optional[str] = None
    body_template: str
    translations: Optional[str] = "{}"

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    channel: Optional[str] = None
    default_language: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    translations: Optional[str] = None

class TemplateResponse(TemplateBase):
    id: str
    is_ai_generated: bool
    version: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- CAMPAIGN SCHEMAS ---

class CampaignBase(BaseModel):
    title: str
    description: Optional[str] = None
    objective: Optional[str] = None
    campaign_type: str  # awareness_drive, emergency_alert, educational_notification, organizational_announcement
    segment_id: Optional[str] = None
    template_id: Optional[str] = None
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None
    channel_preferences: List[str] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    campaign_type: Optional[str] = None
    status: Optional[str] = None  # draft, scheduled, active, completed, cancelled
    segment_id: Optional[str] = None
    template_id: Optional[str] = None
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None
    channel_preferences: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None

class CampaignResponse(CampaignBase):
    id: str
    status: str
    target_audience_count: int
    estimated_reach: int
    estimated_cost: float = 0.0
    created_by: str
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- STATS/DASHBOARD SCHEMAS ---

class DashboardStats(BaseModel):
    total_audiences: int
    active_audiences: int
    total_segments: int
    draft_campaigns: int
    total_campaigns: int
    total_templates: int
    recent_activities: List[Dict[str, Any]]


# --- AUDIT LOG SCHEMAS ---

class AuditLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    campaign_id: Optional[str] = None
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    changes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# --- DELIVERY LOG SCHEMAS ---

class DeliveryLogResponse(BaseModel):
    id: str
    campaign_id: str
    audience_id: str
    audience_name: str
    channel: str
    status: str
    recipient_info: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True

class CampaignDeliverySummary(BaseModel):
    id: str
    title: str
    status: str
    target_count: int
    sent_count: int
    failed_count: int
    dispatched_at: Optional[datetime] = None


# --- BLACKLIST SCHEMAS ---

class BlacklistCreate(BaseModel):
    type: str  # "email" or "phone"
    value: str

class BlacklistResponse(BaseModel):
    id: str
    type: str
    value: str
    created_at: datetime

    class Config:
        from_attributes = True


