function IntersectionPanel({ intersection, isSelected }) {
  const { id, lanes, decision, signal } = intersection;

  const remaining = signal?.remainingSeconds || 0;
  const mode = signal?.mode || "AUTO";
  const isManual = mode === "MANUAL";

  return (
    <div className={`int-panel-card ${isSelected ? "selected" : ""}`}>
      <div className="int-panel-header">
        <h3 className="int-panel-title">{id}</h3>
        <span className={`int-mode-badge ${mode === "MANUAL" ? "manual" : "auto"}`}>
          {mode}
        </span>
      </div>

      <div className="int-panel-stats">
        <div className="int-panel-stat">
          <span className="int-stat-label">Active Lane</span>
          <span className="int-stat-value green-glow">{decision?.active_lane || "—"}</span>
        </div>
        <div className="int-panel-stat">
          <span className="int-stat-label">Reason</span>
          <span className="int-stat-value">{decision?.reason || "—"}</span>
        </div>
        <div className="int-panel-stat">
          <span className="int-stat-label">Time Left</span>
          <span className={`int-stat-value ${remaining <= 5 ? "urgent" : ""}`}>
            {remaining}s
          </span>
        </div>
      </div>

      {/* Manual override yellow indicator */}
      {isManual && (
        <div style={{
          background: "rgba(245, 158, 11, 0.12)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRadius: "6px",
          padding: "4px 8px",
          marginBottom: "8px",
          fontSize: "11px",
          color: "#f59e0b",
          textAlign: "center"
        }}>
          Yellow signals blinking — caution mode
        </div>
      )}

      <div className="int-panel-lanes">
        {lanes.map((lane, i) => {
          const isActive = lane.lane === decision?.active_lane;
          const isYellow = isManual && !isActive;

          return (
            <div
              key={i}
              className={`int-lane-chip ${isActive ? "active" : ""} ${isYellow ? "yellow-caution" : ""} ${lane.emergency ? "emergency" : ""}`}
            >
              <span className="lane-letter">{lane.lane}</span>
              <span className="lane-density">{isYellow ? "caution" : lane.density}</span>
              {lane.emergency && <span className="lane-emg">EMG</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default IntersectionPanel;