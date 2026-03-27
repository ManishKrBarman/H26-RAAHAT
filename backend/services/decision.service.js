function laneScore(lane) {
    let score = 0;

    if (lane.emergency) score += 1000;

    if (lane.density === "high") score += 300;
    else if (lane.density === "medium") score += 200;
    else score += 100;

    score += lane.vehicle_count * 2;
    score += Math.max(0, 50 - lane.avg_speed);

    return score;
}

/**
 * Find which pair a lane belongs to.
 * @param {string} laneId
 * @param {Array<Array<string>>} lanePairs - e.g. [["A","C"],["B","D"]]
 * @returns {Array<string>|null} - the pair array, or null
 */
function findPairForLane(laneId, lanePairs) {
    for (const pair of lanePairs) {
        if (pair.includes(laneId)) return pair;
    }
    return null;
}

/**
 * Score a pair of lanes by summing their individual scores.
 * @param {Array<string>} pair - e.g. ["A","C"]
 * @param {Array} lanes - lane data array with { lane, vehicle_count, ... }
 * @returns {{ score: number, hasEmergency: boolean, primaryLane: string }}
 */
function scorePair(pair, lanes) {
    let totalScore = 0;
    let hasEmergency = false;
    let primaryLane = pair[0]; // default to first lane in pair
    let highestIndividual = -1;

    for (const laneId of pair) {
        const laneData = lanes.find(l => l.lane === laneId);
        if (laneData) {
            const s = laneScore(laneData);
            totalScore += s;
            if (laneData.emergency) hasEmergency = true;
            if (s > highestIndividual) {
                highestIndividual = s;
                primaryLane = laneId; // primary = highest-scoring lane in pair
            }
        }
    }

    return { score: totalScore, hasEmergency, primaryLane };
}

/**
 * Decide signal based on LANE PAIRS (opposite lanes open together).
 * 
 * @param {Array} lanes - lane data array
 * @param {Array<Array<string>>} lanePairs - pair definitions, e.g. [["A","C"],["B","D"]]
 * @param {Array<string>|null} currentActivePair - the pair that JUST expired (optional)
 *   If provided, this pair gets a fairness penalty to encourage rotation.
 *   Emergency pairs IGNORE the penalty — they always win.
 */
function decideSignal(lanes, lanePairs, currentActivePair) {
    // Fallback: if no pairs provided, use legacy single-lane logic
    if (!lanePairs || lanePairs.length === 0) {
        lanePairs = [["A", "C"], ["B", "D"]];
    }

    // Score all pairs
    const scored = lanePairs.map(pair => {
        const result = scorePair(pair, lanes);

        // Fairness penalty: if this pair was just active and no emergency,
        // reduce its score so other pairs get a turn
        if (currentActivePair && !result.hasEmergency) {
            const pairKey = [...pair].sort().join(",");
            const activePairKey = [...currentActivePair].sort().join(",");
            if (pairKey === activePairKey) {
                result.score = Math.max(0, result.score - 300); // pair penalty (doubled from single-lane 150)
            }
        }

        return { pair, ...result };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    // Determine duration and reason based on the best pair's characteristics
    let duration = 15;
    let reason = "low traffic";

    if (best.hasEmergency) {
        duration = 60;
        reason = "emergency vehicle";
    } else {
        // Use the highest density in the pair
        const densities = best.pair.map(laneId => {
            const l = lanes.find(x => x.lane === laneId);
            return l ? l.density : "low";
        });
        if (densities.includes("high")) {
            duration = 40;
            reason = "high traffic";
        } else if (densities.includes("medium")) {
            duration = 25;
            reason = "medium traffic";
        }
    }

    // Predict NEXT pair (simulate fairness penalty on current winner)
    let nextPair = null;
    let nextLane = null;
    let nextDuration = null;
    let nextReason = null;

    if (lanePairs.length > 1) {
        const nextScored = lanePairs.map(pair => {
            const result = scorePair(pair, lanes);
            // Apply fairness penalty to the CURRENT winner
            if (!result.hasEmergency) {
                const pairKey = [...pair].sort().join(",");
                const bestPairKey = [...best.pair].sort().join(",");
                if (pairKey === bestPairKey) {
                    result.score = Math.max(0, result.score - 300);
                }
            }
            return { pair, ...result };
        });
        nextScored.sort((a, b) => b.score - a.score);
        const nextBest = nextScored[0];

        nextPair = nextBest.pair;
        nextLane = nextBest.primaryLane;
        nextDuration = 15;
        nextReason = "low traffic";
        if (nextBest.hasEmergency) { nextDuration = 60; nextReason = "emergency vehicle"; }
        else {
            const nd = nextBest.pair.map(laneId => {
                const l = lanes.find(x => x.lane === laneId);
                return l ? l.density : "low";
            });
            if (nd.includes("high")) { nextDuration = 40; nextReason = "high traffic"; }
            else if (nd.includes("medium")) { nextDuration = 25; nextReason = "medium traffic"; }
        }
    }

    return {
        active_pair: best.pair,           // NEW: ["A","C"]
        active_lane: best.primaryLane,    // backward compat: "A" (highest-scoring in pair)
        duration,
        reason,
        score: best.score,
        next_pair: nextPair,
        next_lane: nextLane,
        next_duration: nextDuration,
        next_reason: nextReason
    };
}

module.exports = { decideSignal, laneScore, findPairForLane, scorePair };