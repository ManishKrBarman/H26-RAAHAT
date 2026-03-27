const { decideSignal } = require("../services/decision.service");
const Traffic = require("../models/traffic.model");
const Intersection = require("../models/intersection.model");
const Video = require("../models/video.model");
const {
    updateSignal,
    manualOverride,
    getSignalState,
    getAllSignalStates,
    dismissSuppressedEmergency
} = require("../services/signal.controller");

/**
 * GET /traffic/current
 * Build the full current state from DB:
 *   - All registered intersections
 *   - Latest video analysis per lane
 *   - Signal state per intersection (with active_pair)
 */
exports.getCurrent = async (req, res) => {
    try {
        const intersections = await Intersection.find().sort({ createdAt: -1 });

        const result = [];
        for (const int of intersections) {
            const lanes = [];

            for (const laneId of int.lanes) {
                const latestVideo = await Video.findOne({
                    intersection_id: int.intersection_id,
                    lane_id: laneId,
                    status: "analyzed"
                }).sort({ analyzedAt: -1 });

                lanes.push({
                    lane: laneId,
                    vehicle_count: latestVideo?.analysis?.vehicle_count ?? 0,
                    avg_speed: latestVideo?.analysis?.avg_speed ?? 0,
                    density: latestVideo?.analysis?.density ?? "low",
                    emergency: latestVideo?.analysis?.emergency ?? false,
                    audio_used: latestVideo?.analysis?.audio_used ?? false,
                    video_score: latestVideo?.analysis?.video_score ?? 0,
                    audio_score: latestVideo?.analysis?.audio_score ?? 0,
                    final_score: latestVideo?.analysis?.final_score ?? 0,
                    hasVideo: !!latestVideo
                });
            }

            const signal = getSignalState(int.intersection_id);

            result.push({
                id: int.intersection_id,
                name: int.name,
                location: int.location,
                lane_pairs: int.lane_pairs || [["A", "C"], ["B", "D"]],
                lanes,
                decision: signal.active_lane ? {
                    active_lane: signal.active_lane,
                    active_pair: signal.active_pair,
                    reason: signal.reason,
                    duration: signal.duration,
                    score: 0
                } : null,
                signal
            });
        }

        res.json({
            intersections: result,
            signalStates: getAllSignalStates()
        });
    } catch (err) {
        console.error("getCurrent error:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * POST /traffic/analyze
 * Takes intersection data (could be from external source or UI)
 * and runs the decision engine using pair-based logic.
 */
exports.analyzeTraffic = async (req, res) => {
    const { intersections } = req.body;

    if (!intersections) {
        return res.status(400).json({ error: "Intersections required" });
    }

    const result = [];
    for (const int of intersections) {
        // Look up the intersection to get lane_pairs
        const dbInt = await Intersection.findOne({ intersection_id: int.id });
        const lanePairs = dbInt?.lane_pairs || int.lane_pairs || [["A", "C"], ["B", "D"]];

        const decision = decideSignal(int.lanes, lanePairs);
        const signal = updateSignal(int.id, decision);

        result.push({
            ...int,
            decision,
            signal
        });
    }

    await Traffic.create({ intersections: result });

    res.json({ intersections: result });
};

/**
 * GET /traffic/history
 */
exports.getHistory = async (req, res) => {
    const data = await Traffic.find().sort({ createdAt: -1 }).limit(10);
    res.json(data);
};

/**
 * POST /traffic/manual
 * Manual override for a specific intersection + lane.
 * The lane is automatically paired with its opposite lane.
 * Body: { intersection_id, lane, duration }
 */
exports.manualControl = async (req, res) => {
    const { intersection_id, lane, duration } = req.body;

    if (!lane || !duration) {
        return res.status(400).json({ error: "lane and duration required" });
    }

    // Default to "default" intersection if not specified
    const intId = intersection_id || "default";

    // Look up intersection to get lane_pairs for pairing resolution
    const dbInt = await Intersection.findOne({ intersection_id: intId });
    const lanePairs = dbInt?.lane_pairs || [["A", "C"], ["B", "D"]];

    const signal = manualOverride(intId, lane, duration, lanePairs);
    res.json(signal);
};

/**
 * GET /traffic/signal/:intersection_id
 * Get signal state for a specific intersection (includes active_pair)
 */
exports.getSignalStatus = (req, res) => {
    const intId = req.params.intersection_id || "default";
    res.json(getSignalState(intId));
};

/**
 * POST /traffic/dismiss-emergency
 * Dismiss a suppressed emergency alert (operator acknowledged)
 * Body: { intersection_id }
 */
exports.dismissEmergency = (req, res) => {
    const { intersection_id } = req.body;
    const intId = intersection_id || "default";
    const signal = dismissSuppressedEmergency(intId);
    res.json(signal);
};