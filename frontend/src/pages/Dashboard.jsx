import { useEffect, useState } from "react";
import axios from "axios";
import "./dashboard.css";
import Intersection from "../components/Intersection";
import DecisionPanel from "../components/DecisionPanel";
import AlertsPanel from "../components/AlertsPanel";
import SignalGrid from "../components/SignalGrid";
import MapView from "../components/MapView";
import IntersectionPanel from "../components/IntersectionPanel";


function Dashboard() {
  const [data, setData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const isEmergency = data.lanes?.some(l => l.emergency);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get("http://localhost:3000/traffic/current");
        setData(res.data);

        if (res.data.lanes?.some(l => l.emergency)) {
        setAlerts(prev => [
            {
                message: "🚨 Emergency vehicle detected!",
                time: new Date().toLocaleTimeString()
            },
            ...prev
        ]);
        }

        // ✅ Add alert
        if (res.data.active_lane) {
          setAlerts(prev => [
            {
              message: `Lane ${res.data.active_lane} selected`,
              time: new Date().toLocaleTimeString()
            },
            ...prev.slice(0, 9)
          ]);
        }

      } catch (err) {
        console.error("Error fetching data:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

    if (!data || !data.intersections) return <p>Loading...</p>;

  return (
  <div className="dashboard">

    {/* LEFT PANEL */}
    <div className="panel left">
      <h2>🚦 Intersections</h2>

      {data.intersections.map((int) => (
        <IntersectionPanel key={int.id} intersection={int} />
      ))}

    </div>

    {/* CENTER PANEL */}
    <div className={`dashboard panel center ${isEmergency ? "emergency" : ""}`}>

            <MapView data={data} />

            <Intersection activeLane={data.active_lane} />

            <DecisionPanel data={data} />
        </div>

    {/* RIGHT PANEL */}
    <div className="panel right">
      <h2>🚨 Alerts</h2>
      <AlertsPanel alerts={alerts} />
    </div>

  </div>
);
}

export default Dashboard;