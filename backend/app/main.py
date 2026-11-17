from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.core.telemetry import telemetry_service
from app.core.database import db_manager
from app.models.schemas import Base

from app.api.websockets import router as websocket_router
from app.api.chat import router as chat_router
from app.api.history import router as history_router
from app.api.image import router as image_router

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Adatbázis táblák ellenőrzése és létrehozása...")
    async with db_manager.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Táblák sikeresen inicializálva.")
    yield
    await db_manager.engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routerek csatlakoztatása
app.include_router(websocket_router, tags=["WebSockets"])
app.include_router(chat_router, tags=["LLM Chat"])
app.include_router(history_router, tags=["History"])
app.include_router(image_router, tags=["Image Generation"])

@app.get("/health", tags=["Health"])
async def health_check():
    current_hardware = telemetry_service.get_all_metrics()
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "database_configured": True,
        "telemetry_sample": current_hardware
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
