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
 * Decide signal with lane rotation fairness.
 * 
 * @param {Array} lanes - lane data array
 * @param {string|null} currentActiveLane - the lane that JUST expired (optional)
 *   If provided, this lane gets a penalty to encourage rotation.
 *   Emergency lanes IGNORE the penalty — they always win.
 */
function decideSignal(lanes, currentActiveLane) {
    // Score all lanes
    const scored = lanes.map(l => {
        let score = laneScore(l);

        // Fairness penalty: if this lane was just active and it's not an emergency,
        // reduce its score so other lanes get a turn
        if (currentActiveLane && l.lane === currentActiveLane && !l.emergency) {
            score = Math.max(0, score - 150);
        }

        return { ...l, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    let duration = 15;
    let reason = "low traffic";

    if (best.emergency) {
        duration = 60;
        reason = "emergency vehicle";
    } else if (best.density === "high") {
        duration = 40;
        reason = "high traffic";
    } else if (best.density === "medium") {
        duration = 25;
        reason = "medium traffic";
    }

    // Simulate NEXT cycle: when this winner expires, the engine will apply
    // the fairness penalty to IT. So we re-score with that penalty to get
    // an accurate next_lane prediction.
    let nextLane = null;
    let nextDuration = null;
    let nextReason = null;

    if (lanes.length > 1) {
        const nextScored = lanes.map(l => {
            let s = laneScore(l);
            // Apply fairness penalty to the CURRENT winner (simulating what engine does)
            if (l.lane === best.lane && !l.emergency) {
                s = Math.max(0, s - 150);
            }
            return { ...l, score: s };
        });
        nextScored.sort((a, b) => b.score - a.score);
        const nextBest = nextScored[0];

        nextLane = nextBest.lane;
        nextDuration = 15;
        nextReason = "low traffic";
        if (nextBest.emergency) { nextDuration = 60; nextReason = "emergency vehicle"; }
        else if (nextBest.density === "high") { nextDuration = 40; nextReason = "high traffic"; }
        else if (nextBest.density === "medium") { nextDuration = 25; nextReason = "medium traffic"; }
    }

    return {
        active_lane: best.lane,
        duration,
        reason,
        score: best.score,
        next_lane: nextLane,
        next_duration: nextDuration,
        next_reason: nextReason
    };
}

module.exports = { decideSignal, laneScore };