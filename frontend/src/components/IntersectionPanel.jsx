function IntersectionPanel({ intersection }) {
  const { id, lanes, decision } = intersection;

  return (
    <div style={{
      border: "1px solid #333",
      borderRadius: "10px",
      padding: "10px",
      marginBottom: "10px",
      background: "#020617"
    }}>
      <h3>🚦 {id}</h3>

      <p><b>Active Lane:</b> {decision?.active_lane}</p>
      <p><b>Reason:</b> {decision?.reason}</p>

      <div>
        {lanes.map((lane, i) => (
          <div key={i} style={{ fontSize: "13px" }}>
            Lane {lane.lane} → {lane.density} {lane.emergency && "🚨"}
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntersectionPanel;