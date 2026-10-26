import { API_BASE } from "../config";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from 'react-router-dom';

function HeaterOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "gap", dir: "desc" });
  const [colorMode, setColorMode] = useState("off"); // "off" | "gap" | "valve" | "battery"
  const [highlightNulls, setHighlightNulls] = useState(true);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/heater`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError("⚠️ Failed to fetch heater data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const rows = useMemo(() => {
    const list = Object.entries(data).map(([id, info]) => {
      const m = (info?.Measurements?.[0]?.Value) || {};
      const target = Number(m.TargetTemperature ?? NaN);
      const temp = Number(m.Temperature ?? NaN);
      const gap = (isFinite(target) && isFinite(temp)) ? + Math.abs((target - temp).toFixed(2)) : null;

      return {
        id,
        name: info?.Name ?? "-",
        timestamp: info?.Timestamp ? new Date(info.Timestamp) : null,
        valve: m.ValvePosition ?? null,
        target: isFinite(target) ? target : null,
        temp: isFinite(temp) ? temp : null,
        battery: m.Battery ?? null,
        gap,
      };
    });

    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(r =>
        [
          r.id, r.name,
          r.valve, r.target, r.temp, r.battery, r.gap,
          r.timestamp ? r.timestamp.toLocaleString() : ""
        ].join(" ").toLowerCase().includes(q)
      )
      : list;

    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (r) => {
      if (sort.key === "timestamp") return r.timestamp ? r.timestamp.getTime() : -Infinity;
      return r[sort.key] ?? -Infinity;
    };

    return filtered.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [data, search, sort]);

  const changeSort = (key) => {
    setSort(prev =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  const SortTh = ({ col, children, width }) => (
    <th
      onClick={() => changeSort(col)}
      style={{ ...styles.th, ...(width ? { width } : {}), cursor: "pointer", userSelect: "none" }}
      title={`Sort by ${children}`}
    >
      {children}{" "}
      <span style={{ opacity: sort.key === col ? 1 : 0.25 }}>
        {sort.key === col ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );

  // Coloring rules
  const colorByGap = (gap) => {
    if (gap == null) return null;
    const a = Math.abs(gap);
    if (a < 1.0) return "#d4edda";     // green
    if (a < 2.5) return "#fff3cd";     // yellow
    return "#f8d7da";                  // red
  };
  const colorByValve = (valve) => {
    if (valve == null) return null;
    if (valve < 10) return "#f8d7da";  // red: fully open (chasing heat)
    if (valve <= 60) return "#fff3cd"; // yellow
    return "#d4edda";                  // green
  };
  const colorByBattery = (bat) => {
    if (bat == null) return null;
    if (bat < 15) return "#f8d7da";    // red
    if (bat < 30) return "#fff3cd";    // yellow
    return "#d4edda";                  // green
  };

  const rowStyle = (r) => {
    let bg = null;
    if (colorMode === "gap") bg = colorByGap(r.gap);
    else if (colorMode === "valve") bg = colorByValve(r.valve);
    else if (colorMode === "battery") bg = colorByBattery(r.battery);

    // Neutral highlight for nulls in the active metric
    const isNullActive =
      highlightNulls &&
      colorMode !== "off" &&
      ((colorMode === "gap" && r.gap == null) ||
        (colorMode === "valve" && r.valve == null) ||
        (colorMode === "battery" && r.battery == null));

    return {
      ...(bg ? { backgroundColor: bg } : {}),
      ...(isNullActive ? { backgroundColor: "#46000098" } : {}),
    };
  };

  const toggleMode = (mode) => {
    setColorMode((m) => (m === mode ? "off" : mode)); // clicking the active turns off
  };

  return (
    <div style={styles.page}>
      {/* Sticky header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn} aria-label="Go back">⬅ Back</button>
        <h2 style={styles.headerTitle}>🔥 Heater Sensors Overview</h2>
      </div>
      <div style={styles.controls}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, name, values…"
          style={styles.search}
        />

        {/* Color mode buttons (mutually exclusive) */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => toggleMode("gap")}
            style={{
              ...styles.toggleBtn,
              backgroundColor: colorMode === "gap" ? "#28a745" : "#6c757d",
            }}
            title="Color rows by temperature gap"
          >
            Gap
          </button>
          <button
            onClick={() => toggleMode("valve")}
            style={{
              ...styles.toggleBtn,
              backgroundColor: colorMode === "valve" ? "#28a745" : "#6c757d",
            }}
            title="Color rows by valve position"
          >
            Valve
          </button>
          <button
            onClick={() => toggleMode("battery")}
            style={{
              ...styles.toggleBtn,
              backgroundColor: colorMode === "battery" ? "#28a745" : "#6c757d",
            }}
            title="Color rows by battery"
          >
            Battery
          </button>

          {/* Highlight nulls */}
          <button
            onClick={() => setHighlightNulls((p) => !p)}
            style={{
              ...styles.toggleBtn,
              backgroundColor: highlightNulls ? "#28a745" : "#6c757d",
            }}
            title="Neutral highlight for missing values in the active metric"
          >
            Highlight Nulls
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={styles.scrollArea}>
        {loading && <p>Loading data...</p>}
        {error && <p style={styles.error}>{error}</p>}

        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <SortTh col="name" width={220}>Name</SortTh>
                <SortTh col="id" width={260}>Sensor ID</SortTh>
                <SortTh col="timestamp" width={200}>Timestamp</SortTh>
                <SortTh col="valve">Valve Position (%)</SortTh>
                <SortTh col="target">Target Temp (°C)</SortTh>
                <SortTh col="temp">Current Temp (°C)</SortTh>
                <SortTh col="gap">Temp Gap (°C)</SortTh>
                <SortTh col="battery">Battery (%)</SortTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} style={{ ...(idx % 2 === 0 ? styles.rowEven : styles.rowOdd), ...rowStyle(r) }}>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>{r.id}</td>
                  <td style={styles.td}>{r.timestamp ? r.timestamp.toLocaleString() : "-"}</td>
                  <td style={styles.td}>{r.valve ?? "-"}</td>
                  <td style={styles.td}>{r.target ?? "-"}</td>
                  <td style={styles.td}>{r.temp ?? "-"}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>
                    {r.gap != null ? r.gap.toFixed(2) : "-"}
                  </td>
                  <td style={styles.td}>{r.battery ?? "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} style={{ ...styles.td, color: "#666" }}>No heaters found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
    //background: "#f7f8fa",
  },
  header: {
    //flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem 2rem",
    borderBottom: "1px solid #ddd",
    background: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    margin: 0,
    fontSize: "1.5rem",
    textAlign: "center",
    flex: 1,
  },
  scrollArea: {
    flex: "1 1 auto",
    overflow: "auto",
    padding: "1rem 2rem 2rem",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    margin: "1rem 2rem",
  },
  search: {
    padding: "0.5rem 0.75rem",
    width: "100%",
    maxWidth: 360,
    fontSize: "1rem",
    borderRadius: "6px",
    border: "1px solid #ccc",
    background: "#fff",
  },
  toggleBtn: {
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "bold",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    boxShadow: "0 2px 8px rgba(217,83,79,0.1)",
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
  },
  th: {
    backgroundColor: "#f0f4f8",
    padding: "0.75rem",
    borderBottom: "1px solid #ddd",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "0.75rem",
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
    textAlign: "center",
  },
  rowEven: { backgroundColor: "#fff" },
  rowOdd: { backgroundColor: "#fafafa" },
  error: {
    color: "crimson",
    fontWeight: 600,
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#007BFF",
  },
};

export default HeaterOverview;
