import { useEffect, useState } from "react";
import axios from "axios";
import "./dashboard.css";
import AlertsPanel from "../components/AlertsPanel";
import MapView from "../components/MapView";
import IntersectionPanel from "../components/IntersectionPanel";
import ManualControlPanel from "../components/ManualControlPanel";
import VideoFeedPanel from "../components/VideoFeedPanel";
import VideoUploadPanel from "../components/VideoUploadPanel";


function Dashboard() {
  const [data, setData] = useState({ intersections: [] });
  const [alerts, setAlerts] = useState([]);
  const [selectedIntersection, setSelectedIntersection] = useState(null);

  const isEmergency = data.intersections?.some(int =>
    int.lanes?.some(l => l.emergency)
  );

  // Poll /traffic/current (now built from DB)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("http://localhost:3000/traffic/current");
        setData(res.data);

        // Auto-select first intersection if none selected
        if (!selectedIntersection && res.data.intersections?.length > 0) {
          setSelectedIntersection(res.data.intersections[0].id);
        }

        // Emergency alert
        if (res.data.intersections?.some(int =>
          int.lanes?.some(l => l.emergency)
        )) {
          setAlerts(prev => {
            if (prev[0]?.type === "emergency") return prev;
            return [
              {
                message: "🚨 Emergency vehicle detected!",
                time: new Date().toLocaleTimeString(),
                type: "emergency"
              },
              ...prev.slice(0, 19)
            ];
          });
        }

        // Signal change alerts per intersection
        for (const int of (res.data.intersections || [])) {
          const signal = int.signal;
          if (signal?.active_lane) {
            const msg = `${int.id}: Lane ${signal.active_lane} → GREEN (${signal.mode})`;
            setAlerts(prev => {
              if (prev[0]?.message === msg) return prev;
              return [
                {
                  message: msg,
                  time: new Date().toLocaleTimeString(),
                  type: signal.mode === "MANUAL" ? "manual" : "info"
                },
                ...prev.slice(0, 19)
              ];
            });
          }
        }

      } catch (err) {
        // silent — server might not be running yet
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedIntersection]);

  return (
    <div className={`dashboard ${isEmergency ? "emergency" : ""}`}>

      {/* LEFT PANEL */}
      <div className="panel left">
        <h2>🚦 Intersections</h2>

        {data.intersections.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "12px", padding: "12px" }}>
            No intersections registered yet. Register via POST /intersections API.
          </p>
        ) : (
          data.intersections.map((int) => (
            <div
              key={int.id}
              onClick={() => setSelectedIntersection(int.id)}
              style={{ cursor: "pointer" }}
            >
              <IntersectionPanel
                intersection={int}
                isSelected={selectedIntersection === int.id}
              />
            </div>
          ))
        )}
      </div>

      {/* CENTER PANEL */}
      <div className="panel center">

        <MapView
          data={data}
          onSelectIntersection={setSelectedIntersection}
          selectedIntersection={selectedIntersection}
        />

        {/* 4-Lane Video Feed Grid — under the map */}
        <VideoFeedPanel intersectionId={selectedIntersection} />

      </div>

      {/* RIGHT PANEL */}
      <div className="panel right">
        <h2>🎛️ Control Center</h2>

        <ManualControlPanel selectedIntersection={selectedIntersection} />

        <div style={{ marginTop: "16px" }}>
          <VideoUploadPanel selectedIntersection={selectedIntersection} />
        </div>

        <div style={{ marginTop: "16px" }}>
          <h3 style={{ color: "#38bdf8", marginBottom: "8px", fontSize: "14px" }}>📋 Activity Log</h3>
          <AlertsPanel alerts={alerts} />
        </div>
      </div>

    </div>
  );
}

export default Dashboard;