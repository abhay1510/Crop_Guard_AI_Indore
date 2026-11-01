import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from . import drone
from . import predict as P
from .preprocessing import InvalidImageError, decode_image

logging.basicConfig(level=logging.INFO)
MAX_BYTES = 8 * 1024 * 1024
MAX_DRONE_BYTES = 50 * 1024 * 1024


@asynccontextmanager
async def lifespan(_: FastAPI):
    P.load_model()  # load once, not per request
    yield


app = FastAPI(title="CropGuard AI Service", version="2.0", lifespan=lifespan)


@app.get("/health")
def health():
    s = P.status()
    return {"status": "ok", "mode": s["mode"], "model_loaded": s["model_loaded"], "demo": False, "reason": s["reason"]}


@app.get("/model-info")
def model_info():
    return P.status()


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image too large (max 8 MB)")
    try:
        img = decode_image(data)
    except InvalidImageError as e:
        raise HTTPException(400, str(e))
    result = P.predict(img)
    if result is None:
        raise HTTPException(503, f"No trained model loaded ({P.status()['reason']}). Run training/train.py and put outputs in ai-service/models/.")
    return result


async def _read_drone_file(file: UploadFile) -> bytes:
    data = await file.read(MAX_DRONE_BYTES + 1)
    if len(data) > MAX_DRONE_BYTES:
        raise HTTPException(413, "Drone image too large (max 50 MB)")
    return data


@app.post("/drone/preview")
async def drone_preview_endpoint(file: UploadFile = File(...)):
    data = await _read_drone_file(file)
    try:
        return drone.preview(data)
    except drone.InvalidDroneImageError as error:
        raise HTTPException(400, str(error)) from error


@app.post("/drone/analyze")
async def drone_analyze_endpoint(
    file: UploadFile = File(...),
    gemini_api_key: str | None = Form(None),
    gemini_model: str = Form("gemini-3.5-flash-lite"),
    language: str = Form("en"),
):
    data = await _read_drone_file(file)
    if not gemini_api_key:
        raise HTTPException(503, "Gemini image analysis is not configured. Set GEMINI_API_KEY in backend/.env.")
    if language not in {"en", "hi", "mr"}:
        raise HTTPException(400, "Choose English, Hindi, or Marathi.")
    try:
        result = await run_in_threadpool(drone.analyze, data, gemini_api_key, gemini_model, language)
    except drone.InvalidDroneImageError as error:
        raise HTTPException(400, str(error)) from error
    except drone.GeminiAnalysisError as error:
        raise HTTPException(error.status_code, str(error)) from error
    return result