function SignalGrid({ lanes, activeLane, activePair, mode }) {
  if (!lanes) return <p>Loading lanes...</p>;

  const isManual = mode === "MANUAL";

  // Resolve active pair — both lanes in the pair are GREEN
  const greenLanes = activePair || (activeLane ? [activeLane] : []);

  // Determine signal color for each lane
  const getSignalColor = (laneId) => {
    if (isManual) {
      return greenLanes.includes(laneId) ? "green" : "#f59e0b"; // amber for non-active
    }
    return greenLanes.includes(laneId) ? "green" : "red";
  };

  const getSignalLabel = (laneId) => {
    if (isManual) {
      return greenLanes.includes(laneId) ? "GREEN" : "YELLOW";
    }
    return greenLanes.includes(laneId) ? "GREEN" : "RED";
  };

  // Format pair display string
  const pairDisplay = greenLanes.length > 1
    ? greenLanes.join(" ↔ ")
    : greenLanes[0] || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* Active pair banner */}
      {greenLanes.length > 1 && !isManual && (
        <div style={{
          background: "rgba(0, 230, 118, 0.08)",
          border: "1px solid rgba(0, 230, 118, 0.3)",
          borderRadius: "8px",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ fontSize: "16px" }}>🟢</span>
          <span style={{ color: "#00e676", fontWeight: 600, fontSize: "13px" }}>
            Active Pair: Lane {pairDisplay}
          </span>
        </div>
      )}

      {/* Manual override banner */}
      {isManual && (
        <div style={{
          background: "rgba(245, 158, 11, 0.15)",
          border: "1px solid #f59e0b",
          borderRadius: "8px",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          animation: "yellowPulse 1.5s ease-in-out infinite"
        }}>
          <span style={{ fontSize: "13px", fontWeight: 700 }}>WARNING</span>
          <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: "13px" }}>
            Manual Override Active — Pair {pairDisplay} — Yellow signals blinking (caution)
          </span>
        </div>
      )}
      
      {lanes.map((lane) => {
        const signalColor = getSignalColor(lane.lane);
        const signalLabel = getSignalLabel(lane.lane);
        const isActive = greenLanes.includes(lane.lane);
        const isYellow = signalLabel === "YELLOW";

        return (
          <div
            key={lane.lane}
            style={{
              border: `1px solid ${isYellow ? "#f59e0b" : "#444"}`,
              padding: "10px",
              borderRadius: "8px",
              background: isActive ? "#1a3d2f" : isYellow ? "rgba(245, 158, 11, 0.08)" : "#111"
            }}
          >
            {/* HEADER */}
            <h3>
              Lane {lane.lane} {isActive && " — ACTIVE"}
              {isYellow && " — CAUTION"}
            </h3>

            {/* SIGNAL LIGHT */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
              <div style={{
                width: 15, height: 15, borderRadius: "50%",
                background: signalColor,
                animation: isYellow ? "yellowBlink 0.8s ease-in-out infinite" : "none",
                boxShadow: isYellow ? "0 0 8px rgba(245, 158, 11, 0.6)" : "none"
              }} />
              <span style={{ color: isYellow ? "#f59e0b" : undefined }}>
                {signalLabel}
              </span>
            </div>

            {/* DATA */}
            <p>Vehicles: {lane.vehicle_count}</p>
            <p>Speed: {lane.avg_speed}</p>
            <p>Density: {lane.density}</p>

            {/* EMERGENCY */}
            {lane.emergency && (
              <p style={{ color: "red", fontWeight: 700 }}>EMERGENCY DETECTED</p>
            )}
          </div>
        );
      })}

      {/* CSS Keyframes for yellow animations */}
      <style>{`
        @keyframes yellowBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes yellowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

    </div>
  );
}

export default SignalGrid;