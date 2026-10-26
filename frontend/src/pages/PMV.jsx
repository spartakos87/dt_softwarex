import { API_BASE } from "../config";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Utility: row background based on status
const getRowColor = (status, showColors) => {
  if (!showColors) return {};
  switch (status) {
    case "Comfortable":
      return { backgroundColor: "#d4edda" };
    case "Moderate":
      return { backgroundColor: "#fff3cd" };
    case "Uncomfortable":
      return { backgroundColor: "#f8d7da" };
    default:
      return {};
  }
};

// Utility: status text color
const getStatusColor = (status) => {
  switch (status) {
    case "Comfortable":
      return "#2e7d32";
    case "Moderate":
      return "#b45f06";
    case "Uncomfortable":
      return "#a71d2a";
    default:
      return "#000";
  }
};

// === Indoor parameter derivation from weather ===
const deriveCloFromTemp = (t) => {
  if (t <= 0) return 1.0;
  if (t <= 10) return 0.9;
  if (t <= 15) return 0.8;
  if (t <= 20) return 0.7;
  if (t <= 26) return 0.5;
  return 0.36;
};

const deriveIndoorAirVelocity = (outWind) => {
  return 0.1;
};

export default function PMV() {
  const [pmvData, setPmvData] = useState([]);
  const [error, setError] = useState(null);
  const [showColors, setShowColors] = useState(false);
  const [params, setParams] = useState(null);
  const navigate = useNavigate();

  // Fetch weather once, compute PMV params
  useEffect(() => {
    const apiKey = import.meta.env.VITE_OWM_KEY;
    const lat = 52.2297;
    const lon = 21.0122;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

    axios.get(weatherUrl)
      .then(res => {
        const outdoorTemp = res.data?.main?.temp ?? 20;
        const outdoorWind = res.data?.wind?.speed ?? 0.1;

        const met = 1.1; // office/seated light work
        const clo = deriveCloFromTemp(outdoorTemp);
        const v_air = deriveIndoorAirVelocity(outdoorWind);

        setParams({ met, clo, v_air });
      })
      .catch(() => setError("Failed to load weather data"));
  }, []);

  // Fetch PMV once with computed params
  useEffect(() => {
    if (!params) return;
    const token = sessionStorage.getItem("token");
    axios.get(`${API_BASE}/pmv`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params
    })
      .then(res => setPmvData(res.data))
      .catch(() => setError("Failed to fetch PMV data"));
  }, [params]);

  return (
    <div style={styles.page}>
      {/* Fixed header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn} aria-label="Go back">
          ⬅ Back
        </button>
        <h2 style={styles.title}>📋 PMV Sensor List</h2>
      </div>
      {/* Controls */}
      <div style={styles.controls}>
        <button
          onClick={() => setShowColors(prev => !prev)}
          style={{
            ...styles.toggleRealtimeBtn,
            backgroundColor: showColors ? "#28a745" : "#6c757d",
          }}
        >
          {showColors ? "Row Colors ON" : "Row Colors OFF"}
        </button>

        {params && (
          <div style={styles.badges}>
            <span style={styles.badge}>Metabolic Rate: {params.met.toFixed(2)} met</span>
            <span style={styles.badge}>Clothing Insulation: {params.clo.toFixed(2)} clo</span>
            <span style={styles.badge}>Air Velocity: {params.v_air.toFixed(2)} m/s</span>
          </div>
        )}
      </div>
      {/* Scrollable content */}
      <div style={styles.scrollArea}>
        {error && <p style={styles.error}>{error}</p>}

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Sensor ID</th>
              <th style={styles.th}>Timestamp</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Temperature (°C)</th>
              <th style={styles.th}>Humidity (%)</th>
              <th style={styles.th}>PMV</th>
              <th style={styles.th}>PPD (%)</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pmvData.map((sensor, idx) => (
              <tr
                key={sensor.id}
                style={{
                  ...(idx % 2 === 0 ? styles.rowEven : styles.rowOdd),
                  ...getRowColor(sensor.status, showColors),
                }}
              >
                <td style={styles.td}>{sensor.id}</td>
                <td style={styles.td}>
                  {sensor.timestamp ? new Date(sensor.timestamp).toLocaleString() : "-"}
                </td>
                <td style={styles.td}>{sensor.name}</td>
                <td style={styles.td}>{sensor.temperature ?? "-"}</td>
                <td style={styles.td}>{sensor.humidity ?? "-"}</td>
                <td style={styles.td}>{sensor.pmv}</td>
                <td style={styles.td}>{sensor.ppd}</td>
                <td style={{ ...styles.td, fontWeight: "bold", color: getStatusColor(sensor.status) }}>
                  {sensor.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "Segoe UI, sans-serif",
  },
  header: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem 2rem",
    borderBottom: "1px solid #ddd",
    backgroundColor: "#fff",
    zIndex: 1,
  },
  scrollArea: {
    flex: "1 1 auto",
    overflowY: "auto",
    padding: "1rem 2rem",
  },
  title: {
    margin: 0,
    color: "#2c3e50",
    textAlign: "center",
    flex: 1,
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#007BFF",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap",
    padding: "1rem 2rem",
  },
  toggleRealtimeBtn: {
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "bold",
  },
  badges: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  badge: {
    backgroundColor: "#e0e0e0",
    padding: "0.3rem 0.6rem",
    borderRadius: "12px",
    fontSize: "0.85rem",
    color: "#333",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  th: {
    backgroundColor: "#f0f4f8",
    padding: "0.75rem",
    borderBottom: "1px solid #ddd",
    textAlign: "center",
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #eee",
    textAlign: "center",
  },
  rowEven: { backgroundColor: "#fafafa" },
  rowOdd: { backgroundColor: "#fff" },
  error: {
    color: "crimson",
    marginBottom: "1rem",
  },
};
