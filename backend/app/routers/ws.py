import os
import json
import asyncio
import logging
import redis.asyncio as redis_async
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws_manager import manager

router = APIRouter(tags=["websockets"])
logger = logging.getLogger(__name__)

async def redis_listener():
    try:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        r = await redis_async.from_url(redis_url)
        pubsub = r.pubsub()
        await pubsub.psubscribe("case_updates:*")
        
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                channel = message["channel"].decode("utf-8")
                case_id = channel.split(":")[1]
                data = json.loads(message["data"].decode("utf-8"))
                await manager.broadcast_to_case(case_id, data)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Redis listener failed: {e}")

@router.websocket("/ws/cases/{case_id}")
async def websocket_endpoint(websocket: WebSocket, case_id: str):
    await manager.connect(websocket, case_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, case_id)
