import { API_BASE } from "../config";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SensorStatusGrid from "../components/SensorStatusGrid";
import { CircleX, Info } from 'lucide-react';
import SensorChart from "../components/SensorCharts";
import logout from "../components/logout";

const aiIconUrl = '/ai_assistant.png';

export default function Dashboard() {
  const navigate = useNavigate();
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [params, setParams] = useState(null);
  const [sensorType, setSensorType] = useState("All");
  const [criteria, setCriteria] = useState("");
  const notificationsRef = useRef();
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [gridKey, setGridKey] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);

  // initial pane height (notifications)
  const initialHeight = window.innerHeight * 0.07;
  const [paneHeight, setPaneHeight] = useState(initialHeight);

  // rebuild SensorStatusGrid every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setGridKey(prev => prev + 1);
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(interval);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!sessionStorage.getItem("token")) navigate("/");
  }, [navigate]);

  // Fetch weather + forecast
  useEffect(() => {
    const apiKey = import.meta.env.VITE_OWM_KEY;
    if (!apiKey) return; // Optional external weather service disabled in local demo
    const lat = Number(import.meta.env.VITE_WEATHER_LAT);
    const lon = Number(import.meta.env.VITE_WEATHER_LON);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !import.meta.env.VITE_WEATHER_LAT || !import.meta.env.VITE_WEATHER_LON) return;
    axios
      .get("https://api.openweathermap.org/data/2.5/weather", {
        params: { lat, lon, units: "metric", appid: apiKey }
      })
      .then(res => {
        const w = res.data;
        const met = 1.1;
        const clo = w.main.temp <= 10 ? 1 : w.main.temp <= 20 ? 0.7 : 0.5;
        const v_air = Math.min(Math.max(w.wind.speed || 0.1, 0), 0.3);
        setParams({ met, clo, v_air });
        return axios.get("https://api.openweathermap.org/data/2.5/forecast", {
          params: { lat, lon, units: "metric", appid: apiKey }
        });
      })
      .then(res => setForecast(res.data))
      .catch(err => setError(err.message));
  }, []);

  // PMV notifications
  useEffect(() => {
    if (!params) return;
    const token = sessionStorage.getItem("token");
    const fetchPmv = () => {
      axios
        .get(`${API_BASE}/pmv`, { params, headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const notes = res.data
            .filter(s => s.status !== "Comfortable")
            .map(s => ({
              id: `aq-${s.id}`,
              sensor: s.name,
              message: `Sensor ${s.name} - PMV is ${s.status}`,
              type: "AirQuality",
              severity: s.status
            }));
          setNotifications(prev => [
            ...prev.filter(n => n.type !== "AirQuality"),
            ...notes
          ]);
        })
        .catch(() => setError("Failed to fetch PMV data"));
    };
    fetchPmv();
    const iv = setInterval(fetchPmv, 600_000);
    return () => clearInterval(iv);
  }, [params]);

  // Heater notifications
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const fetchHeater = () => {
      axios
        .get(`${API_BASE}/getSensorNotifications`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => {
          const notes = res.data.flatMap(([id, name, , , tgt, tmp, bat]) => {
            const a = [];
            if (bat < 20)
              a.push({
                id: `ht-batt-${id}`,
                sensor: name,
                message: `Sensor ${name} - Battery low (${bat}%)`,
                type: "Heater",
                metric: "Battery",
                severity: "Moderate"
              });
            if (Math.abs(tmp - tgt) > 2)
              a.push({
                id: `ht-temp-${id}`,
                sensor: name,
                message: `Sensor ${name} - Temp off by ${Math.abs(tmp - tgt).toFixed(1)}°C`,
                type: "Heater",
                metric: "Temperature",
                severity: "Uncomfortable"
              });
            return a;
          });
          setNotifications(prev => [
            ...prev.filter(n => n.type !== "Heater"),
            ...notes
          ]);
        })
        .catch(() => setError("Failed to fetch Heater notifications"));
    };
    fetchHeater();
    const iv = setInterval(fetchHeater, 600_000);
    return () => clearInterval(iv);
  }, []);

  // Energy notifications
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const fetchEnergy = () => {
      axios
        .get(`${API_BASE}/energy/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => {
          const notes = res.data.map(n => ({
            id: n.id,
            sensor: n.id,
            message: n.message,
            type: "EnergyMeter",
            metric: n.metric,
            severity: n.severity
          }));
          setNotifications(prev => [
            ...prev.filter(n => n.type !== "EnergyMeter"),
            ...notes
          ]);
        })
        .catch(() => setError("Failed to fetch EnergyMeter notifications"));
    };
    fetchEnergy();
    const iv = setInterval(fetchEnergy, 600_000);
    return () => clearInterval(iv);
  }, []);

  const handleRemove = idx =>
    setNotifications(n => n.filter((_, i) => i !== idx));
  const clearAll = () => setNotifications([]);

  // Apply filters
  let visible = notifications;
  if (sensorType !== "All")
    visible = visible.filter(n => n.type === sensorType);
  if (criteria)
    visible = visible.filter(n =>
      n.metric ? n.metric === criteria : n.severity === criteria
    );

  const next = forecast?.list?.[0];
  const city = forecast?.city?.name;

  // Drag to resize notifications pane
  const startDrag = e => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = notificationsRef.current.getBoundingClientRect().height;
    const minH = window.innerHeight * 0.07;
    const onMouseMove = e => {
      const delta = startY - e.clientY;
      const newH = startH + delta;
      setPaneHeight(Math.max(minH, Math.min(window.innerHeight, newH)));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <h1 style={styles.logo}>🖥️ Digital Twin</h1>
        <div style={styles.menu}>
          <button onClick={() => navigate("/sensors")} style={styles.button}>
            📊 Sensor Data
          </button>
          <button
            onClick={() => navigate("/energy-overview")}
            style={styles.button}
          >
            ⚡ Energy Overview
          </button>
          <button
            onClick={() => navigate("/heater-overview")}
            style={styles.button}
          >
            🔥 Heater Overview
          </button>
          <button onClick={() => navigate("/pmv")} style={styles.button}>
            🌡️ PMV Calculator
          </button>
          <button
            onClick={() => navigate("/floorplan")}
            style={styles.button}
          >
            🏗️ 3D Building View
          </button>
        </div>
        <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            htmlFor="ai-toggle"
            style={{ color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <img
              src={aiIconUrl}
              alt=""
              aria-hidden="true"
              width={25}
              height={25}
              style={{
                display: 'block',
                borderRadius: '50%',
                objectFit: 'cover',
                background: 'white'
              }}
            />
            <span>Enable AI Features for Anomaly Detection</span>
          </label>

          <input
            id="ai-toggle"
            type="checkbox"
            checked={aiEnabled}
            onChange={e => setAiEnabled(e.target.checked)}
          />
        </div>
        {next && (
          <div style={styles.weatherCardSidebar}>
            <p style={styles.city}>{city}</p>
            <p style={styles.forecastTime}>
              {new Date(next.dt * 1000).toLocaleString()}
            </p>
            <img
              src={`https://openweathermap.org/img/wn/${next.weather[0].icon}@2x.png`}
              alt={next.weather[0].description}
              style={styles.icon}
            />
            <p style={styles.temp}>{next.main.temp.toFixed(1)}°C</p>
            <p style={styles.desc}>{next.weather[0].main}</p>
            <p style={styles.details}>
              Humidity: {next.main.humidity}% · Wind: {next.wind.speed} m/s
            </p>
          </div>
        )}
        <div style={{ margin: "1rem 0", display: "flex", justifyContent: "center" }}>
          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      <div style={styles.main}>
        {/* Top pane: SensorStatusGrid */}
        <div style={{ ...styles.content, height: `calc(100vh - ${paneHeight}px)` }}>
          <div style={{ display: "flex", margin: "auto" }}>
            <h1>Sensor Status</h1>
            <button style={styles.infoButton} onClick={() => setShowInstructions(prev => !prev)}><Info /></button>
          </div>
          {/* INFO */}
          {showInstructions && (
            <div style={styles.modalOverlay} onClick={() => setShowInstructions(false)}>
              <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <h2>Indicators Info</h2>
                  <button onClick={() => setShowInstructions(false)} style={styles.closeStatusButton}>
                    <CircleX />
                  </button>
                </div>

                {/* Legend */}
                <div style={{ marginTop: "1rem", lineHeight: 1.5 }}>
                  <strong>Room Indicators:</strong>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "green", marginRight: 8 }} />
                    All sensors are Online (normal)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "yellow", marginRight: 8 }} />
                    At least one sensor has minor issues
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "red", marginRight: 8 }} />
                    At least one sensor is Offline or has major issues
                  </div>
                </div>

                <div style={{ marginTop: "1rem", lineHeight: 1.5 }}>
                  <strong>Sensor Indicators:</strong>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "green", marginRight: 8 }} />
                    Sensor is Online (normal)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "yellow", marginRight: 8 }} />
                    Sensor has minor issues
                  </div>
                  <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", background: "red", marginRight: 8 }} />
                    Sensor is Offline or has major issues
                  </div>
                </div>
                {/* Explanation */}
                <div style={{ marginTop: "1rem", lineHeight: 1.5 }}>
                  <strong>How anomalies are detected:</strong>
                  <p>
                    The "Enable AI Features for Anomaly Detection" checkbox must be checked.
                  </p>
                  <ul style={{ paddingLeft: "1.2rem", margin: "0.5rem 0" }}>
                    <li>
                      We use an <em>Isolation Forest</em> model to learn typical sensor behavior. Each reading’s “anomaly score”
                      is based on how quickly it can be “isolated” in a random decision tree.
                    </li>
                    <li>
                      Scores &gt; 0 are considered normal. Scores &lt; 0 trigger a minor‐issue warning (yellow).
                      Points classified as outliers by the forest are flagged red.
                    </li>
                    <li>
                      In addition, we apply domain rules:
                      <ul style={{ paddingLeft: "1rem" }}>
                        <li><code>ValvePosition</code> and <code>Battery</code> must be between 0–100%</li>
                        <li>Any values more than 3 σ from the mean across all same‐type sensors are also highlighted</li>
                      </ul>
                    </li>
                  </ul>
                  The <em>anomalous_features</em> list shows which checks were triggered for each sensor.
                </div>
              </div>
            </div>
          )}

          <div style={styles.statusContainer}>
            <SensorStatusGrid
              key={`${String(aiEnabled)}-${gridKey}`}
              aiEnabled={aiEnabled}
              onSelect={sensor => setSelectedSensor({ ...sensor, aiEnabled })}
            />
            {selectedSensor && (
              <div style={modalStyles.overlay} onClick={() => setSelectedSensor(null)}>
                <div style={modalStyles.content} onClick={e => e.stopPropagation()}>
                  <button
                    style={styles.closeButton}
                    onClick={() => setSelectedSensor(null)}
                  >
                    <CircleX />
                  </button>

                  <h2 style={{ marginRight: "2rem" }}>
                    {selectedSensor.name}
                  </h2>

                  {selectedSensor.messages?.map((m, i) => {
                    // if the message is literally "DATA", insert a blank line
                    if (m === "DATA") {
                      return <div key={i}><br /><hr /></div>;
                    }
                    // otherwise render the message
                    return (
                      <p key={i} style={{ margin: 0 }}>
                        {m}
                      </p>
                    );
                  })}
                  <br /><hr />
                  <SensorChart sensorId={selectedSensor.id} />
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Bottom pane: Notifications */}
        <div
          ref={notificationsRef}
          style={{ ...styles.notificationsContainer, height: paneHeight }}
        >
          <div style={styles.resizeHandle} onMouseDown={startDrag} />
          <div style={styles.notificationsHeader}>
            <span>Notifications ({visible.length})</span>
            <div style={styles.filterControls}>
              <select
                value={sensorType}
                onChange={e => {
                  setSensorType(e.target.value);
                  setCriteria("");
                }}
                style={styles.dropdown}
              >
                <option value="All">All</option>
                <option value="Heater">Heater</option>
                <option value="AirQuality">AirQuality</option>
                <option value="EnergyMeter">EnergyMeter</option>
              </select>
              {sensorType !== "All" && (
                <select
                  value={criteria}
                  onChange={e => setCriteria(e.target.value)}
                  style={styles.dropdown}
                >
                  <option value="">--Filter--</option>
                  {sensorType === "Heater" &&
                    ["Battery", "Temperature"].map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  {sensorType === "AirQuality" &&
                    ["Moderate", "Uncomfortable"].map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  {sensorType === "EnergyMeter" &&
                    ["PowerFactor", "PhaseImbalance"].map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                </select>
              )}
              {visible.length > 0 && (
                <button onClick={clearAll} style={styles.clearAllBtn}>
                  Clear All
                </button>
              )}
            </div>
          </div>
          <div style={styles.notificationsListWrapper}>
            {visible.length === 0 ? (
              <p style={styles.noNotifications}>No notifications</p>
            ) : (
              <ul style={styles.notificationsList}>
                {visible.map((note, i) => (
                  <li
                    key={note.id}
                    style={{
                      ...styles.notificationItem,
                      backgroundColor:
                        note.severity === "Uncomfortable"
                          ? "#f8d7da"
                          : "#fff3cd",
                      color:
                        note.severity === "Uncomfortable"
                          ? "#a71d2a"
                          : "#856404"
                    }}
                  >
                    <span>{note.message}</span>
                    <button
                      onClick={() => handleRemove(i)}
                      style={styles.removeBtn}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  content: {
    position: "relative",
    background: "#fff",
    paddingLeft: "1.5rem",
    paddingRight: "1.5rem",
    paddingTop: "0.5rem",
    paddingBottom: "0.5rem",
    borderRadius: "0",
    overflowY: "auto",
    maxHeight: "80vh"
  }
};

const styles = {
  layout: { display: "flex" },
  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: "380px",
    background: "#34495e",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    padding: "2rem 1rem",
    overflowY: "auto",
  },
  logo: { margin: 0, marginBottom: "2rem", fontSize: "1.5rem", textAlign: "center" },
  menu: { display: "flex", flexDirection: "column", gap: "1rem" },
  button: {
    fontSize: "1rem",
    background: "#2980b9",
    border: "none",
    color: "#fff",
    padding: "0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "left"
  },
  logoutButton: {
    fontSize: "1rem",
    background: "#e74c3c",
    border: "none",
    color: "#fff",
    padding: "0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "center",
    flex: "0 0 auto",
    alignSelf: "flex-start"
  },
  weatherCardSidebar: {
    marginTop: "auto",
    alignSelf: "center",
    background: "#fff",
    padding: "1rem",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    textAlign: "center",
    width: "auto",
    height: "auto"
  },
  city: { fontSize: "1.5rem", fontWeight: "bold", color: "#2c3e50" },
  forecastTime: { fontSize: "0.75rem", color: "#555" },
  icon: { width: "70px", height: "70px", margin: 0 },
  temp: { fontSize: "1rem", margin: 0, color: "#555" },
  desc: { textTransform: "capitalize", color: "#555", margin: "0.25rem 0" },
  details: { fontSize: "0.75rem", color: "#777" },
  main: {
    flex: 1,
    marginLeft: "380px",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden"
  },
  content: {
    display: "flex",
    flexDirection: "column",
    position: "relative"
  },
  statusContainer: {
    flex: 1,
    overflowY: "auto",
    width: "100%",
    padding: "1rem",
  },
  notificationsContainer: {
    position: "fixed",
    bottom: 0,
    minHeight: "60px",
    left: "380px",
    right: 0,
    background: "#f9f9f9",
    padding: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #ddd",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: 100
  },
  resizeHandle: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "6px",
    cursor: "ns-resize",
    background: "transparent",
    zIndex: 101
  },
  notificationsHeader: {
    flex: "0 0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
    fontWeight: "bold"
  },
  filterControls: { display: "flex", gap: "0.5rem", alignItems: "center" },
  dropdown: {
    padding: "0.5rem",
    fontSize: "0.9rem",
    borderRadius: "6px",
    border: "1px solid #ccc"
  },
  clearAllBtn: {
    background: "none",
    border: "none",
    color: "#007BFF",
    cursor: "pointer",
    fontSize: "0.9rem"
  },
  notificationsListWrapper: { flex: "1 1 auto", overflowY: "auto" },
  noNotifications: { color: "#555", fontStyle: "italic" },
  notificationsList: { listStyle: "none", padding: 0, margin: 0 },
  notificationItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem",
    borderRadius: "6px",
    marginBottom: "0.5rem"
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#856404",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "1rem"
  },
  closeButton: {
    position: "absolute",
    top: "0.8rem",             // distance from top of modal
    right: "0.5rem",           // distance from right of modal
    padding: "0.2rem",
    backgroundColor: "transparent",
    color: "#f00",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "1.2rem"
  },
  modalOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  modal: { background: '#fff', borderRadius: '10px', padding: '1rem', maxWidth: '400px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', overflowY: 'auto', maxHeight: '80vh', position: 'relative' },
  closeStatusButton: {
    position: "absolute",
    top: "0.2rem",             // distance from top of modal
    right: "0rem",           // distance from right of modal
    padding: "0.2rem",
    backgroundColor: "transparent",
    color: "#f00",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "1.2rem"
  },
  infoButton: { padding: '0.9rem 0.2rem', backgroundColor: 'transparent', color: '#007bff', border: 'none', borderRadius: '100%', cursor: 'pointer', fontSize: '1rem', marginLeft: '0.5rem' },

};
