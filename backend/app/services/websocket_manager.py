"""
WebSocket Connection Manager — Manages active WebSocket connections
for broadcasting real-time emergency bulletins.
"""
import logging
import json
from fastapi import WebSocket

logger = logging.getLogger("commai.websocket")


class ConnectionManager:
    """Manages WebSocket connections for live bulletin broadcasts."""

    def __init__(self):
        self.active_connections: list[dict] = []

    async def connect(self, websocket: WebSocket, user_id: str = None, state: str = None, role: str = None):
        await websocket.accept()
        self.active_connections.append({
            "websocket": websocket,
            "user_id": user_id,
            "state": state,
            "role": role,
        })
        logger.info(f"[WS] Client connected: user_id={user_id}, state={state}, role={role}. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            connection
            for connection in self.active_connections
            if connection["websocket"] != websocket
        ]
        logger.info(f"[WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast a JSON message, optionally scoped to a target state."""
        payload = json.dumps(message)
        target_state = message.get("target_state")
        disconnected = []
        for connection in self.active_connections:
            # Operators (admin/campaign_manager) always receive all bulletins.
            # State-scoped emergencies are filtered only for audience sessions.
            if target_state and connection["role"] not in ("admin", "campaign_manager"):
                if connection["role"] != "audience" or connection["state"] != target_state:
                    continue
            try:
                await connection["websocket"].send_text(payload)
            except Exception:
                disconnected.append(connection["websocket"])

        # Clean up dead connections
        for conn in disconnected:
            self.disconnect(conn)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# Global singleton instance
bulletin_manager = ConnectionManager()
