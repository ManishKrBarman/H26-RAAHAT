import os
import tempfile
import time

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

# Your prediction functions
from predict_video import raahat_predict_video
from predict_audio import raahat_predict_audio


# ══════════ CONFIG ══════════
DEBUG_VIDEO_DIR = "debug_videos"
os.makedirs(DEBUG_VIDEO_DIR, exist_ok=True)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
# ════════════════════════════


app = FastAPI(
    title="Raahat Model API",
    version="2.0.0",
)


# ══════════ REQUEST / RESPONSE MODELS ══════════

class PredictRequest(BaseModel):
    video_path: str = Field(..., description="MongoDB Video document _id")
    intersection_id: str = Field(..., description="Intersection ID")
    lane_id: str = Field(..., description="Lane ID (A, B, C, D)")
    line_type: Optional[str] = Field(None, description="horizontal or vertical")


class PredictResponse(BaseModel):
    line: str
    vehicle_count: int
    density: str
    avg_speed: float
    emergency: bool
    audio_used: bool

    video_score: float
    audio_score: float
    final_score: float


# ══════════ HEALTH CHECK ══════════

@app.get("/health")
async def health():
    return {"status": "ok"}


# ══════════ MAIN PREDICT ENDPOINT ══════════

@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    tmp_video_path = None

    try:
        # ── 1. DOWNLOAD VIDEO FROM BACKEND ──
        stream_url = f"{BACKEND_URL}/video/stream/{req.video_path}"
        print(f"Downloading video from {stream_url} ...")

        tmp_fd, tmp_video_path = tempfile.mkstemp(suffix=".mp4")
        os.close(tmp_fd)

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(stream_url)

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to download video from backend: HTTP {resp.status_code}"
                )

            with open(tmp_video_path, "wb") as f:
                f.write(resp.content)

        file_size_mb = os.path.getsize(tmp_video_path) / (1024 * 1024)
        print(f"Video downloaded: {file_size_mb:.1f} MB")

        # ── 2. LINE DETECTION ──
        line = _derive_line(req.lane_id, req.line_type)

        # ── 3. OUTPUT VIDEO ──
        output_video_path = os.path.join(
            DEBUG_VIDEO_DIR,
            f"{req.lane_id}_{int(time.time())}.mp4",
        )

        # ── 4. VIDEO MODEL ──
        print("Running video model...")
        video_result = raahat_predict_video(
            input_video_path=tmp_video_path,
            output_video_path=output_video_path,
            line=line,
        )

        # ── 5. AUDIO MODEL ──
        print("Running audio model...")
        audio_used = True
        audio_emergency = False
        audio_confidence = 0.0

        try:
            audio_result = raahat_predict_audio(tmp_video_path)

            if "error" in audio_result:
                print(f"Audio skipped: {audio_result['error']}")
                audio_used = False
            else:
                audio_emergency = audio_result["emergency_audio"]
                audio_confidence = audio_result["confidence"]

        except Exception as e:
            print(f"Audio failed: {e}")
            audio_used = False

        # ── 6. FUSION LOGIC ──
        video_emergency = video_result["emergency_video"]

        video_score = 0.8 if video_emergency else 0.2

        if audio_used and audio_emergency:
            audio_score = audio_confidence
        else:
            audio_score = 0.2

        final_score = 0.4 * video_score + 0.6 * audio_score
        final_emergency = final_score >= 0.65

        print(f"Result: emergency={final_emergency}, "
              f"video_score={video_score:.3f}, audio_score={audio_score:.3f}, "
              f"final_score={final_score:.3f}")

        # ── 7. RESPONSE ──
        return {
            "line": video_result["line"],
            "vehicle_count": video_result["vehicle_count"],
            "density": video_result["density"],
            "avg_speed": video_result["avg_speed"],
            "emergency": final_emergency,
            "audio_used": audio_used,
            "video_score": round(video_score, 3),
            "audio_score": round(audio_score, 3),
            "final_score": round(final_score, 3),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_video_path and os.path.exists(tmp_video_path):
            os.remove(tmp_video_path)


# ══════════ HELPER ══════════

def _derive_line(lane_id: str, line_type: Optional[str]) -> str:
    if line_type:
        return line_type

    lane = lane_id.upper()

    if lane in ("A", "C"):
        return "horizontal"
    elif lane in ("B", "D"):
        return "vertical"

    return "horizontal"


# ══════════ RUN ══════════

if __name__ == "__main__":
    uvicorn.run(
        "predict:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )