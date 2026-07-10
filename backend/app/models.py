import datetime
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # admin, campaign_manager, communicator
    organization = Column(String(255), nullable=True)
    designation = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    templates = relationship("Template", back_populates="creator")
    created_campaigns = relationship("Campaign", foreign_keys="Campaign.created_by", back_populates="creator")
    updated_campaigns = relationship("Campaign", foreign_keys="Campaign.updated_by", back_populates="updater")


class Audience(Base):
    __tablename__ = "audiences"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    preferred_languages = Column(Text, nullable=False)  # JSON serialized array of strings, e.g., '["Hindi", "English"]'
    occupation = Column(String(100), nullable=False, index=True)
    age = Column(Integer, nullable=False, index=True)
    gender = Column(String(10), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=False)
    organization = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    designation = Column(String(255), nullable=True)
    preferred_channels = Column(Text, nullable=False)  # JSON serialized array of strings, e.g., '["email", "whatsapp"]'
    custom_fields = Column(Text, nullable=True)  # JSON serialized dictionary for dynamic properties
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class Segment(Base):
    __tablename__ = "segments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    filter_criteria = Column(Text, nullable=False)  # JSON serialized rules
    is_dynamic = Column(Boolean, default=True, nullable=False)
    estimated_size = Column(Integer, default=0, nullable=False)
    last_refreshed = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    campaigns = relationship("Campaign", back_populates="segment")


class Template(Base):
    __tablename__ = "templates"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False)  # emergency, awareness, education, announcement
    channel = Column(String(50), nullable=False)  # email, sms, whatsapp, push, website
    default_language = Column(String(50), nullable=False)
    subject_template = Column(Text, nullable=True)
    body_template = Column(Text, nullable=False)
    translations = Column(Text, nullable=True, default="{}")
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    creator = relationship("User", back_populates="templates")
    campaigns = relationship("Campaign", back_populates="template")


class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    objective = Column(Text, nullable=True)
    campaign_type = Column(String(50), nullable=False)  # awareness_drive, emergency_alert, educational_notification, organizational_announcement
    status = Column(String(50), default="draft", nullable=False)  # draft, scheduled, active, completed, cancelled
    segment_id = Column(String(36), ForeignKey("segments.id"), nullable=True)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=True)
    channel_preferences = Column(Text, nullable=False)  # JSON serialized array of strings
    target_audience_count = Column(Integer, default=0, nullable=False)
    estimated_reach = Column(Integer, default=0, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Real delivery tracking fields
    sent_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    dispatched_at = Column(DateTime, nullable=True)
    
    # Relationships
    segment = relationship("Segment", back_populates="campaigns")
    template = relationship("Template", back_populates="campaigns")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_campaigns")
    updater = relationship("User", foreign_keys=[updated_by], back_populates="updated_campaigns")
    audit_logs = relationship("AuditLog", back_populates="campaign", cascade="all, delete-orphan")
    delivery_logs = relationship("DeliveryLog", back_populates="campaign", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    campaign_id = Column(String(36), ForeignKey("campaigns.id"), nullable=True)
    action = Column(String(100), nullable=False)  # CREATE, UPDATE, STATUS_CHANGE, DELETE
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    changes = Column(Text, nullable=True)  # JSON representation of changed fields
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User")
    campaign = relationship("Campaign", back_populates="audit_logs")


class DeliveryLog(Base):
    """Tracks every individual message delivery attempt."""
    __tablename__ = "delivery_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), ForeignKey("campaigns.id"), nullable=False)
    audience_id = Column(String(36), ForeignKey("audiences.id"), nullable=False)
    channel = Column(String(50), nullable=False)       # email, whatsapp, sms, push, website
    status = Column(String(20), nullable=False)         # sent, failed, pending
    recipient_info = Column(String(255), nullable=True) # email address or phone number used
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="delivery_logs")
    audience = relationship("Audience")


class Blacklist(Base):
    """Stores unsubscribed/opt-out recipient values (emails or phone numbers)."""
    __tablename__ = "blacklist"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    type = Column(String(20), nullable=False)           # email or phone
    value = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
