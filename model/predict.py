"""
predict.py — FastAPI Prediction Server for Raahat Traffic System

Loads the YOLOv8 model and exposes a REST API that the Node.js backend
calls to get traffic analysis from uploaded videos.

SETUP:
    1. Ensure best.pt is in this directory
    2. pip install -r requirements.txt
    3. python predict.py
    → Server starts at http://0.0.0.0:8000

API:
    POST /predict
    Body: { "video_path": "<video_doc_id>", "intersection_id": "INT-001", "lane_id": "A" }
    Response: { "vehicle_count": 12, "avg_speed": 28.5, "density": "medium", "emergency": false }

    GET /health
    Response: { "status": "ok", "model_loaded": true }
"""

import os
import sys
import tempfile

import requests
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from predict_fun import analyze_for_api, _get_model

# ══════════ CONFIG ══════════
MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "best.pt"))
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
HOST = os.environ.get("MODEL_HOST", "0.0.0.0")
PORT = int(os.environ.get("MODEL_PORT", "8000"))

# ══════════ APP ══════════
app = FastAPI(
    title="Raahat Traffic Model API",
    description="YOLOv8-based vehicle detection and traffic analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════ REQUEST / RESPONSE SCHEMAS ══════════
class PredictRequest(BaseModel):
    video_path: str  # MongoDB Video document _id
    intersection_id: str
    lane_id: str


class PredictResponse(BaseModel):
    vehicle_count: int
    avg_speed: float
    density: str  # "low" | "medium" | "high"
    emergency: bool


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


# ══════════ STARTUP — pre-load model ══════════
@app.on_event("startup")
async def startup_event():
    """Pre-load the YOLO model at startup so first request isn't slow."""
    if os.path.exists(MODEL_PATH):
        _get_model(MODEL_PATH)
        print(f"✅ YOLOv8 model ready: {MODEL_PATH}")
    else:
        print(f"⚠️  Model not found at: {MODEL_PATH}")
        print("    Predictions will fail until the model file is available.")


# ══════════ ENDPOINTS ══════════
@app.get("/")
def home():
    return {"message": "Raahat Traffic Model API running 🚀"}


@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "model_loaded": os.path.exists(MODEL_PATH),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(data: PredictRequest):
    """
    Download the video from the Node.js backend (GridFS stream),
    run YOLOv8 analysis, and return traffic metrics.
    """
    if not os.path.exists(MODEL_PATH):
        raise HTTPException(status_code=503, detail="Model file not found")

    # Download video from Node.js backend's GridFS stream endpoint
    video_stream_url = f"{BACKEND_URL}/video/stream/{data.video_path}"
    tmp_path = None

    try:
        # Download video to a temporary file
        print(f"📥 Downloading video {data.video_path} from {video_stream_url}")
        resp = requests.get(video_stream_url, stream=True, timeout=60)

        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download video: HTTP {resp.status_code}",
            )

        # Write to temp file
        suffix = ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode="wb") as tmp:
            tmp_path = tmp.name
            for chunk in resp.iter_content(chunk_size=8192):
                tmp.write(chunk)

        print(f"📹 Video saved to {tmp_path}, running analysis...")

        # Run YOLOv8 analysis
        result = analyze_for_api(
            video_path=tmp_path,
            model_path=MODEL_PATH,
            lane_id=data.lane_id,
        )

        print(f"✅ Analysis done for {data.intersection_id}/{data.lane_id}: {result}")
        return result

    except HTTPException:
        raise
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=502,
            detail=f"Cannot connect to backend at {BACKEND_URL}. Is it running?",
        )
    except Exception as e:
        print(f"❌ Prediction error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# ══════════ MAIN ══════════
if __name__ == "__main__":
    print(f"🚀 Starting Raahat Model Server on http://{HOST}:{PORT}")
    uvicorn.run("predict:app", host=HOST, port=PORT, reload=False)