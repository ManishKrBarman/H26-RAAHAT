import { useState, useEffect } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";

function VideoFeedPanel({ intersectionId }) {
  const [laneData, setLaneData] = useState({});
  const [intersectionInfo, setIntersectionInfo] = useState(null);
  const allLanes = ["A", "B", "C", "D"]; // max 4 slots

  useEffect(() => {
    if (!intersectionId) return;

    const fetchData = async () => {
      try {
        // Get intersection info (which lanes exist)
        const intRes = await axios.get(`${API_BASE_URL}/intersections/${intersectionId}`);
        setIntersectionInfo(intRes.data);

        // Get latest videos per lane
        const vidRes = await axios.get(`${API_BASE_URL}/video/latest/${intersectionId}`);
        setLaneData(vidRes.data.lanes || {});
      } catch (err) {
        // silent
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [intersectionId]);

  const activeLanes = intersectionInfo?.lanes || [];

  return (
    <div className="video-feed-panel">
      <div className="feed-header">
        <span className="feed-title">📹 Live Lane Feeds</span>
        {intersectionId && (
          <span className="feed-int-id">{intersectionId}</span>
        )}
      </div>

      <div className="feed-grid">
        {allLanes.map(lane => {
          const isAvailable = activeLanes.includes(lane);
          const video = laneData[lane];
          const hasVideo = video && video.file_id;
          const analysis = video?.analysis;
          const status = video?.status;

          return (
            <div
              key={lane}
              className={`feed-cell ${!isAvailable ? "disabled" : ""} ${analysis?.emergency ? "emergency" : ""}`}
            >
              {/* Lane label */}
              <div className="feed-lane-header">
                <span className="feed-lane-id">Lane {lane}</span>
                {isAvailable && status && (
                  <span className={`feed-status-dot ${status}`} title={status} />
                )}
              </div>

              {/* Video or placeholder */}
              <div className="feed-video-container">
                {!isAvailable ? (
                  <div className="feed-off">
                    <span className="feed-off-icon">⚫</span>
                    <span className="feed-off-text">Not Available</span>
                  </div>
                ) : !hasVideo ? (
                  <div className="feed-no-video">
                    <span className="feed-no-icon">📷</span>
                    <span className="feed-no-text">No footage</span>
                  </div>
                ) : (
                  <video
                    src={`${API_BASE_URL}/video/stream/${video._id}`}
                    controls
                    muted
                    autoPlay
                    loop
                    className="feed-video"
                  />
                )}
              </div>

              {/* Analysis badge */}
              {isAvailable && analysis && (
                <div className="feed-analysis">
                  <span className="feed-stat">🚗 {analysis.vehicle_count}</span>
                  <span className="feed-stat">⚡ {analysis.avg_speed}</span>
                  <span className={`feed-density ${analysis.density}`}>
                    {analysis.density}
                  </span>
                  {analysis.emergency && <span className="feed-emg">🚨</span>}
                </div>
              )}

              {/* Audio analysis row */}
              {isAvailable && analysis && (
                <div className="feed-audio-row">
                  <span className="feed-audio-badge" title={analysis.audio_used ? "Audio analyzed" : "No audio"}>
                    {analysis.audio_used ? "🔊" : "🔇"}
                  </span>
                  <span className="feed-score" title="Final confidence">
                    {(analysis.final_score * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VideoFeedPanel;
