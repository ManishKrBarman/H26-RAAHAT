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

function decideSignal(lanes) {
    let bestLane = lanes[0];
    let bestScore = laneScore(bestLane);

    for (let i = 1; i < lanes.length; i++) {
        const score = laneScore(lanes[i]);
        if (score > bestScore) {
            bestScore = score;
            bestLane = lanes[i];
        }
    }

    let duration = 15;
    let reason = "low traffic";

    if (bestLane.emergency) {
        duration = 60;
        reason = "emergency vehicle";
    } else if (bestLane.density === "high") {
        duration = 40;
        reason = "high traffic";
    } else if (bestLane.density === "medium") {
        duration = 25;
        reason = "medium traffic";
    }

    return {
        active_lane: bestLane.lane,
        duration,
        reason,
        score: bestScore
    };
}

module.exports = { decideSignal };