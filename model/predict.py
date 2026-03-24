"""
predict.py — FastAPI Prediction Server for Raahat Traffic System

Downloads video from the Node.js backend (GridFS stream),
runs YOLOv8 inference via predict_fun.py, returns traffic analysis JSON.

Usage:
    python predict.py
    # Server starts at http://localhost:8000

Endpoints:
    GET  /health   — Health check
    POST /predict  — Run video analysis
"""

import os
import tempfile
import time
from pathlib import Path
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ultralytics import YOLO

from predict_fun import predict_video_analytics

# ══════════ CONFIG ══════════
MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "best2.pt"))
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
MODEL_PORT = int(os.environ.get("MODEL_PORT", 8000))
DEBUG_VIDEO_DIR = os.path.join(os.path.dirname(__file__), "debug_videos")
# ════════════════════════════

# Global model reference
yolo_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global yolo_model
    print(f"🔄 Loading YOLO model from: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Model file not found: {MODEL_PATH}")
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")
    yolo_model = YOLO(MODEL_PATH)
    print(f"✅ YOLO model loaded successfully")
    os.makedirs(DEBUG_VIDEO_DIR, exist_ok=True)
    yield
    print("🛑 Shutting down model server")


app = FastAPI(
    title="Raahat Traffic Model Server",
    description="YOLOv8 video analysis for traffic management",
    version="1.0.0",
    lifespan=lifespan,
)


# ══════════ REQUEST / RESPONSE SCHEMAS ══════════


class PredictRequest(BaseModel):
    video_path: str = Field(..., description="MongoDB Video document _id")
    intersection_id: str = Field(..., description="Intersection identifier (e.g. INT-001)")
    lane_id: str = Field(..., description="Lane identifier (e.g. A, B, C, D)")
    line_type: Optional[str] = Field(
        None,
        description="'horizontal' or 'vertical'. Auto-derived from lane_id if omitted.",
    )


class PredictResponse(BaseModel):
    vehicle_count: int
    avg_speed: float
    average_speed: float
    density: str
    density_value: float
    emergency: bool


# ══════════ ENDPOINTS ══════════


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": yolo_model is not None,
        "model_path": MODEL_PATH,
        "backend_url": BACKEND_URL,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    if yolo_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    video_doc_id = req.video_path
    stream_url = f"{BACKEND_URL}/video/stream/{video_doc_id}"

    # ── 1. Download video from backend GridFS ──
    tmp_video_path = None
    try:
        print(f"📥 Downloading video from: {stream_url}")
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(stream_url)

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to download video from backend: HTTP {response.status_code}",
            )

        # Save to temp file
        suffix = ".mp4"
        tmp_fd, tmp_video_path = tempfile.mkstemp(suffix=suffix, prefix="raahat_")
        os.close(tmp_fd)

        with open(tmp_video_path, "wb") as f:
            f.write(response.content)

        file_size_mb = os.path.getsize(tmp_video_path) / (1024 * 1024)
        print(f"✅ Video downloaded: {file_size_mb:.1f}MB → {tmp_video_path}")

        # ── 2. Determine line parameter from lane_id ──
        line = _derive_line(req.lane_id, req.line_type)

        # ── 3. Generate debug output video path ──
        output_video_path = os.path.join(
            DEBUG_VIDEO_DIR,
            f"{req.intersection_id}_{req.lane_id}_{int(time.time())}.mp4",
        )

        # ── 4. Run YOLO inference ──
        print(f"🔍 Running YOLOv8 analysis for {req.intersection_id}/{req.lane_id} (line={line})...")
        start_time = time.time()

        raw_result = predict_video_analytics(
            model_path=MODEL_PATH,
            input_video_path=tmp_video_path,
            output_video_path=output_video_path,
            line=line,
        )

        elapsed = time.time() - start_time
        print(f"✅ Analysis complete in {elapsed:.1f}s: {raw_result}")

        # ── 5. Normalize response to match API contract ──
        normalized = _normalize_response(raw_result)
        return normalized

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    finally:
        # Clean up temp video file
        if tmp_video_path and os.path.exists(tmp_video_path):
            try:
                os.unlink(tmp_video_path)
            except OSError:
                pass


# ══════════ HELPERS ══════════


def _derive_line(lane_id: str, line_type: Optional[str]) -> str:
    """
    Derive the counting line type from lane_id or explicit line_type.
    A/C → horizontal, B/D → vertical.
    """
    if line_type:
        return line_type

    lane_upper = lane_id.upper()
    if lane_upper in ("A", "C"):
        return "horizontal"
    elif lane_upper in ("B", "D"):
        return "vertical"
    else:
        return "horizontal"  # default


def _normalize_response(raw: dict) -> dict:
    """
    Normalize predict_fun.py output to match the API contract.

    predict_fun.py returns:
        { line, vehicle_count, density, avg_speed, emergency: "true"/"false" }

    API contract expects:
        { vehicle_count, avg_speed, average_speed, density, density_value, emergency: bool }
    """
    vehicle_count = raw.get("vehicle_count", 0)
    avg_speed = raw.get("avg_speed", 0.0)

    # Emergency: convert string "true"/"false" → bool
    emergency_raw = raw.get("emergency", False)
    if isinstance(emergency_raw, str):
        emergency = emergency_raw.lower() == "true"
    else:
        emergency = bool(emergency_raw)

    # Density: re-derive using API contract thresholds (≤15 low, 16-35 medium, >35 high)
    if vehicle_count <= 15:
        density = "low"
    elif vehicle_count <= 35:
        density = "medium"
    else:
        density = "high"

    # Density value: approximate as vehicle_count (numeric density)
    density_value = float(vehicle_count)

    return {
        "vehicle_count": vehicle_count,
        "avg_speed": avg_speed,
        "average_speed": avg_speed,
        "density": density,
        "density_value": density_value,
        "emergency": emergency,
    }


# ══════════ ENTRY POINT ══════════

if __name__ == "__main__":
    uvicorn.run(
        "predict:app",
        host="0.0.0.0",
        port=MODEL_PORT,
        reload=False,
        log_level="info",
    )
