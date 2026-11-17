import json
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.ollama import ollama_client
from app.core.database import get_db
from app.models.schemas import ModelSchema, TestRunSchema

logger = logging.getLogger(__name__)
router = APIRouter()

class MessageItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    model: str = "llama3.2:latest"
    messages: List[MessageItem]
    temperature: float = 0.7

@router.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest, db: AsyncSession = Depends(get_db)):

    current_session_id = request.session_id or str(uuid.uuid4())

    async def event_generator():
        full_response_text = ""
        final_metrics = None
        ttft_value = None

        messages_dict = [{"role": msg.role, "content": msg.content} for msg in request.messages]

        async for chunk in ollama_client.generate_stream(
            model=request.model,
            messages=messages_dict,
            temperature=request.temperature
        ):
            if "response" in chunk:
                full_response_text += chunk["response"]

            if "ttft_ms" in chunk and ttft_value is None:
                ttft_value = chunk["ttft_ms"]

            if chunk.get("done") and "metrics" in chunk:
                final_metrics = chunk["metrics"]

            chunk["session_id"] = current_session_id
            yield f"data: {json.dumps(chunk)}\n\n"

        if full_response_text:
            try:
                stmt = select(ModelSchema).where(ModelSchema.name == request.model)
                result = await db.execute(stmt)
                db_model = result.scalar_one_or_none()

                if not db_model:
                    db_model = ModelSchema(name=request.model, size_bytes=0, family="unknown")
                    db.add(db_model)
                    await db.commit()
                    await db.refresh(db_model)

                assistant_msg = {"role": "assistant", "content": full_response_text}
                if final_metrics:
                    assistant_msg["metrics"] = final_metrics
                messages_dict.append(assistant_msg)

                conversation_json = json.dumps(messages_dict)

                stmt = select(TestRunSchema).where(TestRunSchema.id == uuid.UUID(current_session_id))
                result = await db.execute(stmt)
                existing_run = result.scalar_one_or_none()

                if existing_run:
                    existing_run.prompt = conversation_json
                    existing_run.response = full_response_text
                    if final_metrics:
                        existing_run.tps = final_metrics.get("tps")
                        existing_run.latency_ms = final_metrics.get("latency_ms")
                else:
                    first_msg = request.messages[0].content if request.messages else "Beszélgetés"
                    auto_title = first_msg[:40] + "..." if len(first_msg) > 40 else first_msg

                    test_run = TestRunSchema(
                        id=uuid.UUID(current_session_id),
                        model_id=db_model.id,
                        title=auto_title,
                        prompt=conversation_json,
                        response=full_response_text,
                        temperature=request.temperature,
                        ttft_ms=ttft_value,
                        tps=final_metrics.get("tps") if final_metrics else None,
                        latency_ms=final_metrics.get("latency_ms") if final_metrics else None
                    )
                    db.add(test_run)

                await db.commit()
            except Exception as e:
                logger.error(f"Hiba az adatbázis mentés során: {e}")
                await db.rollback()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
