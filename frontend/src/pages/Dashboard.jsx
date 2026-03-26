import { useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import "./dashboard.css";
import AlertsPanel from "../components/AlertsPanel";
import MapView from "../components/MapView";
import IntersectionPanel from "../components/IntersectionPanel";
import ManualControlPanel from "../components/ManualControlPanel";
import DeviceStatusPanel from "../components/DeviceStatusPanel";
import VideoFeedPanel from "../components/VideoFeedPanel";
import VideoUploadPanel from "../components/VideoUploadPanel";


function Dashboard() {
  const [data, setData] = useState({ intersections: [] });
  const [alerts, setAlerts] = useState([]);
  const [selectedIntersection, setSelectedIntersection] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("raahat-theme") || "dark");

  const isEmergency = data.intersections?.some(int =>
    int.lanes?.some(l => l.emergency)
  );

  const toggleTheme = (t) => {
    setTheme(t);
    localStorage.setItem("raahat-theme", t);
  };

  // Poll /traffic/current (now built from DB)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/traffic/current`);
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
                message: "ALERT — Emergency vehicle detected!",
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
            const msg = `${int.name || int.id}: Lane ${signal.active_lane} → GREEN (${signal.mode})`;
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
        // silent
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedIntersection]);

  return (
    <div className={`dashboard ${isEmergency ? "emergency" : ""}`} data-theme={theme}>

      {/* Theme Toggle */}
      <div className="theme-toggle">
        <button
          className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
          onClick={() => toggleTheme("dark")}
        >
          Dark
        </button>
        <button
          className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => toggleTheme("light")}
        >
          Light
        </button>
      </div>

      {/* LEFT PANEL — Intersections + Upload */}
      <div className="panel left">
        <h2>Intersections</h2>

        {data.intersections.length === 0 ? (
          <p className="empty-state">
            No intersections registered yet.
            <br />
            <span style={{ fontSize: "10px", opacity: 0.6 }}>POST /intersections to register</span>
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

        {/* Upload section — in left panel now */}
        <div className="left-section-divider">
          <VideoUploadPanel selectedIntersection={selectedIntersection} />
        </div>
      </div>

      {/* CENTER PANEL — Map + Video Feed */}
      <div className="panel center">
        <MapView
          data={data}
          onSelectIntersection={setSelectedIntersection}
          selectedIntersection={selectedIntersection}
          theme={theme}
        />

        <VideoFeedPanel intersectionId={selectedIntersection} />
      </div>

      {/* RIGHT PANEL — Control Center + Activity */}
      <div className="panel right">
        <h2>Control Center</h2>

        <ManualControlPanel selectedIntersection={selectedIntersection} />

        <div className="right-section-divider">
          <DeviceStatusPanel />
        </div>

        <div className="right-section-divider">
          <h3 className="section-heading">Activity Log</h3>
          <AlertsPanel alerts={alerts} />
        </div>
      </div>

    </div>
  );
}

export default Dashboard;