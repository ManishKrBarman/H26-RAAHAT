function AlertsPanel({ alerts }) {
  return (
    <div style={{ border: "1px solid #444", padding: "10px" }}>
      {alerts.length === 0 ? (
        <p>No alerts yet</p>
      ) : (
        <ul>
          {alerts.map((a, i) => (
            <li key={i}>
              {a.time} - {a.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AlertsPanel;