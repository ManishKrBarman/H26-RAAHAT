function SignalGrid({ lanes, activeLane }) {
  if (!lanes) return <p>Loading lanes...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      
      {lanes.map((lane) => (
        <div
          key={lane.lane}
          style={{
            border: "1px solid #444",
            padding: "10px",
            borderRadius: "8px",
            background: lane.lane === activeLane ? "#1a3d2f" : "#111"
          }}
        >
          {/* HEADER */}
          <h3>
            Lane {lane.lane} {lane.lane === activeLane && "🟢 ACTIVE"}
          </h3>

          {/* SIGNAL LIGHT */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <div style={{
              width: 15, height: 15, borderRadius: "50%",
              background: lane.lane === activeLane ? "green" : "red"
            }} />
            <span>
              {lane.lane === activeLane ? "GREEN" : "RED"}
            </span>
          </div>

          {/* DATA */}
          <p>🚗 Vehicles: {lane.vehicle_count}</p>
          <p>⚡ Speed: {lane.avg_speed}</p>
          <p>📊 Density: {lane.density}</p>

          {/* EMERGENCY */}
          {lane.emergency && (
            <p style={{ color: "red" }}>🚨 Emergency Detected</p>
          )}
        </div>
      ))}

    </div>
  );
}

export default SignalGrid;