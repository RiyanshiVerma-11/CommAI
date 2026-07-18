"""
Sentiment Map Routes — Aggregates emergency data by state for
geographic sentiment visualization on an interactive India map.
"""
import json
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any

from app.database import get_db
from app.models import EmergencyContact, User, Audience
from app.auth import require_manager_or_higher

logger = logging.getLogger("commai.sentiment_map")

router = APIRouter(prefix="/sentiment-map", tags=["Sentiment Map"])

# State centroids (approximate lat/lng for major Indian states)
STATE_COORDINATES = {
    "Andhra Pradesh": {"lat": 15.9129, "lng": 79.7400},
    "Arunachal Pradesh": {"lat": 28.2180, "lng": 94.7278},
    "Assam": {"lat": 26.2006, "lng": 92.9376},
    "Bihar": {"lat": 25.0961, "lng": 85.3131},
    "Chhattisgarh": {"lat": 21.2787, "lng": 81.8661},
    "Delhi": {"lat": 28.7041, "lng": 77.1025},
    "Goa": {"lat": 15.2993, "lng": 74.1240},
    "Gujarat": {"lat": 22.2587, "lng": 71.1924},
    "Haryana": {"lat": 29.0588, "lng": 76.0856},
    "Himachal Pradesh": {"lat": 31.1048, "lng": 77.1734},
    "Jharkhand": {"lat": 23.6102, "lng": 85.2799},
    "Karnataka": {"lat": 15.3173, "lng": 75.7139},
    "Kerala": {"lat": 10.8505, "lng": 76.2711},
    "Madhya Pradesh": {"lat": 22.9734, "lng": 78.6569},
    "Maharashtra": {"lat": 19.7515, "lng": 75.7139},
    "Manipur": {"lat": 24.6637, "lng": 93.9063},
    "Meghalaya": {"lat": 25.4670, "lng": 91.3662},
    "Mizoram": {"lat": 23.1645, "lng": 92.9376},
    "Nagaland": {"lat": 26.1584, "lng": 94.5624},
    "Odisha": {"lat": 20.9517, "lng": 85.0985},
    "Punjab": {"lat": 31.1471, "lng": 75.3412},
    "Rajasthan": {"lat": 27.0238, "lng": 74.2179},
    "Sikkim": {"lat": 27.5330, "lng": 88.5122},
    "Tamil Nadu": {"lat": 11.1271, "lng": 78.6569},
    "Telangana": {"lat": 18.1124, "lng": 79.0193},
    "Tripura": {"lat": 23.9408, "lng": 91.9882},
    "Uttar Pradesh": {"lat": 26.8467, "lng": 80.9462},
    "Uttarakhand": {"lat": 30.0668, "lng": 79.0193},
    "West Bengal": {"lat": 22.9868, "lng": 87.8550},
    "Jammu and Kashmir": {"lat": 33.7782, "lng": 76.5762},
    "Ladakh": {"lat": 34.1526, "lng": 77.5771},
    "New Delhi": {"lat": 28.6139, "lng": 77.2090},
}


@router.get("/data")
def get_sentiment_map_data(
    db: Session = Depends(get_db),
    current_user=Depends(require_manager_or_higher),
) -> List[Dict[str, Any]]:
    """
    Aggregate emergency contacts by state with urgency breakdown.
    Returns data points for map visualization.
    """
    # Join EmergencyContact -> User -> Audience to get state info
    # Get all emergency contacts with user info
    emergencies = (
        db.query(EmergencyContact, User)
        .join(User, User.id == EmergencyContact.user_id)
        .all()
    )

    # Map user IDs to audience states
    user_ids = list(set(e.user_id for e, _ in emergencies))
    user_emails = {u.id: u.email for _, u in emergencies}

    # Get audience records for these users (by email match)
    audience_states = {}
    if user_emails:
        for uid, email in user_emails.items():
            aud = db.query(Audience).filter(
                Audience.email == email,
                Audience.is_deleted == False
            ).first()
            if aud:
                audience_states[uid] = aud.state
            else:
                audience_states[uid] = "Unknown"

    # Aggregate by state
    state_data = {}
    for emergency, user in emergencies:
        state = audience_states.get(emergency.user_id, "Unknown")
        if state not in state_data:
            state_data[state] = {
                "state": state,
                "total": 0,
                "critical": 0,
                "urgent": 0,
                "normal": 0,
                "open": 0,
                "resolved": 0,
                "subjects": [],
            }

        state_data[state]["total"] += 1
        urgency = emergency.urgency or "normal"
        if urgency == "critical":
            state_data[state]["critical"] += 1
        elif urgency == "urgent":
            state_data[state]["urgent"] += 1
        else:
            state_data[state]["normal"] += 1

        if emergency.status == "open":
            state_data[state]["open"] += 1
        else:
            state_data[state]["resolved"] += 1

        # Keep last 3 subjects for tooltip
        if len(state_data[state]["subjects"]) < 3:
            state_data[state]["subjects"].append(emergency.subject[:60])

    # Build result with coordinates and sentiment
    result = []
    for state, data in state_data.items():
        coords = STATE_COORDINATES.get(state)

        # Determine sentiment based on urgency distribution
        if data["critical"] > 0:
            sentiment = "critical"
        elif data["urgent"] > data["normal"]:
            sentiment = "concerning"
        else:
            sentiment = "stable"

        result.append({
            "state": state,
            "lat": coords["lat"] if coords else None,
            "lng": coords["lng"] if coords else None,
            "total": data["total"],
            "critical_count": data["critical"],
            "urgent_count": data["urgent"],
            "normal_count": data["normal"],
            "open_count": data["open"],
            "resolved_count": data["resolved"],
            "sentiment": sentiment,
            "recent_subjects": data["subjects"],
        })

    # Sort by total descending
    result.sort(key=lambda x: x["total"], reverse=True)
    return result
