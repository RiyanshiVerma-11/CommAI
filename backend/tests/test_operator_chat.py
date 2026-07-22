import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token
from app.database import SessionLocal
from app.models import User, OperatorMessage

client = TestClient(app)

def get_token_for_role(email: str, role: str, user_id: str):
    return create_access_token(data={"sub": email, "role": role, "user_id": user_id})

def test_operator_chat_access_control():
    db = SessionLocal()
    try:
        # Create test users if missing
        admin = db.query(User).filter(User.role == "admin").first()
        manager = db.query(User).filter(User.role == "campaign_manager").first()
        audience = db.query(User).filter(User.role == "audience").first()

        if not admin or not manager or not audience:
            pytest.skip("Test users not seeded in DB")

        admin_token = get_token_for_role(admin.email, admin.role, admin.id)
        manager_token = get_token_for_role(manager.email, manager.role, manager.id)
        audience_token = get_token_for_role(audience.email, audience.role, audience.id)

        # 1. Audience user must be rejected with 403 FORBIDDEN
        resp_aud = client.get(
            "/api/operator-chat/messages",
            headers={"Authorization": f"Bearer {audience_token}"}
        )
        assert resp_aud.status_code == 403

        resp_aud_post = client.post(
            "/api/operator-chat/messages",
            json={"message": "I am an audience user trying to hack"},
            headers={"Authorization": f"Bearer {audience_token}"}
        )
        assert resp_aud_post.status_code == 403

        # 2. Manager user can post and fetch messages
        resp_mgr_post = client.post(
            "/api/operator-chat/messages",
            json={"message": "Shift handover update by manager", "channel": "general"},
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert resp_mgr_post.status_code == 201
        msg_data = resp_mgr_post.json()
        assert msg_data["sender_name"] == manager.full_name
        assert msg_data["sender_role"] == "campaign_manager"

        # 3. Admin user can fetch messages and see manager's message
        resp_admin_get = client.get(
            "/api/operator-chat/messages?channel=general",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp_admin_get.status_code == 200
        messages = resp_admin_get.json()
        assert any(m["id"] == msg_data["id"] for m in messages)

        # 4. Admin user can delete the message
        resp_del = client.delete(
            f"/api/operator-chat/messages/{msg_data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp_del.status_code == 200

    finally:
        db.close()
