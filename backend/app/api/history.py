from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.schemas import TestRunSchema

router = APIRouter()

class RenameRequest(BaseModel):
    title: str

@router.get("/history")
async def get_test_history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(TestRunSchema)
        .options(joinedload(TestRunSchema.model))
        .order_by(TestRunSchema.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    test_runs = result.scalars().all()

    history_data = []
    for run in test_runs:
        history_data.append({
            "id": str(run.id),
            "title": run.title,
            "model_name": run.model.name if run.model else "Ismeretlen",
            "prompt": run.prompt,
            "response": run.response,
            "temperature": float(run.temperature) if run.temperature else None,
            "ttft_ms": float(run.ttft_ms) if run.ttft_ms else None,
            "tps": float(run.tps) if run.tps else None,
            "latency_ms": float(run.latency_ms) if run.latency_ms else None,
            "created_at": run.created_at.isoformat()
        })

    return history_data

@router.delete("/history/{run_id}")
async def delete_history(run_id: str, db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(TestRunSchema).where(TestRunSchema.id == uuid.UUID(run_id))
        result = await db.execute(stmt)
        run = result.scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=404, detail="Beszélgetés nem található")

        await db.delete(run)
        await db.commit()
        return {"status": "success"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/history/{run_id}")
async def rename_history(run_id: str, req: RenameRequest, db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(TestRunSchema).where(TestRunSchema.id == uuid.UUID(run_id))
        result = await db.execute(stmt)
        run = result.scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=404, detail="Beszélgetés nem található")

        run.title = req.title
        await db.commit()
        return {"status": "success", "title": run.title}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
