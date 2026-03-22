import { useState, useEffect } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";

function VideoUploadPanel({ selectedIntersection }) {
  const [intersections, setIntersections] = useState([]);
  const [selectedInt, setSelectedInt] = useState("");
  const [selectedLane, setSelectedLane] = useState("");
  const [availableLanes, setAvailableLanes] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Fetch registered intersections
  useEffect(() => {
    const fetch = () => {
      axios.get(`${API_BASE_URL}/intersections`)
        .then(res => {
          setIntersections(res.data);
          if (res.data.length > 0 && !selectedInt) {
            setSelectedInt(res.data[0].intersection_id);
            setAvailableLanes(res.data[0].lanes);
            setSelectedLane(res.data[0].lanes[0]);
          }
        })
        .catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync with selected intersection from dashboard
  useEffect(() => {
    if (selectedIntersection && intersections.length > 0) {
      setSelectedInt(selectedIntersection);
    }
  }, [selectedIntersection, intersections]);

  // Update available lanes when intersection changes
  useEffect(() => {
    const int = intersections.find(i => i.intersection_id === selectedInt);
    if (int) {
      setAvailableLanes(int.lanes);
      if (!int.lanes.includes(selectedLane)) {
        setSelectedLane(int.lanes[0]);
      }
    }
  }, [selectedInt, intersections]);

  // Upload ONLY — no auto-analysis
  const handleUpload = async () => {
    if (!file || !selectedInt || !selectedLane) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("intersection_id", selectedInt);
    formData.append("lane_id", selectedLane);

    try {
      await axios.post(`${API_BASE_URL}/video/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadResult({ type: "success", message: `✅ Lane ${selectedLane} uploaded!` });
      setFile(null);
      setUploadedCount(prev => prev + 1);
    } catch (err) {
      setUploadResult({
        type: "error",
        message: `❌ ${err.response?.data?.error || err.message}`
      });
    }
    setUploading(false);
  };

  // Analyze ALL uploaded videos for the selected intersection
  const handleAnalyze = async () => {
    if (!selectedInt) return;

    setAnalyzing(true);
    setUploadResult(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/video/analyze/${selectedInt}`);
      const data = res.data;
      setUploadResult({
        type: "success",
        message: `✅ Analyzed ${data.processed} videos. ${data.decision?.decision ? `Lane ${data.decision.decision.active_lane} → GREEN` : ""}`
      });
      setUploadedCount(0);
    } catch (err) {
      setUploadResult({
        type: "error",
        message: `❌ ${err.response?.data?.error || err.message}`
      });
    }
    setAnalyzing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("video/")) {
      setFile(droppedFile);
    }
  };

  return (
    <div className="video-upload-panel">
      <h4 className="upload-title">📹 Upload Lane Videos</h4>

      {intersections.length === 0 ? (
        <p className="upload-note">No intersections registered yet.</p>
      ) : (
        <>
          <div className="upload-field">
            <label className="upload-label">Intersection</label>
            <select
              className="upload-select"
              value={selectedInt}
              onChange={e => setSelectedInt(e.target.value)}
            >
              {intersections.map(int => (
                <option key={int.intersection_id} value={int.intersection_id}>
                  {int.name} ({int.intersection_id})
                </option>
              ))}
            </select>
          </div>

          <div className="upload-field">
            <label className="upload-label">Lane</label>
            <div className="lane-selector">
              {availableLanes.map(l => (
                <button
                  key={l}
                  className={`lane-btn ${selectedLane === l ? "selected" : ""}`}
                  onClick={() => setSelectedLane(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("video-file-input").click()}
          >
            <input
              id="video-file-input"
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={e => setFile(e.target.files[0])}
            />
            {file ? (
              <div className="file-info">
                <span className="file-icon">🎬</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ) : (
              <div className="drop-placeholder">
                <span className="drop-icon">📂</span>
                <span>Drop video or click to browse</span>
              </div>
            )}
          </div>

          {/* Upload button — upload only */}
          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ marginBottom: "8px" }}
          >
            {uploading ? "⏳ Uploading..." : `📤 Upload to Lane ${selectedLane}`}
          </button>

          {/* Analyze button — processes all uploaded videos */}
          <button
            className="override-btn"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? "⏳ Analyzing..." : "🧠 Analyze & Update Signals"}
          </button>

          {uploadedCount > 0 && (
            <p style={{ fontSize: "10px", color: "#38bdf8", textAlign: "center", margin: "6px 0 0" }}>
              {uploadedCount} video(s) ready for analysis
            </p>
          )}

          {uploadResult && (
            <div className={`upload-result ${uploadResult.type}`}>
              {uploadResult.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VideoUploadPanel;
