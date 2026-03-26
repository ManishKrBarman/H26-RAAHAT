/**
 * signal.engine.js — Automatic Signal Cycle Engine
 * 
 * This is the HEARTBEAT of the traffic system.
 * 
 * It runs as a background loop (every 1s) and for each registered intersection:
 *   1. Checks if the current signal timer has expired
 *   2. If expired → gathers latest analyzed data for all lanes
 *   3. Runs the decision engine to pick the best lane
 *   4. Starts a new signal cycle with that lane
 * 
 * How it handles different scenarios:
 * 
 *   NORMAL CYCLE:
 *     Timer expires → re-evaluate all lanes → pick best → start new timer
 * 
 *   MANUAL OVERRIDE (HIGHEST PRIORITY):
 *     Manual override is ALWAYS king — no automated signal can interrupt it.
 *     If emergency is detected during manual override, it is SUPPRESSED
 *     (stored in signal state for frontend warning) but never overrides.
 *     Manual timer expires → engine detects mode was MANUAL & isExpired
 *     → re-evaluates lanes → returns to AUTO mode with new decision
 * 
 *   EMERGENCY:
 *     Emergency detected in lane data → decision engine gives it score 1000+
 *     → forceOverride() immediately switches, even mid-timer
 *     UNLESS manual override is active (then suppressed)
 * 
 *   CONTINUOUS VIDEO (future):
 *     AI model writes analysis results to DB continuously
 *     → Engine reads latest data every tick → if emergency, interrupts
 *     → if normal, waits for timer to expire before switching
 * 
 *   NO DATA YET:
 *     Intersection registered but no videos analyzed → engine skips it
 *     → signal stays null until first analysis arrives
 */

const Intersection = require("../models/intersection.model");
const Video = require("../models/video.model");
const { decideSignal } = require("./decision.service");
const { updateSignal, getSignalState, forceOverride } = require("./signal.controller");

let engineInterval = null;
let isRunning = false;

/**
 * Start the engine — called once from server.js after DB connects.
 */
function startEngine() {
    if (isRunning) return;
    isRunning = true;

    console.log("⚙️  Signal Cycle Engine started (1s interval)");

    engineInterval = setInterval(async () => {
        try {
            await tick();
        } catch (err) {
            console.error("Engine tick error:", err.message);
        }
    }, 1000);
}

/**
 * Stop the engine gracefully.
 */
function stopEngine() {
    if (engineInterval) {
        clearInterval(engineInterval);
        engineInterval = null;
        isRunning = false;
        console.log("⚙️  Signal Cycle Engine stopped");
    }
}

/**
 * Single tick — runs every second.
 * Checks all intersections and handles expired timers.
 */
async function tick() {
    const intersections = await Intersection.find();

    for (const int of intersections) {
        const state = getSignalState(int.intersection_id);

        // Gather latest lane data for this intersection
        const laneData = await getLatestLaneData(int.intersection_id, int.lanes);

        // No analyzed videos yet → skip
        if (laneData.length === 0) continue;

        // Check for EMERGENCY in latest data
        const hasEmergency = laneData.some(l => l.emergency);
        if (hasEmergency) {
            const decision = decideSignal(laneData); // no penalty for emergency
            if (decision.reason === "emergency vehicle") {
                // 🛑 If manual override is active — DO NOT override, suppress instead
                if (state.mode === "MANUAL" && !state.isExpired) {
                    // updateSignal will store the suppressed emergency info
                    updateSignal(int.intersection_id, decision);
                    console.log(
                        `⚠️  Engine: Emergency detected on ${int.intersection_id} → Lane ${decision.active_lane} ` +
                        `(SUPPRESSED — manual override active, ${state.remainingSeconds}s remaining)`
                    );
                    continue;
                }
                // Normal emergency override (no manual active)
                if (state.reason !== "emergency vehicle" || state.isExpired) {
                    forceOverride(int.intersection_id, decision);
                    console.log(`🚨 Engine: Emergency override on ${int.intersection_id} → Lane ${decision.active_lane}`);
                }
                continue;
            }
        }

        // If timer is still running → do nothing (respect the timer)
        if (!state.isExpired && state.active_lane) {
            continue;
        }

        // ✅ Timer expired (or no signal yet) → run new decision
        // Pass the just-expired lane so it gets a fairness penalty (encourages rotation)
        const previousLane = state.active_lane || null;
        const decision = decideSignal(laneData, previousLane);

        // Use updateSignal which handles all the logic
        updateSignal(int.intersection_id, decision);

        // Only log if the lane actually changed or it's the first assignment
        if (!state.active_lane || state.active_lane !== decision.active_lane || state.isExpired) {
            console.log(
                `🔄 Engine: ${int.intersection_id} → Lane ${decision.active_lane} ` +
                `(${decision.reason}, ${decision.duration}s)` +
                (decision.next_lane ? ` | Next: Lane ${decision.next_lane}` : "")
            );
        }
    }
}

/**
 * Gather latest analyzed data for all lanes of an intersection.
 * Returns array of { lane, vehicle_count, avg_speed, density, emergency }
 */
async function getLatestLaneData(intersectionId, laneIds) {
    const lanes = [];

    for (const laneId of laneIds) {
        const latestVideo = await Video.findOne({
            intersection_id: intersectionId,
            lane_id: laneId,
            status: "analyzed"
        }).sort({ analyzedAt: -1 });

        if (latestVideo && latestVideo.analysis) {
            lanes.push({
                lane: laneId,
                vehicle_count: latestVideo.analysis.vehicle_count || 0,
                avg_speed: latestVideo.analysis.avg_speed || 0,
                density: latestVideo.analysis.density || "low",
                emergency: latestVideo.analysis.emergency || false
            });
        }
    }

    return lanes;
}

module.exports = { startEngine, stopEngine };
