/**
 * model.service.js — AI Model Abstraction Layer
 * 
 * Calls the Python FastAPI prediction server (YOLOv8) to analyze
 * traffic videos.
 * 
 * SETUP:
 *   1. cd model/ && pip install -r requirements.txt
 *   2. python predict.py          → starts on http://localhost:8000
 *   3. Set MODEL_API_URL env var if using a different host/port
 */

const axios = require("axios");

// ══════════════════ CONFIG ══════════════════
const USE_REAL_MODEL = true;
const MODEL_API_URL = process.env.MODEL_API_URL || "http://localhost:8000/predict";
const MODEL_HEALTH_URL = MODEL_API_URL.replace("/predict", "/health");
const MODEL_TIMEOUT = parseInt(process.env.MODEL_TIMEOUT || "120000"); // 120s
// ════════════════════════════════════════════

/**
 * Analyze a video and return traffic data for that lane.
 * 
 * @param {string} videoPath       - Video document _id (MongoDB)
 * @param {string} intersectionId  - Intersection this video belongs to
 * @param {string} laneId          - Lane this video belongs to
 * @returns {Promise<Object>}      - { vehicle_count, avg_speed, density, emergency }
 */
async function analyzeVideo(videoPath, intersectionId, laneId) {
    if (USE_REAL_MODEL) {
        // Call the REAL model — NO silent fallback to mock.
        // If the model server is down, let the error propagate
        // so the user knows and can fix it.
        const result = await callRealModel(videoPath, intersectionId, laneId);
        console.log(`🤖 [REAL MODEL] ${intersectionId}/${laneId}:`, JSON.stringify(result));
        return result;
    } else {
        const result = mockAnalysis(laneId);
        console.log(`🎲 [MOCK DATA]  ${intersectionId}/${laneId}:`, JSON.stringify(result));
        return result;
    }
}

/**
 * REAL MODEL — Calls the Python FastAPI prediction server.
 * The Python server downloads the video from GridFS via our stream endpoint,
 * runs YOLOv8 inference, and returns traffic metrics.
 */
async function callRealModel(videoPath, intersectionId, laneId) {
    console.log(`📡 Calling model API: ${MODEL_API_URL}`);
    console.log(`   video_path=${videoPath}, intersection=${intersectionId}, lane=${laneId}`);

    try {
        const response = await axios.post(
            MODEL_API_URL,
            {
                video_path: videoPath,
                intersection_id: intersectionId,
                lane_id: laneId,
            },
            {
                timeout: MODEL_TIMEOUT,
                headers: { "Content-Type": "application/json" },
            }
        );

        // Validate response has required fields
        const data = response.data;
        if (
            typeof data.vehicle_count !== "number" ||
            typeof data.density !== "string" ||
            typeof data.emergency !== "boolean"
        ) {
            throw new Error(`Invalid response from model: ${JSON.stringify(data)}`);
        }

        return data;
    } catch (err) {
        if (err.response) {
            const detail = err.response.data?.detail || err.response.data?.error || err.message;
            console.error(`❌ Model API error [${err.response.status}] for ${intersectionId}/${laneId}: ${detail}`);
            throw new Error(`Model prediction failed (${err.response.status}): ${detail}`);
        }
        if (err.code === "ECONNREFUSED") {
            console.error(`❌ Model server is NOT running at ${MODEL_API_URL}`);
            console.error(`   Start it with: cd model/ && python predict.py`);
        }
        throw new Error(`Model prediction failed: ${err.message}`);
    }
}

/**
 * Check if the model server is healthy.
 * @returns {Promise<boolean>}
 */
async function isModelHealthy() {
    try {
        const resp = await axios.get(MODEL_HEALTH_URL, { timeout: 5000 });
        return resp.data?.status === "ok" && resp.data?.model_loaded === true;
    } catch {
        return false;
    }
}

/**
 * MOCK MODEL — Returns random traffic data.
 * Only used when USE_REAL_MODEL is explicitly set to false.
 */
function mockAnalysis(laneId) {
    const vehicleCount = Math.floor(Math.random() * 50);
    const avgSpeed = Math.floor(Math.random() * 60) + 5;

    let density;
    if (vehicleCount > 35) density = "high";
    else if (vehicleCount > 15) density = "medium";
    else density = "low";

    return {
        vehicle_count: vehicleCount,
        avg_speed: avgSpeed,
        density,
        emergency: Math.random() < 0.05
    };
}

module.exports = { analyzeVideo, isModelHealthy };
