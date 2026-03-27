const Intersection = require("../models/intersection.model");

/**
 * Register a new intersection
 * POST /intersections
 * Body: {
 *   intersection_id, name, location: { lat, lng },
 *   lanes: ["A","B","C","D"],
 *   lane_pairs: [["A","C"],["B","D"]]   ← optional, auto-generated if omitted
 * }
 */
exports.createIntersection = async (req, res) => {
    try {
        const { intersection_id, name, location, lanes, lane_pairs } = req.body;

        if (!intersection_id || !name || !location) {
            return res.status(400).json({
                error: "intersection_id, name, and location (lat, lng) are required"
            });
        }

        // Check if already exists
        const existing = await Intersection.findOne({ intersection_id });
        if (existing) {
            return res.status(409).json({ error: "Intersection already exists", data: existing });
        }

        const finalLanes = lanes || ["A", "B", "C", "D"];

        // Auto-generate default opposite pairs if not provided
        // For 4 lanes: [["A","C"],["B","D"]]  (index 0↔2, 1↔3)
        // For 3 lanes: [["A","C"],["B"]]
        // For 2 lanes: [["A","B"]]
        let finalPairs = lane_pairs;
        if (!finalPairs || finalPairs.length === 0) {
            finalPairs = [];
            const used = new Set();
            for (let i = 0; i < finalLanes.length; i++) {
                if (used.has(finalLanes[i])) continue;
                const oppositeIdx = i + 2;
                if (oppositeIdx < finalLanes.length && !used.has(finalLanes[oppositeIdx])) {
                    finalPairs.push([finalLanes[i], finalLanes[oppositeIdx]]);
                    used.add(finalLanes[i]);
                    used.add(finalLanes[oppositeIdx]);
                } else {
                    finalPairs.push([finalLanes[i]]);
                    used.add(finalLanes[i]);
                }
            }
        }

        const intersection = await Intersection.create({
            intersection_id,
            name,
            location,
            lanes: finalLanes,
            lane_pairs: finalPairs
        });

        console.log("[OK] Intersection registered:", intersection_id, "| Pairs:", JSON.stringify(finalPairs));
        res.status(201).json(intersection);
    } catch (err) {
        console.error("Error creating intersection:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get all registered intersections
 * GET /intersections
 */
exports.getAllIntersections = async (req, res) => {
    try {
        const intersections = await Intersection.find().sort({ createdAt: -1 });
        res.json(intersections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get a single intersection by ID
 * GET /intersections/:id
 */
exports.getIntersection = async (req, res) => {
    try {
        const intersection = await Intersection.findOne({
            intersection_id: req.params.id
        });

        if (!intersection) {
            return res.status(404).json({ error: "Intersection not found" });
        }

        res.json(intersection);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
