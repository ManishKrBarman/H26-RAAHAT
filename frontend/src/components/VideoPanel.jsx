function VideoPanel({ intersection }) {
  if (!intersection) return <p>Select intersection</p>;

  return (
    <div>
      <h3>📹 {intersection.id}</h3>

      {intersection.lanes.map((lane, i) => (
        <div key={i}>
          <h4>Lane {lane.lane}</h4>

          <video
            src={lane.videoUrl}
            controls
            muted
            style={{ width: "100%" }}
          />

          <p>{lane.density} {lane.emergency && "🚨"}</p>
        </div>
      ))}
    </div>
  );
}

export default VideoPanel;