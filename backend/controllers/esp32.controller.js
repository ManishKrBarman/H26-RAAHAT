const ESP32Device = require("../models/esp32.model");
const Intersection = require("../models/intersection.model");
const { getSignalState } = require("../services/signal.controller");

/**
 * GET /esp32/signal/:intersection_id
 * 
 * Returns a compact signal payload optimized for ESP32.
 * The ESP32 polls this every ~1 second and sets LEDs accordingly.
 * 
 * Now supports PAIR-BASED signals: both lanes in the active pair are GREEN.
 * 
 * Response:
 * {
 *   "active_lane": "A",
 *   "active_pair": ["A", "C"],
 *   "mode": "AUTO",
 *   "remaining": 23,
 *   "lanes": { "A": "GREEN", "B": "RED", "C": "GREEN", "D": "RED" }
 * }
 */
exports.getSignalForESP32 = async (req, res) => {
    try {
        const intersectionId = req.params.intersection_id;
        const signal = getSignalState(intersectionId);

        // Get the intersection to know its lanes
        const intersection = await Intersection.findOne({
            intersection_id: intersectionId
        });

        // Build lane→color map using active PAIR
        const laneColors = {};
        const activePair = signal.active_pair || (signal.active_lane ? [signal.active_lane] : []);

        if (intersection) {
            for (const laneId of intersection.lanes) {
                if (activePair.includes(laneId)) {
                    laneColors[laneId] = "GREEN";
                } else {
                    laneColors[laneId] = "RED";
                }
            }
        } else {
            // No intersection found — return all RED for safety
            ["A", "B", "C", "D"].forEach(l => { laneColors[l] = "RED"; });
        }

        res.json({
            active_lane: signal.active_lane || null,
            active_pair: activePair.length > 0 ? activePair : null,
            mode: signal.mode || "AUTO",
            remaining: signal.remainingSeconds || 0,
            reason: signal.reason || null,
            lanes: laneColors
        });
    } catch (err) {
        console.error("ESP32 signal error:", err.message);
        // On error, return all RED for safety
        res.status(500).json({
            active_lane: null,
            active_pair: null,
            mode: "ERROR",
            remaining: 0,
            reason: "server_error",
            lanes: { A: "RED", B: "RED", C: "RED", D: "RED" }
        });
    }
};

/**
 * POST /esp32/heartbeat
 * 
 * ESP32 calls this every ~10 seconds to register itself and report status.
 * Body: { device_id, intersection_id, ip }
 */
exports.heartbeat = async (req, res) => {
    try {
        const { device_id, intersection_id, ip } = req.body;

        if (!device_id || !intersection_id) {
            return res.status(400).json({
                error: "device_id and intersection_id are required"
            });
        }

        // Upsert: create if new, update lastSeen if existing
        const device = await ESP32Device.findOneAndUpdate(
            { device_id },
            {
                device_id,
                intersection_id,
                ip: ip || null,
                lastSeen: new Date()
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        res.json({
            status: "ok",
            device: device.toJSON()
        });
    } catch (err) {
        console.error("ESP32 heartbeat error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /esp32/devices
 * 
 * Returns all registered ESP32 devices with their online/offline status.
 * Used by the frontend dashboard.
 */
exports.getDevices = async (req, res) => {
    try {
        const devices = await ESP32Device.find().sort({ lastSeen: -1 });
        res.json(devices.map(d => d.toJSON()));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
