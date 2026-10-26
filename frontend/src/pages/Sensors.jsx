import { API_BASE } from "../config";
import { useEffect, useMemo, useState, Fragment } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Sensors() {
  const [sensorData, setSensorData] = useState({});
  const [expandedRows, setExpandedRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState({ key: "type", dir: "asc" }); // default sort
  const [realTime, setRealTime] = useState(true);
  const navigate = useNavigate();

  const fetchSensors = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/sensors`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setSensorData(res.data); // { AirQuality:[...], Heater:[...], EnergyMeter:[...] }
    } catch (err) {
      console.error("Sensor fetch failed", err);
    }
  };

  useEffect(() => {
    fetchSensors();

    let intervalId;
    if (realTime) {
      intervalId = setInterval(fetchSensors, 5000); // every 5s
    }
    return () => clearInterval(intervalId);
  }, [realTime]);


  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Flatten -> filter -> sort (memoized for perf)
  const rows = useMemo(() => {
    // 1) flatten and add "type" field
    const flat = Object.entries(sensorData).flatMap(([type, arr]) =>
      (arr || []).map((d) => ({ ...d, type }))
    );

    // 2) global search (name, id, location, type, latest_data keys/values)
    const q = searchTerm.trim().toLowerCase();
    const filtered = !q
      ? flat
      : flat.filter((d) => {
        const hay =
          [
            d.name,
            d.id,
            d.location,
            d.type,
            d.last_updated,
            JSON.stringify(d.latest_data || {}),
          ]
            .join(" ")
            .toLowerCase();
        return hay.includes(q);
      });

    // 3) sort
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = sort.key;

    const val = (d) => {
      if (key === "last_updated") return d.last_updated ? new Date(d.last_updated).getTime() : -Infinity;
      return (d[key] ?? "").toString().toLowerCase();
    };

    filtered.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      // stable tiebreaker
      const an = a.name?.toLowerCase() ?? "";
      const bn = b.name?.toLowerCase() ?? "";
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });

    return filtered;
  }, [sensorData, searchTerm, sort]);

  const changeSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const SortHeader = ({ col, label, width }) => (
    <th
      style={{ ...styles.th, ...(width ? { width } : {}), cursor: "pointer", userSelect: "none" }}
      onClick={() => changeSort(col)}
      title={`Sort by ${label}`}
    >
      {label}{" "}
      <span style={{ opacity: sort.key === col ? 1 : 0.25 }}>
        {sort.key === col ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );

  return (
    <div style={styles.page}>
      {/* Fixed header area */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn} aria-label="Go back">
          ⬅ Back
        </button>
        <h2 style={styles.title}>📡 Sensor Data</h2>
      </div>

      {/* Search stays under header */}
      <div style={styles.searchRow}>
        <input
          type="text"
          placeholder="Search by name, id, location, type, data..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.search}
        />
        <button
          onClick={() => setRealTime((prev) => !prev)}
          style={{
            ...styles.toggleRealtimeBtn,
            backgroundColor: realTime ? "#28a745" : "#6c757d",
          }}
        >
          {realTime ? "Real-Time Data: ON" : "Real-Time Data: OFF"}
        </button>
      </div>


      {/* Scrollable list container */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 76 }}>Data</th>
              <SortHeader col="type" label="Type" width={140} />
              <SortHeader col="name" label="Name" />
              <SortHeader col="id" label="Sensor ID" />
              <SortHeader col="location" label="Location" />
              <SortHeader col="last_updated" label="Last Updated" width={200} />
            </tr>
          </thead>
          <tbody>
            {rows.map((device, index) => {
              const isExpanded = !!expandedRows[device.id];
              const data = device.latest_data || {};
              return (
                <Fragment key={device.id}>
                  <tr style={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <td style={styles.td}>
                      <button
                        onClick={() => toggleRow(device.id)}
                        style={{
                          ...styles.toggleBtn,
                          backgroundColor: isExpanded ? "#dc3545" : "#28a745",
                        }}
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </td>
                    <td style={styles.td}>{device.type}</td>
                    <td style={styles.td}>{device.name}</td>
                    <td style={styles.td}>{device.id}</td>
                    <td style={styles.td}>{device.location}</td>
                    <td style={styles.td}>
                      {device.last_updated
                        ? new Date(device.last_updated).toLocaleString()
                        : "N/A"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} style={styles.expandedRow}>
                        {Object.keys(data).length ? (
                          <ul style={styles.dataList}>
                            {Object.entries(data).map(([key, val]) => (
                              <li key={key}>
                                <strong>{key}:</strong> {String(val)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <em style={{ color: "#777" }}>No sensor data</em>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: "center", color: "#666" }}>
                  No sensors found.
                </td>
              </tr>
            )}
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
    height: "100%", // full height of viewport/container
    fontFamily: "Segoe UI, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem 2rem",
    background: "#fff",
    borderBottom: "1px solid #ddd",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    textAlign: "center",
    flex: 1
  },
  tableContainer: {
    flex: 1, // take remaining space
    overflowY: "auto",
    padding: "0 2rem 2rem",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  th: {
    backgroundColor: "#f0f4f8",
    padding: "0.75rem",
    borderBottom: "1px solid #ddd",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
  },
  rowEven: { backgroundColor: "#fafafa" },
  rowOdd: { backgroundColor: "#fff" },
  toggleBtn: {
    border: "none",
    padding: "0.3rem 0.6rem",
    color: "#fff",
    fontWeight: "bold",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1.1rem",
  },
  expandedRow: { backgroundColor: "#f9f9f9", padding: "1rem" },
  dataList: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "1rem",
    margin: "0.5rem",
    padding: "0.5rem",
    border: "3px solid black",
    borderRadius: "6px",
    backgroundColor: "lightgrey",
    listStyleType: "none",
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#007BFF",
  },
  search: {
    padding: "0.5rem 0.75rem",
    width: "100%",
    maxWidth: "420px",
    fontSize: "1rem",
    margin: "1rem 0rem",
    borderRadius: "6px",
    border: "1px solid #ccc",
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    margin: "1rem 2rem",
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
};


export default Sensors;
