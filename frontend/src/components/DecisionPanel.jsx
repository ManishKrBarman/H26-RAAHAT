function DecisionPanel({ data }) {
  return (
    <div style={{ padding: "10px", border: "1px solid #444" }}>
      <h3>🤖 AI Decision</h3>
      <p><b>Active Lane:</b> {data.active_lane}</p>
      <p><b>Reason:</b> {data.reason}</p>
      <p><b>Duration:</b> {data.duration}s</p>
    </div>
  );
}

export default DecisionPanel;