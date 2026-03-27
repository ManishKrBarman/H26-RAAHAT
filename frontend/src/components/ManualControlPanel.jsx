import { useState, useEffect } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";

function ManualControlPanel({ selectedIntersection, lanePairs }) {
  const [lane, setLane] = useState("A");
  const [duration, setDuration] = useState(15);
  const [signalState, setSignalState] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const intId = selectedIntersection || "default";
  const pairs = lanePairs || [["A", "C"], ["B", "D"]];

  // Find the opposite lane for the selected lane
  const getOppositeLane = (laneId) => {
    for (const pair of pairs) {
      if (pair.includes(laneId) && pair.length > 1) {
        return pair.find(l => l !== laneId);
      }
    }
    return null;
  };

  const oppositeLane = getOppositeLane(lane);

  // Poll signal state for the selected intersection
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/traffic/signal/${intId}`);
        setSignalState(res.data);
        setCountdown(res.data.remainingSeconds || 0);
      } catch (err) {
        // silent
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [intId]);

  const handleOverride = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/traffic/manual`, {
        intersection_id: intId,
        lane,
        duration: Number(duration)
      });
    } catch (err) {
      console.error("Manual override failed:", err);
    }
    setLoading(false);
  };

  const handleDismissEmergency = async () => {
    setDismissing(true);
    try {
      await axios.post(`${API_BASE_URL}/traffic/dismiss-emergency`, {
        intersection_id: intId
      });
    } catch (err) {
      console.error("Dismiss emergency failed:", err);
    }
    setDismissing(false);
  };

  const mode = signalState?.mode || "—";
  const activeLane = signalState?.active_lane || "—";
  const activePair = signalState?.active_pair || [];
  const reason = signalState?.reason || "—";
  const nextLane = signalState?.next_lane;
  const nextPair = signalState?.next_pair;
  const nextReason = signalState?.next_reason;
  const suppressedEmergency = signalState?.suppressedEmergency;

  const activePairDisplay = activePair.length > 1
    ? activePair.join(" ↔ ")
    : activeLane;

  const nextPairDisplay = nextPair && nextPair.length > 1
    ? nextPair.join(" ↔ ")
    : nextLane;

  return (
    <div className="manual-control-panel">

      {/* ⚠️ Suppressed Emergency Alert Banner */}
      {suppressedEmergency && (
        <div className="suppressed-emergency-banner">
          <div className="suppressed-emergency-icon">⚠️</div>
          <div className="suppressed-emergency-content">
            <span className="suppressed-emergency-title">
              Emergency Detected — Suppressed
            </span>
            <span className="suppressed-emergency-detail">
              Pair {(suppressedEmergency.pair || [suppressedEmergency.lane]).join(" ↔ ")} — {suppressedEmergency.reason}
            </span>
            <span className="suppressed-emergency-note">
              Your manual override is taking priority. Dismiss if false positive.
            </span>
          </div>
          <button
            className="suppressed-emergency-dismiss"
            onClick={handleDismissEmergency}
            disabled={dismissing}
          >
            {dismissing ? "..." : "Dismiss"}
          </button>
        </div>
      )}

      {/* Signal Status */}
      <div className="signal-status-card">
        <div className="signal-status-header">
          <span className="signal-status-title">Signal Status</span>
          <span className={`mode-badge ${mode === "MANUAL" ? "manual" : "auto"}`}>
            {mode}
          </span>
        </div>

        <div className="signal-status-body">
          <div className="signal-stat-row">
            <span className="stat-label">Intersection</span>
            <span className="stat-value" style={{ fontSize: "10px" }}>{intId}</span>
          </div>
          <div className="signal-stat-row">
            <span className="stat-label">Active Pair</span>
            <span className="stat-value lane-value">{activePairDisplay}</span>
          </div>
          <div className="signal-stat-row">
            <span className="stat-label">Reason</span>
            <span className="stat-value">{reason}</span>
          </div>

          {/* Countdown Timer */}
          <div className="countdown-section">
            <div className="countdown-ring">
              <svg viewBox="0 0 80 80" className="countdown-svg">
                <circle cx="40" cy="40" r="34" className="countdown-bg-circle" />
                <circle
                  cx="40" cy="40" r="34"
                  className="countdown-fg-circle"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 34}`,
                    strokeDashoffset: signalState?.duration
                      ? `${2 * Math.PI * 34 * (1 - countdown / signalState.duration)}`
                      : `${2 * Math.PI * 34}`
                  }}
                />
              </svg>
              <span className="countdown-number">{countdown}s</span>
            </div>
            <span className="countdown-label">remaining</span>
          </div>

          {/* Next Signal Prediction */}
          {nextPairDisplay && (
            <div className="next-signal-card">
              <span className="next-signal-label">Next Signal</span>
              <div className="next-signal-info">
                <span className="next-lane-badge">Pair {nextPairDisplay}</span>
                <span className="next-reason">{nextReason || "—"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Override Controls */}
      <div className="override-card">
        <h4 className="override-title">Manual Override</h4>

        <div className="override-field">
          <label className="override-label">Select Lane (opposite lane paired automatically)</label>
          <div className="lane-selector">
            {["A", "B", "C", "D"].map((l) => (
              <button
                key={l}
                className={`lane-btn ${lane === l ? "selected" : ""}`}
                onClick={() => setLane(l)}
              >
                {l}
              </button>
            ))}
          </div>
          {/* Show the opposite pairing */}
          {oppositeLane && (
            <p style={{
              color: "#38bdf8",
              fontSize: "11px",
              marginTop: "4px",
              fontWeight: 500
            }}>
              Lane {lane} ↔ Lane {oppositeLane} will both go GREEN
            </p>
          )}
        </div>

        <div className="override-field">
          <label className="override-label">Duration (seconds)</label>
          <input
            type="range" min="5" max="120"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="duration-slider"
          />
          <span className="duration-value">{duration}s</span>
        </div>

        <button
          className="override-btn"
          onClick={handleOverride}
          disabled={loading}
        >
          {loading ? "Applying..." : `Override → Pair ${lane}${oppositeLane ? " ↔ " + oppositeLane : ""}`}
        </button>

        {/* Show what comes next after override */}
        {nextPairDisplay && (
          <p className="override-note" style={{ color: "#38bdf8" }}>
            After override expires → Pair {nextPairDisplay} ({nextReason || "auto"})
          </p>
        )}
      </div>
    </div>
  );
}

export default ManualControlPanel;
