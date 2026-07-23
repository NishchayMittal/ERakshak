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
    pubsub = None
    r = None
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
        if pubsub:
            try:
                await pubsub.punsubscribe("case_updates:*")
                await pubsub.close()
            except Exception:
                pass
    except Exception as e:
        logger.info(f"Local Environment: Redis is offline ({e}). WebSocket manager will operate in local fallback memory mode.")
    finally:
        if r:
            try:
                # Safely disconnect pool if it is a coroutine
                disconnect_func = r.connection_pool.disconnect
                if asyncio.iscoroutinefunction(disconnect_func):
                    await disconnect_func()
                else:
                    disconnect_func()
                # Use aclose() for async client close
                await r.aclose()
            except Exception:
                pass

@router.websocket("/ws/cases/{case_id}")
async def websocket_endpoint(websocket: WebSocket, case_id: str):
    await manager.connect(websocket, case_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, case_id)
