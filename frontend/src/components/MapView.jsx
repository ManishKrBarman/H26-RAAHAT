import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Only fly to a location when selectedIntersection actually CHANGES
function FlyToHandler({ intersections, selectedIntersection }) {
  const map = useMap();
  const prevSelection = useRef(null);

  useEffect(() => {
    if (!selectedIntersection) return;
    // Only fly if the selection genuinely changed
    if (prevSelection.current === selectedIntersection) return;
    prevSelection.current = selectedIntersection;

    const int = intersections.find(i => i.id === selectedIntersection);
    if (int?.location) {
      map.flyTo([int.location.lat, int.location.lng], 16, { duration: 1.2 });
    }
  }, [selectedIntersection, intersections, map]);

  return null;
}

// Fit map to show all intersections
function FitBounds({ intersections }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || intersections.length === 0) return;
    const bounds = intersections
      .filter(i => i.location)
      .map(i => [i.location.lat, i.location.lng]);
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [intersections, map]);

  return null;
}

function MapView({ data, onSelectIntersection, selectedIntersection }) {
  const intersections = data?.intersections || [];
  const [hovered, setHovered] = useState(null);

  const center = intersections.length
    ? [intersections[0].location.lat, intersections[0].location.lng]
    : [28.6139, 77.2090];

  const isEmergency = intersections.some(int =>
    int.lanes?.some(l => l.emergency)
  );

  const corridorPath = intersections
    .filter(int => int.location)
    .map(int => [int.location.lat, int.location.lng]);

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
    if (start && end) vehiclePosition = interpolate(start, end, t);
  }

  const ambulanceIcon = L.divIcon({
    html: `<div style="font-size:24px;filter:drop-shadow(0 0 6px red);">🚑</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  function getIcon(int) {
    const hasEmergency = int.lanes?.some(l => l.emergency);
    const isSelected = int.id === selectedIntersection;

    let color = "#22c55e";
    let label = "●";
    if (hasEmergency) { color = "#ff3d3d"; label = "🚨"; }
    else if (int.lanes?.some(l => l.density === "critical")) color = "#ef4444";
    else if (int.lanes?.some(l => l.density === "high")) color = "#fb923c";
    else if (int.lanes?.some(l => l.density === "medium")) color = "#facc15";

    const size = isSelected ? 36 : 26;
    const glow = isSelected ? `0 0 20px ${color}, 0 0 40px ${color}55` : `0 0 10px ${color}`;

    return L.divIcon({
      html: `<div class="map-marker ${isSelected ? "selected" : ""} ${hasEmergency ? "emergency" : ""}" style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background: radial-gradient(circle at 35% 35%, ${color}, ${color}88);
        border: ${isSelected ? "3px solid #38bdf8" : "2px solid rgba(255,255,255,0.6)"};
        box-shadow: ${glow};
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${isSelected ? "14px" : "10px"};
        color:white;
        font-weight:bold;
        transition: all 0.3s ease;
      ">${hasEmergency ? "🚨" : (int.signal?.active_lane || "")}</div>`,
      className: "",
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        className="map-container"
      >
        {/* Satellite imagery — clearly visible on dark UI */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri, Maxar, Earthstar'
          maxZoom={19}
        />
        {/* Street labels overlay on top of satellite */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
          pane="shadowPane"
        />

        {/* Fit all intersections in view initially */}
        <FitBounds intersections={intersections} />

        {/* Fly to selected intersection */}
        <FlyToHandler intersections={intersections} selectedIntersection={selectedIntersection} />

        {/* Intersection markers */}
        {intersections.map(int => (
          <Marker
            key={int.id}
            position={[int.location.lat, int.location.lng]}
            icon={getIcon(int)}
            eventHandlers={{
              click: () => onSelectIntersection && onSelectIntersection(int.id),
              mouseover: () => setHovered(int),
              mouseout: () => setHovered(null)
            }}
          >
            <Popup className="dark-popup">
              <div className="map-popup-content">
                <div className="popup-name">{int.name || int.id}</div>
                <div className="popup-id">{int.id}</div>
                {int.decision && (
                  <div className="popup-signal">
                    <span className="popup-dot" style={{ background: "#00e676" }}></span>
                    Lane {int.decision.active_lane} — {int.decision.reason}
                  </div>
                )}
                <div className="popup-lanes">
                  {int.lanes?.map((lane, i) => (
                    <span key={i} className={`popup-lane-chip ${lane.density}`}>
                      {lane.lane}: {lane.density}
                      {lane.emergency && " 🚨"}
                    </span>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Emergency corridor path */}
        {isEmergency && corridorPath.length > 1 && (
          <Polyline
            positions={corridorPath}
            pathOptions={{
              color: "#ff3d3d",
              weight: 4,
              dashArray: "10 8",
              opacity: 0.8
            }}
          />
        )}

        {/* Ambulance marker */}
        {isEmergency && vehiclePosition && corridorPath.length > 1 && (
          <Marker position={vehiclePosition} icon={ambulanceIcon}>
            <Popup>🚑 Emergency Vehicle</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Hover tooltip */}
      {hovered && (
        <div className="map-hover-tooltip">
          <div className="tooltip-name">{hovered.name || hovered.id}</div>
          {hovered.lanes?.map((lane, i) => (
            <div key={i} className="tooltip-lane">
              <span className="tooltip-lane-id">Lane {lane.lane}</span>
              <span className={`tooltip-density ${lane.density}`}>{lane.density}</span>
              {lane.emergency && <span>🚨</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapView;