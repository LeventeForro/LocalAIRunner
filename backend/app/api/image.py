import httpx
import json
import asyncio
import base64
import random
import logging
import os
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

COMFYUI_URL = "http://127.0.0.1:8188"
COMFYUI_INPUT_DIR = r"C:\Users\forro\Documents\LocalAIRunner\ComfyUI_windows_portable\ComfyUI\input"

@router.get("/image-models")
async def get_image_models():
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{COMFYUI_URL}/object_info")
            response.raise_for_status()
            data = response.json()
            if "CheckpointLoaderSimple" in data:
                models_list = data["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
                return {"models": models_list}
            return {"models": []}
        except Exception as e:
            logger.error(f"Hiba a képgeneráló modellek lekérésekor: {e}")
            return {"models": []}

@router.post("/generate-image")
async def generate_image(
    prompt: str = Form(...),
    model_name: str = Form(...),
    image: Optional[UploadFile] = File(None)
):
    input_image_filename = None

    if image:
        try:
            os.makedirs(COMFYUI_INPUT_DIR, exist_ok=True)
            input_image_filename = f"upload_{random.randint(1000, 9999)}_{image.filename}"
            file_path = os.path.join(COMFYUI_INPUT_DIR, input_image_filename)

            contents = await image.read()
            with open(file_path, "wb") as f:
                f.write(contents)
        except Exception as e:
            logger.error(f"Hiba a kép mentésekor: {e}")
            raise HTTPException(status_code=500, detail="Nem sikerült feldolgozni a feltöltött képet.")

    if input_image_filename:
        workflow = {
            "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 1000000), "steps": 20, "cfg": 7, "sampler_name": "euler", "scheduler": "normal", "denoise": 0.65, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["10", 0]}},
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model_name}},
            "5": {"class_type": "LoadImage", "inputs": {"image": input_image_filename}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "bad quality, blurry, ugly, text, watermark", "clip": ["4", 1]}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "LocalAI_Img2Img", "images": ["8", 0]}},
            "10": {"class_type": "VAEEncode", "inputs": {"pixels": ["5", 0], "vae": ["4", 2]}}
        }
    else:
        workflow = {
            "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 1000000), "steps": 20, "cfg": 7, "sampler_name": "euler", "scheduler": "normal", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model_name}},
            "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "bad quality, blurry, ugly, text, watermark", "clip": ["4", 1]}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "LocalAI", "images": ["8", 0]}}
        }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            post_data = {"prompt": workflow}
            response = await client.post(f"{COMFYUI_URL}/prompt", json=post_data)
            response.raise_for_status()
            prompt_id = response.json()["prompt_id"]

            while True:
                hist_res = await client.get(f"{COMFYUI_URL}/history/{prompt_id}")
                history = hist_res.json()

                if prompt_id in history:
                    outputs = history[prompt_id].get("outputs", {})
                    if "9" in outputs and "images" in outputs["9"]:
                        image_info = outputs["9"]["images"][0]
                        filename = image_info["filename"]
                        subfolder = image_info["subfolder"]
                        folder_type = image_info["type"]
                        break

                await asyncio.sleep(1)

            img_url = f"{COMFYUI_URL}/view?filename={filename}&subfolder={subfolder}&type={folder_type}"
            img_response = await client.get(img_url)
            img_response.raise_for_status()

            base64_img = base64.b64encode(img_response.content).decode('utf-8')
            return {"image_base64": f"data:image/png;base64,{base64_img}"}

        except Exception as e:
            logger.error(f"Képgenerálási hiba: {e}")
            raise HTTPException(status_code=500, detail="Nem sikerült kommunikálni a ComfyUI-val.")
