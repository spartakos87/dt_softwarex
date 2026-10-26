import { API_BASE } from "../config";
import { useEffect, useState } from "react";
import axios from "axios";

export default function SensorStatusGrid({ onSelect, aiEnabled }) {
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    axios
      .get(`${API_BASE}/sensor/status/${aiEnabled}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(({ data }) => setStatuses(data))
      .catch(() => setError("Failed to load sensor statuses"));
  }, [aiEnabled]);

  const groupedByLocation = statuses.reduce((acc, sensor) => {
    const loc = sensor.location || "Unknown";
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(sensor);
    return acc;
  }, {});

  const getColor = (sensor) => sensor.status;

  const computeAverages = (sensors) => {
    const sums = {};
    const counts = {};

    sensors.forEach(sensor => {
      const data = sensor.latest_data || {};
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === "number") {
          sums[key] = (sums[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });

    const averages = {};
    Object.entries(sums).forEach(([key, sum]) => {
      averages[key] = +(sum / counts[key]).toFixed(2);
    });

    return averages;
  };

  // Helpers for floor grouping on the locations view
  const floorLabel = (f) => (f === 2 ? "Kindergarten" : f === 0 ? "Floor 0" : f === 1 ? "Floor 1" : `Floor ${f}`);
  const floorOrder = [0, 1, 2];


  if (error) return <p style={{ color: "crimson" }}>{error}</p>;

  return (
    <div style={gridStyles.container}>
      {/* === Locations View === */}
      {/* === Locations View (grouped by floor) === */}
      {!selectedLocation && (() => {
        // Build: floor -> [{ loc, sensors }]
        const locsByFloor = {};
        Object.entries(groupedByLocation).forEach(([loc, sensors]) => {
          // Which floors exist for this location?
          const floorsHere = Array.from(
            new Set(
              sensors.map(s => Number.isInteger(s.floor) ? s.floor : 0)
            )
          );
          floorsHere.forEach(f => {
            (locsByFloor[f] ||= []).push({ loc, sensors });
          });
        });

        return floorOrder.map((f) => {
          const groups = locsByFloor[f] || [];
          if (!groups.length) return null;

          return (
            <div key={`floor-group-${f}`} style={{ gridColumn: "1 / -1" }}>
              {/* Box wrapper (like your screenshot) */}
              <div
                style={{
                  position: "relative",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem 1rem",
                  background: "#fff",
                }}
              >
                {/* Legend-style label sitting on the border */}
                <span
                  style={{
                    position: "absolute",
                    top: -12,
                    left: 12,
                    padding: "0 8px",
                    background: "#fff",
                    color: "#555",
                    fontStyle: "italic",
                    fontSize: "0.95rem",
                  }}
                >
                  {floorLabel(f)}
                </span>

                {/* Inner grid so cards for this floor don't mix with other floors */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "1rem",
                    marginTop: "0.25rem",
                  }}
                >
                  {groups.map(({ loc, sensors }) => {
                    let color = "green";
                    if (sensors.some((s) => s.status === "red")) color = "red";
                    else if (sensors.some((s) => s.status === "yellow")) color = "yellow";

                    return (
                      <div
                        key={`${f}-${loc}`}
                        onClick={() => setSelectedLocation(loc)}
                        style={{
                          ...gridStyles.locationCard,
                          borderLeft: `6px solid ${color}`,
                        }}
                      >
                        <strong>{loc}</strong>
                        <span style={{ fontSize: "0.85rem", color: "#555" }}>
                          {sensors.length} sensors
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        });

      })()}


      {/* === Sensors View === */}
      {selectedLocation && (
        <>
          <hr
            style={{
              gridColumn: "1 / -1",
              width: "100%",
              border: "none",
              borderTop: "1px solid #e5e7eb",
              margin: "0 0 1rem 0",
            }}
          />
          <div style={{ gridColumn: "1 / -1", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", }}>
            <button
              onClick={() => setSelectedLocation(null)}
              style={{ ...gridStyles.backBtn, position: "absolute", left: 0 }}
              aria-label="Go back"
            >
              ⬅ Back
            </button>

            <h1 style={{ fontSize: 28, margin: 0 }}>{selectedLocation}</h1>
          </div>
          {groupedByLocation[selectedLocation].map(sensor => (
            <div
              key={sensor.id}
              onClick={() => {
                onSelect(sensor);
                setSelectedSensor(sensor);
              }}
              style={gridStyles.card}
            >
              <div
                style={{
                  ...gridStyles.led,
                  backgroundColor: getColor(sensor),
                }}
              />
              <div style={gridStyles.info}>
                <strong>{sensor.name}</strong>
                <small style={{ color: "#666" }}>{sensor.type}</small>
              </div>
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
            <h4 style={{ color: '#3d004dff', fontSize: '1rem' }}>Average Sensor Readings</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              {Object.entries(
                groupedByLocation[selectedLocation]
                  .reduce((acc, sensor) => {
                    const type = sensor.type || "Unknown";
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(sensor);
                    return acc;
                  }, {})
              ).map(([type, sensorsOfType]) => {
                const averages = computeAverages(sensorsOfType);
                return (
                  <div
                    key={type}
                    style={{
                      background: "#f9f9f9",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      minWidth: "200px",
                      flex: "1",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: "0.5rem" }}>
                      {type}
                    </strong>
                    <div style={{ fontSize: "0.85rem", color: "#333" }}>
                      {Object.entries(averages).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: "0.25rem" }}>
                          Average {k}: <span style={{ fontWeight: "bold" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>



          </div>
        </>
      )}
    </div>
  );
}

const gridStyles = {
  container: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "1rem",
    marginBottom: "1rem",
  },
  locationCard: {
    background: "#f5f5f5",
    padding: "1rem",
    borderRadius: "10px",
    cursor: "pointer",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    borderLeft: "6px solid gray", // default (overridden inline)
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    marginBottom: "1rem",
    color: "#007BFF",
  },
  card: {
    width: "100%",
    minWidth: "240px",
    display: "flex",
    alignItems: "center",
    background: "rgba(214, 214, 214, 1)",
    padding: "0.3rem",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(148, 148, 148, 0.05)",
    cursor: "pointer",
  },
  led: {
    width: "13px",
    height: "13px",
    borderRadius: "50%",
    marginRight: "0.75rem",
  },
  info: {
    fontSize: "15px",
    display: "flex",
    flexDirection: "column",
  },
};
