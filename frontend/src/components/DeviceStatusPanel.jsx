import { useState, useEffect } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";

function DeviceStatusPanel() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/esp32/devices`);
        setDevices(res.data);
      } catch (err) {
        // silent — ESP32 endpoints might not exist yet
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  if (devices.length === 0) {
    return (
      <div className="device-status-panel">
        <h4 className="section-heading">Hardware Devices</h4>
        <p className="empty-state" style={{ fontSize: "11px" }}>
          No ESP32 devices connected.
          <br />
          <span style={{ opacity: 0.5 }}>Devices auto-register via heartbeat</span>
        </p>
      </div>
    );
  }

  return (
    <div className="device-status-panel">
      <h4 className="section-heading">Hardware Devices</h4>

      {devices.map((device) => {
        const isOnline = device.status === "online";
        const lastSeen = device.lastSeen
          ? new Date(device.lastSeen).toLocaleTimeString()
          : "—";

        return (
          <div
            key={device.device_id}
            className={`device-card ${isOnline ? "online" : "offline"}`}
          >
            <div className="device-header">
              <span className={`device-dot ${isOnline ? "online" : "offline"}`} />
              <span className="device-name">{device.device_id}</span>
              <span className={`device-badge ${isOnline ? "online" : "offline"}`}>
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <div className="device-details">
              <div className="device-detail-row">
                <span className="detail-label">Intersection</span>
                <span className="detail-value">{device.intersection_id}</span>
              </div>
              <div className="device-detail-row">
                <span className="detail-label">IP Address</span>
                <span className="detail-value">{device.ip || "—"}</span>
              </div>
              <div className="device-detail-row">
                <span className="detail-label">Last Seen</span>
                <span className="detail-value">{lastSeen}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DeviceStatusPanel;
