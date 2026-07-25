"""
Unit tests for Hands-Free Voice-to-Campaign AI Assistant feature.
"""

import pytest
from unittest.mock import patch, MagicMock
from app.services.ai_service import plan_complete_campaign


@patch("app.services.ai_service._call_groq")
def test_voice_campaign_plan_generation(mock_call_groq):
    mock_json_response = """
    {
      "campaign": {
        "title": "Varanasi Flood Relief Emergency Drive",
        "objective": "Provide immediate flood evacuation warnings and shelter info",
        "campaign_type": "emergency_alert",
        "description": "Urgent evacuation notice for citizens near Ganges riverbanks"
      },
      "target_segment": {
        "suggested_name": "Varanasi Ganges Riverbank Residents",
        "description": "Citizens living in flood-prone districts of Varanasi"
      },
      "delivery": {
        "channels": ["voice", "sms", "whatsapp"],
        "schedule": "immediate"
      },
      "message": {
        "subject": "🚨 Flood Evacuation Alert - Varanasi",
        "body": "Dear {{first_name}}, a flood warning has been issued for {{city}}. Please evacuate to nearest relief shelter immediately."
      }
    }
    """
    mock_call_groq.return_value = mock_json_response

    plan = plan_complete_campaign(
        brief="Create an emergency flood alert campaign for Varanasi in Hindi",
        category_hint="emergency"
    )

    assert plan is not None
    assert plan["campaign"]["title"] == "Varanasi Flood Relief Emergency Drive"
    assert plan["campaign"]["campaign_type"] == "emergency_alert"
    assert "voice" in plan["delivery"]["channels"]
    assert "flood" in plan["message"]["body"].lower() or "evacuate" in plan["message"]["body"].lower()
