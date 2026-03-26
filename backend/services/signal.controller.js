/**
 * signal.controller.js — Per-Intersection Signal State Manager
 * 
 * Each intersection has its own signal state (active lane, timer, mode).
 * Now also tracks next_lane prediction and suppressed emergency info.
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
            active_lane: null,
            endsAt: null,
            mode: "AUTO",
            reason: null,
            duration: 0,
            next_lane: null,
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
    // 🛑 MANUAL override is KING — never interrupt it
    if (current.mode === "MANUAL" && current.endsAt && now < current.endsAt) {
        current.suppressedEmergency = {
            lane: decision.active_lane,
            reason: decision.reason,
            timestamp: now
        };
        console.log(
            `⚠️  Emergency SUPPRESSED on ${intersectionId}: ` +
            `Lane ${decision.active_lane} (manual override active, ${Math.ceil((current.endsAt - now) / 1000)}s remaining)`
        );
        return getSignalState(intersectionId);
    }
    // Normal force-override — apply the decision
    signals[intersectionId] = {
        active_lane: decision.active_lane,
        endsAt: now + decision.duration * 1000,
        mode: "AUTO",
        reason: decision.reason,
        duration: decision.duration,
        next_lane: decision.next_lane || null,
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

    // 🛑 MANUAL override is KING — no automated decision can interrupt it
    if (current.mode === "MANUAL" && current.endsAt && now < current.endsAt) {
        // If it's an emergency, store as suppressed for frontend awareness
        if (decision.reason === "emergency vehicle") {
            current.suppressedEmergency = {
                lane: decision.active_lane,
                reason: decision.reason,
                timestamp: now
            };
            console.log(
                `⚠️  Emergency SUPPRESSED in updateSignal on ${intersectionId}: ` +
                `Lane ${decision.active_lane} (manual override active)`
            );
        }
        return getSignalState(intersectionId);
    }
    // 🚨 Emergency overrides AUTO signals
    if (decision.reason === "emergency vehicle") {
        return forceOverride(intersectionId, decision);
    }

    // 🚫 If current signal is emergency, nothing except another emergency can override
    if (current.reason === "emergency vehicle" && current.endsAt && now < current.endsAt) {
        return getSignalState(intersectionId);
    }

    // 📊 High congestion override — only if >50% of current timer elapsed
    if (decision.reason === "high traffic" && current.endsAt && now < current.endsAt) {
        const signalStartedAt = current.endsAt - (current.duration * 1000);
        const elapsed = now - signalStartedAt;
        const halfDuration = (current.duration * 1000) / 2;

        if (elapsed > halfDuration) {
            return forceOverride(intersectionId, decision);
        }
    }

    // ⏱️ Normal: if current signal still running → just update the next-lane prediction
    if (current.endsAt && now < current.endsAt) {
        // Update next lane even if timer is running
        current.next_lane = decision.active_lane;
        current.next_reason = decision.reason;
        current.next_duration = decision.duration;
        return getSignalState(intersectionId);
    }

    // ✅ Timer expired or no active signal → apply new decision
    signals[intersectionId] = {
        active_lane: decision.active_lane,
        endsAt: now + decision.duration * 1000,
        mode: "AUTO",
        reason: decision.reason,
        duration: decision.duration,
        next_lane: decision.next_lane || null,
        next_reason: decision.next_reason || null,
        next_duration: decision.next_duration || null,
        suppressedEmergency: null
    };

    return getSignalState(intersectionId);
}

/**
 * Manual override for a specific intersection.
 * This is the HIGHEST priority action — no automated system can interrupt it. 
 * Stores the next_lane so user knows what comes after manual override expires.
 */
function manualOverride(intersectionId, lane, duration, nextLane) {
    const current = getOrCreateSignal(intersectionId);

    signals[intersectionId] = {
        active_lane: lane,
        endsAt: Date.now() + duration * 1000,
        mode: "MANUAL",
        reason: "manual override",
        duration: duration,
        manualPriority: true,
        // Keep existing next_lane prediction from AI, or use provided one
        next_lane: nextLane || current.next_lane || null,
        next_reason: current.next_reason || null,
        next_duration: current.next_duration || null,
        suppressedEmergency: null
    };

    console.log(
        `🔧 Manual override ACTIVATED on ${intersectionId}: ` +
        `Lane ${lane} for ${duration}s (takes priority over ALL automated signals)`
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
            `✅ Suppressed emergency DISMISSED on ${intersectionId}: ` +
            `Lane ${current.suppressedEmergency.lane} (operator acknowledged)`
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
        mode: current.mode,
        reason: current.reason,
        duration: current.duration,
        remainingSeconds,
        isExpired,
        endsAt: current.endsAt,
        next_lane: current.next_lane,
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
