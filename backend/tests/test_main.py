"""
Comprehensive integration tests for the CommAI backend.
Covers: Authentication, RBAC, User Management, Audience CRUD,
CSV Bulk Import, Segmentation, Templates, Campaigns (with state machine),
Audience Analytics, and Config Constants.
"""
import os
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.config import settings

# Use an in-memory database for testing to avoid Docker bind-mount locking errors
TEST_DB_URL = "sqlite://"

from sqlalchemy.pool import StaticPool
engine = create_engine(
    TEST_DB_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override get_db dependency
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed default user profiles in test DB
    from app.auth import get_password_hash
    from app.models import User
    
    db = TestingSessionLocal()
    admin = User(
        email=settings.ADMIN_EMAIL,
        hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
        full_name="Test Administrator",
        role="admin",
        organization="Test Org",
        designation="Admin",
        is_active=True
    )
    db.add(admin)
    
    manager = User(
        email=settings.MANAGER_EMAIL,
        hashed_password=get_password_hash(settings.MANAGER_PASSWORD),
        full_name="Test Manager",
        role="campaign_manager",
        organization="Test Org",
        designation="Manager",
        is_active=True
    )
    db.add(manager)
    
    communicator = User(
        email=settings.COMMUNICATOR_EMAIL,
        hashed_password=get_password_hash(settings.COMMUNICATOR_PASSWORD),
        full_name="Test Communicator",
        role="communicator",
        organization="Test Org",
        designation="Communicator",
        is_active=True
    )
    db.add(communicator)
    
    db.commit()
    db.close()
    
    yield
    
    # Teardown: drop tables and delete test db file
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_comm_platform.db"):
        try:
            os.remove("./test_comm_platform.db")
        except PermissionError:
            pass

def get_auth_headers(email: str, password: str) -> dict:
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ========================================================================
# 1. AUTHENTICATION TESTS
# ========================================================================

class TestAuthentication:
    def test_login_success(self):
        response = client.post(
            "/api/auth/login",
            data={"username": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == settings.ADMIN_EMAIL

    def test_login_wrong_password(self):
        response = client.post(
            "/api/auth/login",
            data={"username": settings.ADMIN_EMAIL, "password": "WrongPassword"}
        )
        assert response.status_code == 401

    def test_login_json_endpoint(self):
        response = client.post(
            "/api/auth/login-json",
            json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_get_current_user(self):
        headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["role"] == "admin"

    def test_unauthorized_access(self):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_invalid_token(self):
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert response.status_code == 401

    def test_register_new_user(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "email": "newuser@test.com",
            "password": "TestPass123!",
            "full_name": "New Test User",
            "role": "communicator",
            "organization": "Test Org",
            "designation": "Tester"
        }
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        assert response.json()["email"] == "newuser@test.com"

    def test_register_duplicate_email(self):
        payload = {
            "email": settings.ADMIN_EMAIL,
            "password": "AnyPassword123!",
            "full_name": "Duplicate",
            "role": "communicator"
        }
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]


# ========================================================================
# 2. RBAC TESTS
# ========================================================================

class TestRBAC:
    def test_communicator_cannot_create_audience(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        payload = {
            "first_name": "Test", "last_name": "Audience", "phone": "9876543210",
            "preferred_languages": ["English"], "occupation": "Student",
            "age": 21, "gender": "Male", "state": "Maharashtra",
            "district": "Pune", "city": "Pune", "preferred_channels": ["email"]
        }
        response = client.post("/api/audiences", json=payload, headers=comm_headers)
        assert response.status_code == 403

    def test_admin_can_create_audience(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "first_name": "Test", "last_name": "Audience", "email": "test@domain.com",
            "phone": "9876543210",
            "preferred_languages": ["English", "Hindi"], "occupation": "Student",
            "age": 21, "gender": "Male", "state": "Maharashtra",
            "district": "Pune", "city": "Pune", "preferred_channels": ["email", "sms"],
            "is_active": True
        }
        response = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert response.status_code == 201
        assert response.json()["first_name"] == "Test"

    def test_communicator_cannot_list_users(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/users", headers=comm_headers)
        assert response.status_code == 403

    def test_manager_cannot_list_users(self):
        mgr_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        response = client.get("/api/users", headers=mgr_headers)
        assert response.status_code == 403


# ========================================================================
# 3. USER MANAGEMENT TESTS (Admin-only)
# ========================================================================

class TestUserManagement:
    def test_admin_list_users(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        response = client.get("/api/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        assert len(users) >= 3  # admin, manager, communicator + possibly newuser

    def test_admin_list_users_filter_by_role(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        response = client.get("/api/users?role=admin", headers=admin_headers)
        assert response.status_code == 200
        for user in response.json():
            assert user["role"] == "admin"

    def test_admin_list_users_search(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        response = client.get("/api/users?search=Manager", headers=admin_headers)
        assert response.status_code == 200
        assert any("Manager" in u["full_name"] for u in response.json())

    def test_admin_update_user_role(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        # Get the communicator user
        response = client.get("/api/users?role=communicator", headers=admin_headers)
        users = response.json()
        # Find newuser@test.com or any communicator that's not the seeded one
        target = None
        for u in users:
            if u["email"] == "newuser@test.com":
                target = u
                break
        if target:
            response = client.put(
                f"/api/users/{target['id']}",
                json={"role": "campaign_manager"},
                headers=admin_headers
            )
            assert response.status_code == 200
            assert response.json()["role"] == "campaign_manager"
            # Revert
            client.put(
                f"/api/users/{target['id']}",
                json={"role": "communicator"},
                headers=admin_headers
            )

    def test_admin_cannot_deactivate_self(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        # Get admin's own user ID
        me_resp = client.get("/api/auth/me", headers=admin_headers)
        admin_id = me_resp.json()["id"]
        response = client.put(
            f"/api/users/{admin_id}",
            json={"is_active": False},
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "own account" in response.json()["detail"]


# ========================================================================
# 4. AUDIENCE CRUD TESTS
# ========================================================================

class TestAudienceCRUD:
    def test_reject_invalid_email(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "first_name": "Bad", "last_name": "Format", "email": "not-an-email",
            "phone": "9876543211", "preferred_languages": ["English"],
            "occupation": "Student", "age": 25, "gender": "Female",
            "state": "Bihar", "district": "Patna", "city": "Patna",
            "preferred_channels": ["email"]
        }
        response = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert response.status_code == 422

    def test_reject_short_phone(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "first_name": "Bad", "last_name": "Phone", "email": "valid@email.com",
            "phone": "123", "preferred_languages": ["English"],
            "occupation": "Student", "age": 25, "gender": "Female",
            "state": "Bihar", "district": "Patna", "city": "Patna",
            "preferred_channels": ["email"]
        }
        response = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert response.status_code == 422

    def test_create_and_get_audience(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "first_name": "Riya", "last_name": "Sharma", "email": "riya@test.com",
            "phone": "9876543212", "preferred_languages": ["English", "Hindi"],
            "occupation": "Student", "age": 22, "gender": "Female",
            "state": "Bihar", "district": "Patna", "city": "Patna",
            "preferred_channels": ["email", "whatsapp"]
        }
        response = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert response.status_code == 201
        created_id = response.json()["id"]

        # GET by ID
        response = client.get(f"/api/audiences/{created_id}", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["first_name"] == "Riya"

    def test_duplicate_phone_rejected(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "first_name": "Dup", "last_name": "Phone",
            "phone": "9876543210",  # already exists from RBAC test
            "preferred_languages": ["English"], "occupation": "Student",
            "age": 21, "gender": "Male", "state": "Maharashtra",
            "district": "Pune", "city": "Pune", "preferred_channels": ["email"]
        }
        response = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert response.status_code == 400
        assert "Phone number already exists" in response.json()["detail"]

    def test_list_audiences_with_filters(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        response = client.get("/api/audiences?occupation=Student", headers=admin_headers)
        assert response.status_code == 200
        for aud in response.json()["results"]:
            assert aud["occupation"] == "Student"

    def test_patch_audience(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        # Get first audience
        response = client.get("/api/audiences", headers=admin_headers)
        auds = response.json()["results"]
        if auds:
            aud_id = auds[0]["id"]
            response = client.patch(
                f"/api/audiences/{aud_id}",
                json={"occupation": "Teacher"},
                headers=admin_headers
            )
            assert response.status_code == 200
            assert response.json()["occupation"] == "Teacher"

    def test_delete_audience(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        # Create one to delete
        payload = {
            "first_name": "Delete", "last_name": "Me",
            "phone": "9876543299", "preferred_languages": ["English"],
            "occupation": "Student", "age": 20, "gender": "Male",
            "state": "Delhi", "district": "Delhi", "city": "Delhi",
            "preferred_channels": ["sms"]
        }
        create_resp = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert create_resp.status_code == 201
        del_id = create_resp.json()["id"]

        response = client.delete(f"/api/audiences/{del_id}", headers=admin_headers)
        assert response.status_code == 200
        assert "soft deleted" in response.json()["message"]

        # Verify it's gone from list
        get_resp = client.get(f"/api/audiences/{del_id}", headers=admin_headers)
        assert get_resp.status_code == 404


# ========================================================================
# 5. CSV BULK IMPORT TESTS
# ========================================================================

class TestBulkImport:
    def test_csv_import(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        csv_data = (
            "first_name,last_name,email,phone,preferred_languages,occupation,age,gender,state,district,city,preferred_channels\n"
            'Rajesh,Kumar,rajesh@agri.in,9900112233,"Hindi,Punjabi",Farmer,45,Male,Punjab,Ludhiana,Ludhiana,"sms,whatsapp"\n'
            'Sita,Devi,sita@health.org,9900112244,"Hindi,English",Healthcare Worker,38,Female,Uttar Pradesh,Varanasi,Varanasi,"email,whatsapp"\n'
            ",LastName,missing@email.com,9900112255,English,Student,20,Female,Punjab,Ludhiana,Ludhiana,email\n"  # fail: no first_name
            "BadLanguage,User,bad@email.com,9900112266,French,Teacher,35,Male,Delhi,Delhi,Delhi,email\n"  # fail: bad language
        )
        files = {"file": ("test_import.csv", csv_data, "text/csv")}
        response = client.post("/api/audiences/import", files=files, headers=manager_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 2
        assert data["fail_count"] == 2


# ========================================================================
# 6. SEGMENTATION TESTS
# ========================================================================

class TestSegmentation:
    def test_evaluate_segment_criteria(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        criteria = {"occupations": ["Farmer"], "logic": "AND"}
        response = client.post("/api/segments/evaluate", json=criteria, headers=manager_headers)
        assert response.status_code == 200
        assert response.json()["estimated_size"] >= 1

    def test_create_segment(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        payload = {
            "name": "Punjab Farmers Segment",
            "description": "Dynamic segment targeting Punjab farmers",
            "filter_criteria": {"states": ["Punjab"], "occupations": ["Farmer"]},
            "is_dynamic": True
        }
        response = client.post("/api/segments", json=payload, headers=manager_headers)
        assert response.status_code == 201
        assert response.json()["name"] == "Punjab Farmers Segment"
        assert response.json()["estimated_size"] >= 1

    def test_duplicate_segment_name_rejected(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        payload = {
            "name": "Punjab Farmers Segment",  # same name
            "description": "Duplicate",
            "filter_criteria": {"occupations": ["Farmer"]},
            "is_dynamic": True
        }
        response = client.post("/api/segments", json=payload, headers=manager_headers)
        assert response.status_code == 400

    def test_list_segments(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/segments", headers=comm_headers)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_preview_segment(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        segments = client.get("/api/segments", headers=manager_headers).json()
        seg_id = segments[0]["id"]
        response = client.get(f"/api/segments/{seg_id}/preview", headers=manager_headers)
        assert response.status_code == 200
        assert "estimated_size" in response.json()
        assert "preview" in response.json()

    def test_update_segment(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        segments = client.get("/api/segments", headers=manager_headers).json()
        seg_id = segments[0]["id"]
        response = client.put(
            f"/api/segments/{seg_id}",
            json={"description": "Updated description for testing"},
            headers=manager_headers
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Updated description for testing"

    def test_get_single_segment(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        segments = client.get("/api/segments", headers=comm_headers).json()
        seg_id = segments[0]["id"]
        response = client.get(f"/api/segments/{seg_id}", headers=comm_headers)
        assert response.status_code == 200
        assert response.json()["id"] == seg_id


# ========================================================================
# 7. TEMPLATE TESTS
# ========================================================================

class TestTemplates:
    def test_create_template(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        payload = {
            "title": "Alert Warning",
            "description": "Standard alert template",
            "category": "emergency",
            "channel": "sms",
            "default_language": "Hindi",
            "body_template": "Namaste {{first_name}}, emergency alert regarding heavy rain."
        }
        response = client.post("/api/templates", json=payload, headers=manager_headers)
        assert response.status_code == 201
        assert response.json()["title"] == "Alert Warning"

    def test_invalid_category_rejected(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        payload = {
            "title": "Bad Category",
            "category": "invalid_category",
            "channel": "sms",
            "default_language": "Hindi",
            "body_template": "Test"
        }
        response = client.post("/api/templates", json=payload, headers=manager_headers)
        assert response.status_code == 400

    def test_list_templates(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/templates", headers=comm_headers)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_update_template(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        templates = client.get("/api/templates", headers=manager_headers).json()
        tpl_id = templates[0]["id"]
        response = client.put(
            f"/api/templates/{tpl_id}",
            json={"title": "Updated Alert Warning"},
            headers=manager_headers
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Alert Warning"
        assert response.json()["version"] >= 2

    def test_communicator_cannot_create_template(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        payload = {
            "title": "Unauthorized Template",
            "category": "awareness",
            "channel": "email",
            "default_language": "English",
            "body_template": "Test body"
        }
        response = client.post("/api/templates", json=payload, headers=comm_headers)
        assert response.status_code == 403


# ========================================================================
# 8. CAMPAIGN TESTS (with state machine)
# ========================================================================

class TestCampaigns:
    def test_create_campaign_draft(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)

        # Get segment and template IDs
        segments = client.get("/api/segments", headers=comm_headers).json()
        templates = client.get("/api/templates", headers=comm_headers).json()
        seg_id = segments[0]["id"]
        tpl_id = templates[0]["id"]

        payload = {
            "title": "Test Campaign - Monsoon Alert",
            "description": "Test storm warning",
            "objective": "Alert farmers",
            "campaign_type": "emergency_alert",
            "segment_id": seg_id,
            "template_id": tpl_id,
            "channel_preferences": ["sms", "whatsapp"],
        }
        response = client.post("/api/campaigns", json=payload, headers=comm_headers)
        assert response.status_code == 201
        assert response.json()["status"] == "draft"
        assert response.json()["target_audience_count"] >= 1

    def test_list_campaigns(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/campaigns", headers=comm_headers)
        assert response.status_code == 200
        assert len(response.json()) >= 1

    def test_campaign_state_machine_valid_transitions(self):
        import datetime
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        campaigns = client.get("/api/campaigns", headers=admin_headers).json()
        camp_id = campaigns[0]["id"]

        # draft -> scheduled (valid)
        future_time = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat()
        response = client.put(
            f"/api/campaigns/{camp_id}",
            json={"status": "scheduled", "scheduled_at": future_time},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "scheduled"

        # scheduled -> active (valid)
        response = client.put(
            f"/api/campaigns/{camp_id}",
            json={"status": "active"},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "active"

        # active -> completed (valid)
        response = client.put(
            f"/api/campaigns/{camp_id}",
            json={"status": "completed"},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"

    def test_campaign_state_machine_invalid_transition(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)

        # Create a fresh campaign
        segments = client.get("/api/segments", headers=comm_headers).json()
        templates = client.get("/api/templates", headers=comm_headers).json()

        payload = {
            "title": "State Machine Test Campaign",
            "campaign_type": "awareness_drive",
            "segment_id": segments[0]["id"],
            "template_id": templates[0]["id"],
            "channel_preferences": ["email"],
        }
        create_resp = client.post("/api/campaigns", json=payload, headers=comm_headers)
        assert create_resp.status_code == 201
        camp_id = create_resp.json()["id"]

        # completed transition from draft is not valid (must go through scheduled/active first)
        response = client.put(
            f"/api/campaigns/{camp_id}",
            json={"status": "completed"},
            headers=manager_headers
        )
        assert response.status_code == 400
        assert "Invalid status transition" in response.json()["detail"]

    def test_communicator_cannot_schedule_campaign(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        campaigns = client.get("/api/campaigns", headers=comm_headers).json()
        # Find a draft campaign
        draft = None
        for c in campaigns:
            if c["status"] == "draft":
                draft = c
                break
        if draft:
            response = client.put(
                f"/api/campaigns/{draft['id']}",
                json={"status": "scheduled"},
                headers=comm_headers
            )
            assert response.status_code == 403

    def test_campaign_audit_logs(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        campaigns = client.get("/api/campaigns", headers=comm_headers).json()
        camp_id = campaigns[0]["id"]
        response = client.get(f"/api/campaigns/{camp_id}/audit-logs", headers=comm_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ========================================================================
# 9. CONFIG CONSTANTS TESTS
# ========================================================================

class TestConfigConstants:
    def test_get_constants(self):
        response = client.get("/api/config/constants")
        assert response.status_code == 200
        data = response.json()
        assert "languages" in data
        assert "occupations" in data
        assert "channels" in data
        assert "categories" in data
        assert "roles" in data
        assert "campaign_types" in data
        assert "campaign_statuses" in data
        assert "genders" in data
        assert "Hindi" in data["languages"]
        assert "admin" in data["roles"]


# ========================================================================
# 10. DASHBOARD & ANALYTICS TESTS
# ========================================================================

class TestDashboardAnalytics:
    def test_dashboard_stats(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/dashboard/stats", headers=comm_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_audiences" in data
        assert "total_campaigns" in data
        assert "total_templates" in data
        assert "recent_activities" in data

    def test_audience_analytics(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/audiences/analytics", headers=comm_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "active" in data
        assert "by_occupation" in data
        assert "by_state" in data
        assert "by_gender" in data
        assert "by_language" in data
        assert "by_channel" in data
        assert "by_age" in data

    def test_analytics_requires_auth(self):
        response = client.get("/api/audiences/analytics")
        assert response.status_code == 401


# ========================================================================
# 11. SEGMENT DELETE TEST
# ========================================================================

class TestSegmentDelete:
    def test_cannot_delete_segment_linked_to_campaign(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        segments = client.get("/api/segments", headers=admin_headers).json()
        # The first segment is linked to campaigns from earlier tests
        seg_id = segments[0]["id"]
        response = client.delete(f"/api/segments/{seg_id}", headers=admin_headers)
        assert response.status_code == 400
        assert "active campaign" in response.json()["detail"]

    def test_communicator_cannot_delete_segment(self):
        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        segments = client.get("/api/segments", headers=comm_headers).json()
        seg_id = segments[0]["id"]
        response = client.delete(f"/api/segments/{seg_id}", headers=comm_headers)
        assert response.status_code == 403


# ========================================================================
# 12. OPTION B ENHANCEMENT TESTS
# ========================================================================

class TestOptionBEnhancements:
    def test_custom_fields_crud(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "first_name": "Metadata",
            "last_name": "User",
            "phone": "9876543231",
            "preferred_languages": ["English"],
            "occupation": "Student",
            "age": 22,
            "gender": "Female",
            "state": "Maharashtra",
            "district": "Pune",
            "city": "Pune",
            "preferred_channels": ["email"],
            "custom_fields": {"Aadhaar": "Verified", "Crop": "Rice"}
        }
        # 1. Create with custom fields
        response = client.post("/api/audiences", json=payload, headers=admin_headers)
        assert response.status_code == 201
        created = response.json()
        assert created["custom_fields"]["Aadhaar"] == "Verified"
        assert created["custom_fields"]["Crop"] == "Rice"
        user_id = created["id"]

        # 2. Patch update custom fields
        patch_response = client.patch(
            f"/api/audiences/{user_id}",
            json={"custom_fields": {"Aadhaar": "Pending", "Zone": "North"}},
            headers=admin_headers
        )
        assert patch_response.status_code == 200
        patched = patch_response.json()
        assert patched["custom_fields"]["Aadhaar"] == "Pending"
        assert patched["custom_fields"]["Zone"] == "North"
        assert "Crop" not in patched["custom_fields"]  # fully overwritten

    def test_download_csv_template(self):
        response = client.get("/api/audiences/import/template")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert "sample_audience.csv" in response.headers["content-disposition"]
        content = response.text
        assert "first_name,last_name,email,phone" in content

    def test_get_all_audit_logs(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        response = client.get("/api/campaigns/audit-logs/all", headers=manager_headers)
        assert response.status_code == 403
        
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        response_admin = client.get("/api/campaigns/audit-logs/all", headers=admin_headers)
        assert response_admin.status_code == 200
        logs = response_admin.json()
        assert len(logs) >= 1
        assert "action" in logs[0]
        assert "user_name" in logs[0]

    def test_segment_eval_breakdowns(self):
        manager_headers = get_auth_headers(settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD)
        criteria = {"occupations": ["Farmer"], "logic": "AND"}
        response = client.post("/api/segments/evaluate", json=criteria, headers=manager_headers)
        assert response.status_code == 200
        data = response.json()
        assert "breakdowns" in data
        assert "languages" in data["breakdowns"]
        assert "occupations" in data["breakdowns"]
        assert "states" in data["breakdowns"]

    def test_all_channels_and_categories_templates(self):
        from app.seed_all_templates import seed_all_templates
        db = TestingSessionLocal()
        seed_all_templates(db)
        db.close()

        comm_headers = get_auth_headers(settings.COMMUNICATOR_EMAIL, settings.COMMUNICATOR_PASSWORD)
        response = client.get("/api/templates", headers=comm_headers)
        assert response.status_code == 200
        templates = response.json()
        
        # Collect distinct channel-category combinations
        combos = set((t["channel"], t["category"]) for t in templates)
        
        expected_channels = {"email", "sms", "whatsapp", "push", "website"}
        expected_categories = {"emergency", "awareness", "education", "announcement"}
        
        found_channels = set(t["channel"] for t in templates)
        found_categories = set(t["category"] for t in templates)
        
        assert expected_channels.issubset(found_channels)
        assert expected_categories.issubset(found_categories)
        assert len(combos) >= 20


# ========================================================================
# 10. MFA AND DYNAMIC OTP TESTS
# ========================================================================

class TestMFAAndOTP:
    def test_request_otp_returns_otp_when_mocked(self):
        # Trigger OTP request for admin email
        response = client.post(f"/api/auth/request-otp?email={settings.ADMIN_EMAIL}")
        assert response.status_code == 200
        data = response.json()
        assert data["mocked"] is True
        assert "otp" in data
        assert len(data["otp"]) == 6

    def test_settings_update_triggers_mfa_challenge(self):
        admin_headers = get_auth_headers(settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD)
        payload = {
            "SMTP_EMAIL": "test@test.com",
            "SMTP_APP_PASSWORD": "xyz",
            "DAILY_CAP_EMAIL": 1000
        }
        
        # 1. Update settings without X-MFA-OTP header -> Should yield 403 Forbidden with mfa_required
        response = client.post("/api/settings", json=payload, headers=admin_headers)
        assert response.status_code == 403
        data = response.json()
        assert data["detail"]["mfa_required"] is True
        assert "otp" in data["detail"]
        mfa_otp = data["detail"]["otp"]
        
        # 2. Resubmit with the correct X-MFA-OTP header -> Should succeed
        headers_with_mfa = {**admin_headers, "X-MFA-OTP": mfa_otp}
        response_success = client.post("/api/settings", json=payload, headers=headers_with_mfa)
        assert response_success.status_code == 200
        assert response_success.json()["message"] == "Settings updated successfully"

