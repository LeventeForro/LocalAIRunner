import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.telemetry import telemetry_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/telemetry")
async def telemetry_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("Új WebSocket kliens csatlakozott a telemetria streamhez.")
    
    try:
        while True:
            metrics = telemetry_service.get_all_metrics()
            
            await websocket.send_json(metrics)
            
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        logger.info("WebSocket kliens lecsatlakozott.")
    except Exception as e:
        logger.error(f"Váratlan hiba a WebSocket streamelés során: {e}")