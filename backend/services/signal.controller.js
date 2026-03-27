/**
 * signal.controller.js — Per-Intersection Signal State Manager
 * 
 * Each intersection has its own signal state (active pair, timer, mode).
 * Now tracks PAIRS of opposite lanes (e.g., A↔C open together).
 * 
 * PRIORITY ORDER:
 *   1. MANUAL override (operator) — highest priority, never interrupted
 *   2. EMERGENCY (AI-detected)    — auto-overrides normal signals
 *   3. AUTO (traffic-based)       — default cycle
 */

// Map of intersection_id → signal state
const signals = {};

function getOrCreateSignal(intersectionId) {
    if (!signals[intersectionId]) {
        signals[intersectionId] = {
            active_lane: null,        // primary lane in pair (backward compat)
            active_pair: null,        // NEW: ["A","C"] — both lanes open
            endsAt: null,
            mode: "AUTO",
            reason: null,
            duration: 0,
            next_lane: null,
            next_pair: null,
            next_reason: null,
            next_duration: null,
            suppressedEmergency: null
        };
    }
    return signals[intersectionId];
}

/**
 * Force-override a signal immediately.
 * Respects MANUAL mode — if a manual override is active, the emergency
 * is suppressed (stored for frontend warning) instead of overriding. 
 */
function forceOverride(intersectionId, decision) {
    const current = getOrCreateSignal(intersectionId);
    const now = Date.now();
    // MANUAL override is KING — never interrupt it
    if (current.mode === "MANUAL" && current.endsAt && now < current.endsAt) {
        current.suppressedEmergency = {
            lane: decision.active_lane,
            pair: decision.active_pair || [decision.active_lane],
            reason: decision.reason,
            timestamp: now
        };
        console.log(
            `[WARN] Emergency SUPPRESSED on ${intersectionId}: ` +
            `Pair [${(decision.active_pair || [decision.active_lane]).join("↔")}] ` +
            `(manual override active, ${Math.ceil((current.endsAt - now) / 1000)}s remaining)`
        );
        return getSignalState(intersectionId);
    }
    // Normal force-override — apply the decision
    signals[intersectionId] = {
        active_lane: decision.active_lane,
        active_pair: decision.active_pair || [decision.active_lane],
        endsAt: now + decision.duration * 1000,
        mode: "AUTO",
        reason: decision.reason,
        duration: decision.duration,
        next_lane: decision.next_lane || null,
        next_pair: decision.next_pair || null,
        next_reason: decision.next_reason || null,
        next_duration: decision.next_duration || null,
        suppressedEmergency: null
    };
    return getSignalState(intersectionId);
}

/**
 * Update signal for a specific intersection based on AI decision.
 */
function updateSignal(intersectionId, decision) {
    const now = Date.now();
    const current = getOrCreateSignal(intersectionId);

    // MANUAL override is KING — no automated decision can interrupt it
    if (current.mode === "MANUAL" && current.endsAt && now < current.endsAt) {
        // If it's an emergency, store as suppressed for frontend awareness
        if (decision.reason === "emergency vehicle") {
            current.suppressedEmergency = {
                lane: decision.active_lane,
                pair: decision.active_pair || [decision.active_lane],
                reason: decision.reason,
                timestamp: now
            };
            console.log(
                `[WARN] Emergency SUPPRESSED in updateSignal on ${intersectionId}: ` +
                `Pair [${(decision.active_pair || [decision.active_lane]).join("↔")}] (manual override active)`
            );
        }
        return getSignalState(intersectionId);
    }
    // Emergency overrides AUTO signals
    if (decision.reason === "emergency vehicle") {
        return forceOverride(intersectionId, decision);
    }

    // If current signal is emergency, nothing except another emergency can override
    if (current.reason === "emergency vehicle" && current.endsAt && now < current.endsAt) {
        return getSignalState(intersectionId);
    }

    // High congestion override — only if >50% of current timer elapsed
    if (decision.reason === "high traffic" && current.endsAt && now < current.endsAt) {
        const signalStartedAt = current.endsAt - (current.duration * 1000);
        const elapsed = now - signalStartedAt;
        const halfDuration = (current.duration * 1000) / 2;

        if (elapsed > halfDuration) {
            return forceOverride(intersectionId, decision);
        }
    }

    // Normal: if current signal still running → just update the next-pair prediction
    if (current.endsAt && now < current.endsAt) {
        current.next_lane = decision.active_lane;
        current.next_pair = decision.active_pair || [decision.active_lane];
        current.next_reason = decision.reason;
        current.next_duration = decision.duration;
        return getSignalState(intersectionId);
    }

    // Timer expired or no active signal → apply new decision
    signals[intersectionId] = {
        active_lane: decision.active_lane,
        active_pair: decision.active_pair || [decision.active_lane],
        endsAt: now + decision.duration * 1000,
        mode: "AUTO",
        reason: decision.reason,
        duration: decision.duration,
        next_lane: decision.next_lane || null,
        next_pair: decision.next_pair || null,
        next_reason: decision.next_reason || null,
        next_duration: decision.next_duration || null,
        suppressedEmergency: null
    };

    return getSignalState(intersectionId);
}

/**
 * Manual override for a specific intersection.
 * Accepts a single lane — resolves to its pair using lanePairs config.
 * This is the HIGHEST priority action — no automated system can interrupt it.
 */
function manualOverride(intersectionId, lane, duration, lanePairs, nextLane) {
    const current = getOrCreateSignal(intersectionId);

    // Resolve the pair for the selected lane
    let pair = [lane]; // fallback: just the single lane
    if (lanePairs && lanePairs.length > 0) {
        for (const p of lanePairs) {
            if (p.includes(lane)) {
                pair = p;
                break;
            }
        }
    }

    signals[intersectionId] = {
        active_lane: lane,
        active_pair: pair,
        endsAt: Date.now() + duration * 1000,
        mode: "MANUAL",
        reason: "manual override",
        duration: duration,
        manualPriority: true,
        next_lane: nextLane || current.next_lane || null,
        next_pair: current.next_pair || null,
        next_reason: current.next_reason || null,
        next_duration: current.next_duration || null,
        suppressedEmergency: null
    };

    console.log(
        `[MANUAL] Manual override ACTIVATED on ${intersectionId}: ` +
        `Pair [${pair.join("↔")}] for ${duration}s (takes priority over ALL automated signals)`
    );

    return getSignalState(intersectionId);
}

/**
 * Dismiss a suppressed emergency alert (operator acknowledged it).
 */
function dismissSuppressedEmergency(intersectionId) {
    const current = getOrCreateSignal(intersectionId);
    if (current.suppressedEmergency) {
        console.log(
            `[OK] Suppressed emergency DISMISSED on ${intersectionId}: ` +
            `Pair [${(current.suppressedEmergency.pair || [current.suppressedEmergency.lane]).join("↔")}] (operator acknowledged)`
        );
        current.suppressedEmergency = null;
    }
    return getSignalState(intersectionId);
}

/**
 * Get the full signal state for an intersection.
 */
function getSignalState(intersectionId) {
    const current = getOrCreateSignal(intersectionId);
    const now = Date.now();
    let remainingSeconds = 0;
    let isExpired = true;

    if (current.endsAt) {
        const remaining = current.endsAt - now;
        if (remaining > 0) {
            remainingSeconds = Math.ceil(remaining / 1000);
            isExpired = false;
        }
    }

    return {
        intersection_id: intersectionId,
        active_lane: current.active_lane,
        active_pair: current.active_pair || (current.active_lane ? [current.active_lane] : null),
        mode: current.mode,
        reason: current.reason,
        duration: current.duration,
        remainingSeconds,
        isExpired,
        endsAt: current.endsAt,
        next_lane: current.next_lane,
        next_pair: current.next_pair,
        next_reason: current.next_reason,
        next_duration: current.next_duration,
        suppressedEmergency: current.suppressedEmergency || null
    };
}

/**
 * Get all signal states across all intersections.
 */
function getAllSignalStates() {
    const result = {};
    for (const id of Object.keys(signals)) {
        result[id] = getSignalState(id);
    }
    return result;
}

module.exports = {
    updateSignal,
    manualOverride,
    getSignalState,
    getAllSignalStates,
    forceOverride,
    dismissSuppressedEmergency
};
