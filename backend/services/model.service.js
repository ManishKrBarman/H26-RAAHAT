/**
 * model.service.js — AI Model Abstraction Layer
 *
 * Calls the Python FastAPI prediction server (YOLOv8).
 * The model server downloads the video from GridFS, runs inference,
 * and returns traffic analysis data.
 *
 * Config via environment variables:
 *   MODEL_API_URL  — Full URL to /predict endpoint (default: http://localhost:8000/predict)
 *   MODEL_TIMEOUT  — Axios timeout in ms (default: 120000 = 2 minutes)
 */

const axios = require("axios");

// ══════════════════ CONFIG ══════════════════
const USE_REAL_MODEL = true;
const MODEL_API_URL = process.env.MODEL_API_URL || "http://localhost:8000/predict";
const MODEL_TIMEOUT = parseInt(process.env.MODEL_TIMEOUT || "240000", 10);
// ════════════════════════════════════════════

/**
 * Analyze a video and return traffic data for that lane.
 *
 * @param {string} videoPath       - MongoDB Video document _id
 * @param {string} intersectionId  - Intersection this video belongs to
 * @param {string} laneId          - Lane this video belongs to
 * @returns {Promise<Object>}      - { vehicle_count, avg_speed, density, emergency }
 */
async function analyzeVideo(videoPath, intersectionId, laneId) {
    if (USE_REAL_MODEL) {
        return await callRealModel(videoPath, intersectionId, laneId);
    } else {
        return mockAnalysis(laneId);
    }
}

/**
 * REAL MODEL — Calls the Python FastAPI prediction server.
 */
async function callRealModel(videoPath, intersectionId, laneId) {
    try {
        console.log(`🔄 Calling model API: ${MODEL_API_URL} (timeout: ${MODEL_TIMEOUT}ms)`);

        const response = await axios.post(
            MODEL_API_URL,
            {
                video_path: videoPath,
                intersection_id: intersectionId,
                lane_id: laneId,
            },
            { timeout: MODEL_TIMEOUT }
        );

        const data = response.data;

        // Normalize: ensure emergency is always a boolean
        if (typeof data.emergency === "string") {
            data.emergency = data.emergency.toLowerCase() === "true";
        }

        console.log(`✅ Model response for ${intersectionId}/${laneId}:`, data);
        return data;
    } catch (err) {
        console.error(`❌ Model API error for ${intersectionId}/${laneId}:`, err.message);
        throw new Error(`Model prediction failed: ${err.message}`);
    }
}

/**
 * MOCK MODEL — Returns random but realistic traffic data.
 * Used as a fallback when USE_REAL_MODEL is false.
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
        emergency: Math.random() < 0.05,
    };
}

module.exports = { analyzeVideo };
