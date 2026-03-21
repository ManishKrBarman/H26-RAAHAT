import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapView({ data }) {
  const intersections = data?.intersections || [];

  const [hovered, setHovered] = useState(null);

  const center = intersections.length
    ? [intersections[0].location.lat, intersections[0].location.lng]
    : [28.6139, 77.2090];

  const isEmergency = intersections.some(int =>
    int.lanes.some(l => l.emergency)
  );

  const corridorPath = intersections.map(int => [
    int.location.lat,
    int.location.lng
  ]);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isEmergency) return;

    const interval = setInterval(() => {
      setProgress(prev => prev + 0.02);
    }, 50);

    return () => clearInterval(interval);
  }, [isEmergency]);

  function interpolate(start, end, t) {
    return [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ];
  }

  let vehiclePosition = corridorPath[0];

  if (isEmergency && corridorPath.length > 1) {
    const totalSegments = corridorPath.length - 1;
    const totalProgress = progress % totalSegments;

    const index = Math.floor(totalProgress);
    const t = totalProgress - index;

    const start = corridorPath[index];
    const end = corridorPath[index + 1];

    vehiclePosition = interpolate(start, end, t);
  }

  const ambulanceIcon = L.divIcon({
    html: "🚑",
    className: "",
    iconSize: [30, 30],
  });

  function getIcon(int) {
    const hasEmergency = int.lanes.some(l => l.emergency);

    let color = "#22c55e";

    if (hasEmergency) color = "lime";
    else if (int.lanes.some(l => l.density === "critical")) color = "#ef4444";
    else if (int.lanes.some(l => l.density === "high")) color = "#fb923c";
    else if (int.lanes.some(l => l.density === "medium")) color = "#facc15";

    return L.divIcon({
      html: `<div style="
        background:${color};
        width:20px;
        height:20px;
        border-radius:50%;
        border:2px solid white;
        box-shadow: 0 0 12px ${color};
      "></div>`,
      className: "",
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <MapContainer center={center} zoom={14} style={{ height: "300px" }}>

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {intersections.map(int => (
          <Marker
            key={int.id}
            position={[int.location.lat, int.location.lng]}
            icon={getIcon(int)}
            eventHandlers={{
              mouseover: () => setHovered(int),
              mouseout: () => setHovered(null)
            }}
          >
            <Popup>{int.id}</Popup>
          </Marker>
        ))}

        {isEmergency && corridorPath.length > 1 && (
          <Polyline positions={corridorPath} pathOptions={{ color: "lime" }} />
        )}

        {isEmergency && corridorPath.length > 1 && (
          <Marker position={vehiclePosition} icon={ambulanceIcon}>
            <Popup>🚑 Emergency</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Hover Info */}
      {hovered && (
        <div className="hover-info">
          <h4>{hovered.id}</h4>
          {hovered.lanes.map((lane, i) => (
            <div key={i}>
              Lane {lane.lane}: {lane.density} {lane.emergency && "🚨"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapView;