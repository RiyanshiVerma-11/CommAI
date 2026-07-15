import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.config import settings
from app.database import engine, Base, get_db
from app.models import User, Audience, Segment, Template, Campaign, DeliveryLog, Blacklist
from app.auth import get_password_hash, require_communicator_or_higher
from app.routes import auth, audience, template, campaign, settings as settings_router, translate
from app.routes import users as users_router
from app.routes import ai as ai_router

# Create database tables (SQLite)
Base.metadata.create_all(bind=engine)

# Dynamically add missing columns if the table already existed
def add_missing_columns():
    from sqlalchemy import text
    with engine.begin() as conn:
        for col_name, col_type in [
            ("sent_count", "INTEGER DEFAULT 0 NOT NULL"),
            ("failed_count", "INTEGER DEFAULT 0 NOT NULL"),
            ("dispatched_at", "DATETIME")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE campaigns ADD COLUMN {col_name} {col_type}"))
            except Exception:
                pass
        
        # Add translations column to templates table if missing
        try:
            conn.execute(text("ALTER TABLE templates ADD COLUMN translations TEXT DEFAULT '{}'"))
        except Exception:
            pass

add_missing_columns()


app = FastAPI(
    title="AI-Based Multilingual Mass Communication Platform",
    description="Backend API services for Audience, Segment, Template, and Campaign Planning.",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router setup
api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(users_router.router)
api_router.include_router(audience.router)
api_router.include_router(template.router)
api_router.include_router(campaign.router)
api_router.include_router(settings_router.router)
api_router.include_router(translate.router)
api_router.include_router(ai_router.router)

# --- DASHBOARD METRICS ROUTE ---

@api_router.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(require_communicator_or_higher)
) -> Dict[str, Any]:
    # Aggregates
    total_audiences = db.query(Audience).filter(Audience.is_deleted == False).count()
    active_audiences = db.query(Audience).filter(Audience.is_deleted == False, Audience.is_active == True).count()
    total_segments = db.query(Segment).count()
    draft_campaigns = db.query(Campaign).filter(Campaign.is_deleted == False, Campaign.status == "draft").count()
    total_campaigns = db.query(Campaign).filter(Campaign.is_deleted == False).count()
    total_templates = db.query(Template).filter(Template.is_deleted == False).count()
    
    # Compile recent activity feed
    recent_activities = []
    
    # 1. Recent Campaign additions
    recent_camps = db.query(Campaign).filter(Campaign.is_deleted == False).order_by(Campaign.created_at.desc()).limit(3).all()
    for c in recent_camps:
        recent_activities.append({
            "timestamp": c.created_at.isoformat(),
            "activity_type": "campaign",
            "message": f"Campaign draft '{c.title}' was created",
            "meta": {"id": c.id, "status": c.status}
        })
        
    # 2. Recent Templates
    recent_tpls = db.query(Template).filter(Template.is_deleted == False).order_by(Template.created_at.desc()).limit(3).all()
    for t in recent_tpls:
        recent_activities.append({
            "timestamp": t.created_at.isoformat(),
            "activity_type": "template",
            "message": f"Template '{t.title}' ({t.channel}) saved to library",
            "meta": {"id": t.id, "channel": t.channel}
        })
        
    # 3. Recent Audience members
    recent_auds = db.query(Audience).filter(Audience.is_deleted == False).order_by(Audience.created_at.desc()).limit(3).all()
    for a in recent_auds:
        recent_activities.append({
            "timestamp": a.created_at.isoformat(),
            "activity_type": "audience",
            "message": f"Audience profile '{a.first_name} {a.last_name}' added",
            "meta": {"id": a.id, "phone": a.phone}
        })
        
    # Count delivery logs
    total_delivered = db.query(DeliveryLog).filter(DeliveryLog.status == "sent").count()
    total_failed = db.query(DeliveryLog).filter(DeliveryLog.status == "failed").count()

    # Sort activities by timestamp descending
    recent_activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "total_audiences": total_audiences,
        "active_audiences": active_audiences,
        "total_segments": total_segments,
        "draft_campaigns": draft_campaigns,
        "total_campaigns": total_campaigns,
        "total_templates": total_templates,
        "total_delivered": total_delivered,
        "total_failed": total_failed,
        "recent_activities": recent_activities[:7]  # return top 7
    }


# --- CONFIG CONSTANTS ENDPOINT ---

@api_router.get("/config/constants")
def get_constants() -> Dict[str, Any]:
    """Returns system constants for populating frontend dropdowns."""
    return {
        "languages": settings.LANGUAGES,
        "occupations": settings.OCCUPATIONS,
        "channels": settings.CHANNELS,
        "categories": settings.CATEGORIES,
        "roles": settings.ROLES,
        "campaign_types": [
            {"value": "awareness_drive", "label": "Awareness Drive"},
            {"value": "emergency_alert", "label": "Emergency Alert"},
            {"value": "educational_notification", "label": "Educational Notification"},
            {"value": "organizational_announcement", "label": "Organizational Announcement"},
        ],
        "campaign_statuses": ["draft", "scheduled", "active", "completed", "cancelled"],
        "genders": ["Male", "Female", "Other"],
    }


app.include_router(api_router)

def seed_demo_data(db: Session):
    import json
    try:
        # 1. Seed Audiences if empty
        if db.query(Audience).count() == 0:
            print("[SEEDING DATABASE] No audiences found. Generating demo audience profiles...")
            demo_audiences = [
                Audience(
                    first_name="Rajesh",
                    last_name="Kumar",
                    email="rajesh.kumar@ruralgov.in",
                    phone="9876543210",
                    preferred_languages=json.dumps(["Hindi"]),
                    occupation="Farmer",
                    age=42,
                    gender="Male",
                    state="Bihar",
                    district="Patna",
                    city="Patna",
                    preferred_channels=json.dumps(["sms", "whatsapp"]),
                    is_active=True
                ),
                Audience(
                    first_name="Sunita",
                    last_name="Devi",
                    email="sunita.devi@ruralgov.in",
                    phone="9876543211",
                    preferred_languages=json.dumps(["Hindi"]),
                    occupation="Farmer",
                    age=38,
                    gender="Female",
                    state="Uttar Pradesh",
                    district="Lucknow",
                    city="Malihabad",
                    preferred_channels=json.dumps(["sms"]),
                    is_active=True
                ),
                Audience(
                    first_name="Anil",
                    last_name="Mehta",
                    email="dr.anil@health.gov.in",
                    phone="9876543212",
                    preferred_languages=json.dumps(["English", "Marathi"]),
                    occupation="Healthcare Worker",
                    age=45,
                    gender="Male",
                    state="Maharashtra",
                    district="Mumbai",
                    city="Mumbai",
                    preferred_channels=json.dumps(["email", "push"]),
                    is_active=True
                ),
                Audience(
                    first_name="Priya",
                    last_name="Nair",
                    email="priya.nair@univ.edu",
                    phone="9876543213",
                    preferred_languages=json.dumps(["English", "Malayalam"]),
                    occupation="Student",
                    age=21,
                    gender="Female",
                    state="Kerala",
                    district="Ernakulam",
                    city="Kochi",
                    preferred_channels=json.dumps(["whatsapp", "email"]),
                    is_active=True
                ),
                Audience(
                    first_name="Amit",
                    last_name="Patel",
                    email="amit.patel@agrobiz.co.in",
                    phone="9876543214",
                    preferred_languages=json.dumps(["Gujarati", "Hindi", "English"]),
                    occupation="Business Owner",
                    age=35,
                    gender="Male",
                    state="Gujarat",
                    district="Ahmedabad",
                    city="Ahmedabad",
                    preferred_channels=json.dumps(["whatsapp", "email"]),
                    is_active=True
                ),
                Audience(
                    first_name="Rekha",
                    last_name="Sharma",
                    email="rekha.sharma@school.edu.in",
                    phone="9876543215",
                    preferred_languages=json.dumps(["Hindi", "English"]),
                    occupation="Teacher",
                    age=40,
                    gender="Female",
                    state="Rajasthan",
                    district="Jaipur",
                    city="Jaipur",
                    preferred_channels=json.dumps(["email"]),
                    is_active=True
                )
            ]
            for aud in demo_audiences:
                db.add(aud)
            db.commit()
            print("[SEEDING DATABASE] Audiences seeding completed.")

        # Get a manager or admin user ID to act as creator
        manager = db.query(User).filter(User.role == "campaign_manager").first()
        if not manager:
            manager = db.query(User).first()
        
        if not manager:
            print("[SEEDING DATABASE] Cannot seed segments/templates/campaigns because no user accounts exist.")
            return

        creator_id = manager.id

        # 2. Seed Segments if empty
        if db.query(Segment).count() == 0:
            print("[SEEDING DATABASE] No segments found. Generating demo segments...")
            demo_segments = [
                {
                    "name": "Active Farmers",
                    "description": "Rural farmers targeting agricultural advisories.",
                    "filter_criteria": {"occupations": ["Farmer"], "logic": "AND"}
                },
                {
                    "name": "Healthcare Professionals",
                    "description": "Medical staff and health workers for notifications.",
                    "filter_criteria": {"occupations": ["Healthcare Worker"], "logic": "AND"}
                },
                {
                    "name": "North Zone Hindi Speakers",
                    "description": "Hindi-speaking audiences in Northern States.",
                    "filter_criteria": {"states": ["Uttar Pradesh", "Bihar", "Rajasthan"], "language": "Hindi", "logic": "AND"}
                }
            ]
            for seg_data in demo_segments:
                from app.routes.audience import build_segment_filter_query
                query = db.query(Audience).filter(Audience.is_deleted == False, Audience.is_active == True)
                query = build_segment_filter_query(seg_data["filter_criteria"], query)
                size = query.count()
                
                seg = Segment(
                    name=seg_data["name"],
                    description=seg_data["description"],
                    filter_criteria=json.dumps(seg_data["filter_criteria"]),
                    is_dynamic=True,
                    estimated_size=size,
                    last_refreshed=datetime.datetime.utcnow()
                )
                db.add(seg)
            db.commit()
            print("[SEEDING DATABASE] Segments seeding completed.")

        # 3. Seed Templates if empty
        if db.query(Template).count() == 0:
            print("[SEEDING DATABASE] No templates found. Generating demo templates for all channels & categories...")
            demo_templates = [
                # The 3 original templates first to ensure campaigns link properly
                Template(
                    title="Monsoon Crop Advisory",
                    description="Agricultural monsoon alert with field instructions.",
                    category="awareness",
                    channel="whatsapp",
                    default_language="Hindi",
                    subject_template="Important Advisory: Monsoon Sowing Guidelines",
                    body_template="Dear {first_name}, the weather bureau has forecasted monsoon showers in district {district} next week. Please clear field drains and start soil preparation for Kharif crops. Call helpline for quality seeds.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="National Pulse Polio Drive Alert",
                    description="Immunization campaign alert for children under 5.",
                    category="awareness",
                    channel="whatsapp",
                    default_language="English",
                    subject_template="Polio Immunization Campaign on Sunday",
                    body_template="Dear {first_name}, please bring children under the age of 5 to the nearest healthcare camp in {city} this Sunday for free immunization drops. Let us eradicate polio.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Severe Heat Wave Alert",
                    description="Urgent safety warning for extreme local heat.",
                    category="emergency",
                    channel="sms",
                    default_language="Hindi",
                    subject_template="URGENT: Extreme Heatwave Warning",
                    body_template="EMERGENCY NOTICE: A severe heatwave is predicted in {district} today. Avoid outdoor activities between 12 PM and 4 PM. Drink plenty of water and keep animals in shade.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                # Remaining combinations to cover all 5 channels and 4 categories
                # EMAIL
                Template(
                    title="Email - Emergency: Severe Flood Evacuation",
                    description="Urgent notification containing safety guidelines and rescue contacts.",
                    category="emergency",
                    channel="email",
                    default_language="English",
                    subject_template="CRITICAL: Urgent Evacuation Notice for {city}, {state}",
                    body_template="Dear {first_name} {last_name},\n\nThis is an emergency notification regarding rising water levels in {city}. Please secure your belongings and move to the nearest safe shelter designated for {district} district.\n\nEmergency Helpline: +91-11-23456789\nStay safe and alert.\n\nSincerely,\nDisaster Management Division",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Email - Awareness: Water Conservation Initiative",
                    description="Public campaign urging citizens to conserve clean drinking water.",
                    category="awareness",
                    channel="email",
                    default_language="English",
                    subject_template="Save Water, Secure the Future of {state}",
                    body_template="Dear {first_name},\n\nFresh water is a limited resource. Simple actions like rain harvesting in your home at {city} can make a huge impact on {state}'s future. Learn about simple modifications to conserve water.\n\nWarm regards,\nMinistry of Jal Shakti",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Email - Education: Digital Banking Security",
                    description="Information on online security, avoiding phishing, and OTP fraud.",
                    category="education",
                    channel="email",
                    default_language="English",
                    subject_template="Learn to Stay Safe Online, {first_name}!",
                    body_template="Dear {first_name} {last_name},\n\nNever share your password or OTP with anyone. Representatives of banks in {district} will never ask for private details over phone or email. Keep your digital transactions secure.\n\nBest regards,\nNational Cyber Security Cell",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Email - Announcement: New E-Governance App Release",
                    description="Official launch notification of digital public utility portals.",
                    category="announcement",
                    channel="email",
                    default_language="English",
                    subject_template="Announcing the Launch of CitizenConnect App in {state}",
                    body_template="Dear {first_name},\n\nWe are proud to launch CitizenConnect app today! Access driving license, land records, and municipal receipts right from {city}.\n\nDownload today from the Play Store!\n\nBest regards,\nDepartment of IT & e-Governance",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                # SMS
                Template(
                    title="SMS - Awareness: Cleanliness Drive",
                    description="Short public text encouraging trash segregation.",
                    category="awareness",
                    channel="sms",
                    default_language="Hindi",
                    subject_template="Clean India Campaign",
                    body_template="Dear {first_name}, segregate wet and dry waste at your home in {city}. Let's make {state} clean and green!",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="SMS - Education: Free Vocational Skills Training",
                    description="SMS invite to government-sponsored youth training centers.",
                    category="education",
                    channel="sms",
                    default_language="Hindi",
                    subject_template="Skill Development",
                    body_template="Unlock new jobs, {first_name}! Enroll in free skill training at {district} center. Reply YES to register.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="SMS - Announcement: Direct Benefit Transfer Update",
                    description="Sowing subsidy disbursal message sent directly to farmers.",
                    category="announcement",
                    channel="sms",
                    default_language="Hindi",
                    subject_template="Subsidy Released",
                    body_template="Good news {first_name}! Agricultural seed subsidy has been credited to your bank account registered in {city}.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                # WHATSAPP
                Template(
                    title="WhatsApp - Emergency: Cyclone Safety Alert",
                    description="Safety instructions for coastal storm warnings.",
                    category="emergency",
                    channel="whatsapp",
                    default_language="English",
                    subject_template="URGENT: Cyclone Alert in Coastal Districts",
                    body_template="Hello {first_name},\n\n*Cyclone Alert* for coastal regions in {state}. High winds are expected in {city} next 24 hours. Keep emergency kits ready, unplug electronics, and monitor warnings. Call 108 for help.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="WhatsApp - Education: Child Nutrition & Healthcare",
                    description="Infographic text explaining child immunization schedules.",
                    category="education",
                    channel="whatsapp",
                    default_language="English",
                    subject_template="Child Wellness & Immunization",
                    body_template="Hello {first_name},\n\nEnsure healthy growth for your children. Get free vaccine drops at municipal health clinic in {city} this Sunday. Let's build a healthier {state}!",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="WhatsApp - Announcement: Metro Route Expansion",
                    description="Announcement detailing new transit links.",
                    category="announcement",
                    channel="whatsapp",
                    default_language="English",
                    subject_template="New Metro Transit Launch",
                    body_template="Dear Commuter,\n\nWe have expanded metro transit connectivity in {city}! Travel easily and reduce pollution in {district}. View new routes at website.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                # PUSH
                Template(
                    title="Push - Emergency: Fire Hazard Warning",
                    description="Mobile app alert warning of dry wind forest fires.",
                    category="emergency",
                    channel="push",
                    default_language="English",
                    subject_template="🚨 URGENT: Dry Forest Fire Warning",
                    body_template="{first_name}, extreme dry winds in {district} have increased forest fire risks. Avoid lighting dry trash.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Push - Awareness: Road Safety Campaign",
                    description="Mobile push notification reminder to wear helmets/seatbelts.",
                    category="awareness",
                    channel="push",
                    default_language="English",
                    subject_template="🏍️ Drive Safe in {city}!",
                    body_template="Dear {first_name}, always wear a helmet and seatbelt. Let's make the roads of {state} accident-free.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Push - Education: Scholarship Registrations",
                    description="Mobile push notifying students of application dates.",
                    category="education",
                    channel="push",
                    default_language="English",
                    subject_template="🎓 Scholarship Registration Open",
                    body_template="Hey {first_name}! Pre-matric scholarships applications close next week. Apply via the e-welfare portal today.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Push - Announcement: Tax Filing Extension",
                    description="Short alert announcing tax timeline adjustments.",
                    category="announcement",
                    channel="push",
                    default_language="English",
                    subject_template="📅 Municipal Tax Extension",
                    body_template="Dear Citizen, the last date for submitting property tax in {city} has been extended to July 31.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                # WEBSITE
                Template(
                    title="Website - Emergency: Localized Flood Road Closure",
                    description="Banner text warning users about flooded highways.",
                    category="emergency",
                    channel="website",
                    default_language="English",
                    subject_template="TRAFFIC NOTICE: Flooding Closures",
                    body_template="Bridges connecting national highway to district {district} are closed due to rising rivers. Use bypass routes.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Website - Awareness: Renewable Energy Incentives",
                    description="Subpage banner promoting clean energy grants.",
                    category="awareness",
                    channel="website",
                    default_language="English",
                    subject_template="Go Solar: Subsidies on Roof Panels",
                    body_template="Save up to 40% on solar installations at your home in {city}! Check government subsidy eligibility factors.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Website - Education: E-Learning Portal Tutorial",
                    description="Homepage banner introducing digital school systems.",
                    category="education",
                    channel="website",
                    default_language="English",
                    subject_template="Free Virtual Learning Platforms",
                    body_template="Access digital video libraries, quizzes, and school books online. Register student profiles in {state} for free.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                ),
                Template(
                    title="Website - Announcement: Public Grievance Helpline",
                    description="Banner notifying visitors of grievance status tracking.",
                    category="announcement",
                    channel="website",
                    default_language="English",
                    subject_template="Track Grievances Online",
                    body_template="Lodge and track public services complaints directly in {district}. Accountable resolutions within 15 days.",
                    is_ai_generated=False,
                    version=1,
                    created_by=creator_id
                )
            ]
            for tpl in demo_templates:
                db.add(tpl)
            db.commit()
            print("[SEEDING DATABASE] Templates seeding completed.")

        # 4. Seed Campaigns if empty
        if db.query(Campaign).count() == 0:
            print("[SEEDING DATABASE] No campaigns found. Generating demo campaigns...")
            
            farmers_seg = db.query(Segment).filter(Segment.name == "Active Farmers").first()
            health_seg = db.query(Segment).filter(Segment.name == "Healthcare Professionals").first()
            north_seg = db.query(Segment).filter(Segment.name == "North Zone Hindi Speakers").first()
            
            monsoon_tpl = db.query(Template).filter(Template.title == "Monsoon Crop Advisory").first()
            polio_tpl = db.query(Template).filter(Template.title == "National Pulse Polio Drive Alert").first()
            heat_tpl = db.query(Template).filter(Template.title == "Severe Heat Wave Alert").first()
            
            from app.routes.campaign import calculate_reach

            if farmers_seg and monsoon_tpl:
                t_count, r_count = calculate_reach(db, farmers_seg.id, ["whatsapp", "sms"])
                camp1 = Campaign(
                    title="Kharif Crop Monsoon Advisory 2026",
                    description="Monsoon preparedness awareness drive for regional farmers.",
                    objective="Ensure optimal sowing times and prevent flood losses through timely information dissemination.",
                    campaign_type="awareness_drive",
                    status="active",
                    segment_id=farmers_seg.id,
                    template_id=monsoon_tpl.id,
                    channel_preferences=json.dumps(["whatsapp", "sms"]),
                    target_audience_count=t_count,
                    estimated_reach=r_count,
                    created_by=creator_id
                )
                db.add(camp1)

            if north_seg and polio_tpl:
                t_count, r_count = calculate_reach(db, north_seg.id, ["whatsapp"])
                camp2 = Campaign(
                    title="Pulse Polio Drive - North Zone Mobile Drive",
                    description="Weekly immunization alert for northern state populations.",
                    objective="Maximize immunization turnout through direct regional reminders.",
                    campaign_type="educational_notification",
                    status="scheduled",
                    segment_id=north_seg.id,
                    template_id=polio_tpl.id,
                    channel_preferences=json.dumps(["whatsapp"]),
                    target_audience_count=t_count,
                    estimated_reach=r_count,
                    created_by=creator_id,
                    scheduled_at=datetime.datetime.utcnow() + datetime.timedelta(days=2)
                )
                db.add(camp2)

            if north_seg and heat_tpl:
                t_count, r_count = calculate_reach(db, north_seg.id, ["sms"])
                camp3 = Campaign(
                    title="Emergency Heatwave Advisory - June 2026",
                    description="Severe temperature warnings sent during the peak summer week.",
                    objective="Alert local communities to stay indoors and prevent heatstroke casualties.",
                    campaign_type="emergency_alert",
                    status="completed",
                    segment_id=north_seg.id,
                    template_id=heat_tpl.id,
                    channel_preferences=json.dumps(["sms"]),
                    target_audience_count=t_count,
                    estimated_reach=r_count,
                    created_by=creator_id
                )
                db.add(camp3)

            db.commit()
            print("[SEEDING DATABASE] Campaigns seeding completed.")

    except Exception as e:
        print(f"[SEEDING DATABASE] Error seeding demo data: {e}")

# Seed initial operational users and setup background scheduler
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        # Check if users exist
        user_count = db.query(User).count()
        if user_count == 0:
            print("[SEEDING DATABASE] No users found. Generating demo role operator accounts...")
            
            admin = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                full_name="System Administrator",
                role="admin",
                organization="National Informatics Centre",
                designation="Director of Communication Systems",
                is_active=True
            )
            db.add(admin)
            
            manager = User(
                email=settings.MANAGER_EMAIL,
                hashed_password=get_password_hash(settings.MANAGER_PASSWORD),
                full_name="Ramesh Sharma",
                role="campaign_manager",
                organization="Department of Rural Welfare",
                designation="Campaign Manager",
                is_active=True
            )
            db.add(manager)
            
            communicator = User(
                email=settings.COMMUNICATOR_EMAIL,
                hashed_password=get_password_hash(settings.COMMUNICATOR_PASSWORD),
                full_name="Anjali Nair",
                role="communicator",
                organization="Department of Rural Welfare",
                designation="Field Communications Coordinator",
                is_active=True
            )
            db.add(communicator)
            
            db.commit()
            print("[SEEDING DATABASE] Seeding completed successfully.")

        # Always check and seed demo campaigns/audiences/segments/templates
        seed_demo_data(db)

        # Start the background scheduler
        from app.services.scheduler import start_scheduler
        start_scheduler()

    except Exception as e:
        print(f"[SEEDING DATABASE] Error during seeding: {e}")
    finally:
        db.close()
    yield

app.router.lifespan_context = lifespan
