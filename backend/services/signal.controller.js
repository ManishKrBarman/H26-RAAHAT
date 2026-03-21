let currentSignal = {
    active_lane: null,
    endsAt: null,
    mode: "AUTO" // AUTO | MANUAL
};

function updateSignal(decision) {
    const now = Date.now();

    // 🚫 If current signal still running → do nothing
    if (currentSignal.endsAt && now < currentSignal.endsAt) {
        return currentSignal;
    }

    // ✅ Apply new signal
    currentSignal = {
        active_lane: decision.active_lane,
        endsAt: now + decision.duration * 1000,
        mode: "AUTO"
    };

    return currentSignal;
}

function manualOverride(lane, duration) {
    currentSignal = {
        active_lane: lane,
        endsAt: Date.now() + duration * 1000,
        mode: "MANUAL"
    };

    return currentSignal;
}

function getCurrentSignal() {
    return currentSignal;
}

module.exports = {
    updateSignal,
    manualOverride,
    getCurrentSignal
};