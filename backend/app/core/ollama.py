import httpx
import json
import time
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    async def generate_stream(self, model: str, messages: list, temperature: float = 0.7) -> AsyncGenerator[dict, None]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature
            }
        }

        start_time = time.perf_counter()
        first_token_time = None
        token_count = 0

        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", url, json=payload, timeout=None) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        data = json.loads(line)
                        current_time = time.perf_counter()

                        if first_token_time is None:
                            first_token_time = current_time
                            ttft_ms = (first_token_time - start_time) * 1000
                            data["ttft_ms"] = round(ttft_ms, 2)

                        token_count += 1

                        if "message" in data:
                            data["response"] = data["message"].get("content", "")

                        if data.get("done"):
                            total_time_ms = (current_time - start_time) * 1000
                            generation_time_s = current_time - first_token_time
                            tps = token_count / generation_time_s if generation_time_s > 0 else 0.0

                            data["metrics"] = {
                                "latency_ms": round(total_time_ms, 2),
                                "tps": round(tps, 2),
                                "total_tokens": token_count
                            }

                        yield data

            except httpx.HTTPError as e:
                logger.error(f"Hálózati hiba az Ollama API hívásakor: {e}")
                yield {"error": str(e), "done": True}

ollama_client = OllamaClient()
