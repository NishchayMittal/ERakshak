import asyncio
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # case_id -> list of active websockets
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, case_id: str):
        await websocket.accept()
        if case_id not in self.active_connections:
            self.active_connections[case_id] = []
        self.active_connections[case_id].append(websocket)

    def disconnect(self, websocket: WebSocket, case_id: str):
        if case_id in self.active_connections:
            if websocket in self.active_connections[case_id]:
                self.active_connections[case_id].remove(websocket)
            if not self.active_connections[case_id]:
                del self.active_connections[case_id]

    async def broadcast_to_case(self, case_id: str, message: dict):
        if case_id in self.active_connections:
            dead_sockets = []
            for connection in self.active_connections[case_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_sockets.append(connection)
            for ds in dead_sockets:
                self.disconnect(ds, case_id)

manager = ConnectionManager()
