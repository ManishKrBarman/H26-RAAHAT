/**
 * signal.engine.js — Automatic Signal Cycle Engine
 * 
 * This is the HEARTBEAT of the traffic system.
 * 
 * It runs as a background loop (every 1s) and for each registered intersection:
 *   1. Checks if the current signal timer has expired
 *   2. If expired → gathers latest analyzed data for all lanes
 *   3. Runs the decision engine to pick the best PAIR of opposite lanes
 *   4. Starts a new signal cycle with that pair
 * 
 * PAIR-BASED SIGNAL LOGIC:
 *   At any given time, TWO opposite lanes (a pair) are GREEN while the
 *   other pair is RED. For example: A↔C are GREEN, B↔D are RED.
 *   Then they swap: B↔D go GREEN, A↔C go RED.
 * 
 * How it handles different scenarios:
 * 
 *   NORMAL CYCLE:
 *     Timer expires → re-evaluate all pairs → pick best pair → start new timer
 * 
 *   MANUAL OVERRIDE (HIGHEST PRIORITY):
 *     Manual override is ALWAYS king — no automated signal can interrupt it.
 *     When operator picks a lane, its opposite pair also goes GREEN.
 *     Manual timer expires → engine detects mode was MANUAL & isExpired
 *     → re-evaluates pairs → returns to AUTO mode with new decision
 * 
 *   EMERGENCY:
 *     Emergency detected in lane data → decision engine gives its PAIR score 1000+
 *     → forceOverride() immediately switches to that pair, even mid-timer
 *     UNLESS manual override is active (then suppressed)
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

    console.log("[ENGINE] Signal Cycle Engine started (1s interval) — PAIR-BASED MODE");

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
        console.log("[ENGINE] Signal Cycle Engine stopped");
    }
}

/**
 * Single tick — runs every second.
 * Checks all intersections and handles expired timers using PAIR logic.
 */
async function tick() {
    const intersections = await Intersection.find();

    for (const int of intersections) {
        const state = getSignalState(int.intersection_id);
        const lanePairs = int.lane_pairs || [["A", "C"], ["B", "D"]];

        // Gather latest lane data for this intersection
        const laneData = await getLatestLaneData(int.intersection_id, int.lanes);

        // No analyzed videos yet → skip
        if (laneData.length === 0) continue;

        // Check for EMERGENCY in latest data
        const hasEmergency = laneData.some(l => l.emergency);
        if (hasEmergency) {
            const decision = decideSignal(laneData, lanePairs); // no penalty for emergency
            if (decision.reason === "emergency vehicle") {
                // If manual override is active — DO NOT override, suppress instead
                if (state.mode === "MANUAL" && !state.isExpired) {
                    updateSignal(int.intersection_id, decision);
                    console.log(
                        `[WARN] Engine: Emergency detected on ${int.intersection_id} → Pair [${decision.active_pair.join("↔")}] ` +
                        `(SUPPRESSED — manual override active, ${state.remainingSeconds}s remaining)`
                    );
                    continue;
                }
                // Normal emergency override (no manual active)
                if (state.reason !== "emergency vehicle" || state.isExpired) {
                    forceOverride(int.intersection_id, decision);
                    console.log(`[EMERGENCY] Engine: Emergency override on ${int.intersection_id} → Pair [${decision.active_pair.join("↔")}]`);
                }
                continue;
            }
        }

        // If timer is still running → do nothing (respect the timer)
        if (!state.isExpired && state.active_lane) {
            continue;
        }

        // Timer expired (or no signal yet) → run new decision
        // Pass the just-expired PAIR so it gets a fairness penalty (encourages rotation)
        const previousPair = state.active_pair || null;
        const decision = decideSignal(laneData, lanePairs, previousPair);

        // Use updateSignal which handles all the logic
        updateSignal(int.intersection_id, decision);

        // Only log if the pair actually changed or it's the first assignment
        if (!state.active_pair || state.isExpired ||
            JSON.stringify(state.active_pair) !== JSON.stringify(decision.active_pair)) {
            console.log(
                `[CYCLE] Engine: ${int.intersection_id} → Pair [${decision.active_pair.join("↔")}] ` +
                `(${decision.reason}, ${decision.duration}s)` +
                (decision.next_pair ? ` | Next: Pair [${decision.next_pair.join("↔")}]` : "")
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
