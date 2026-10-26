import { API_BASE } from "../config";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Fragment } from "react";
import { Info, CircleX } from "lucide-react";

function EnergyOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);


  // sorting state
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // expanded rows + AI data per row
  const [expanded, setExpanded] = useState({});   // { [id]: true/false }
  const [aiData, setAiData] = useState({});       // { [id]: any }
  const [aiLoading, setAiLoading] = useState({}); // { [id]: bool }
  const [aiError, setAiError] = useState({});     // { [id]: string|null }

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/energy`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setData(res.data || {});
      setError(null);
    } catch {
      setError("⚠️ Failed to fetch energy data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // to array + sorting
  const rows = useMemo(() => {
    const arr = Object.entries(data).map(([id, info]) => ({ id, ...info }));

    const compare = (a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let va = a?.[sortKey];
      let vb = b?.[sortKey];

      if (sortKey === "datetime") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();

      if (va == null && vb == null) return 0;
      if (va == null) return -1 * dir;
      if (vb == null) return 1 * dir;

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    };

    return arr.sort(compare);
  }, [data, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ label, keyName, width }) => (
    <th
      onClick={() => onSort(keyName)}
      style={{ ...styles.th, cursor: "pointer", width }}
      aria-sort={sortKey === keyName ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span style={styles.sortIcon}>
        {sortKey === keyName ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );

  const formatNumber = (n, digits = 2) =>
    typeof n === "number" && isFinite(n) ? n.toFixed(digits) : "—";
  const formatBool = (b) => (b === true ? "Yes" : b === false ? "No" : "—");
  const formatPhaseImbalance = (obj) => {
    if (!obj || !Object.keys(obj).length) return "—";
    return Object.entries(obj)
      .map(([ph, pct]) => `${ph}: ${pct}%`)
      .join(" · ");
  };

  // Expand row + POST full row to AI endpoint once
  const toggleExpand = async (row) => {
    setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }));

    if (!aiData[row.id] && !aiLoading[row.id] && !aiError[row.id]) {
      try {
        setAiLoading((p) => ({ ...p, [row.id]: true }));
        setAiError((p) => ({ ...p, [row.id]: null }));
        const token = sessionStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/energy/ai/${encodeURIComponent(row.id)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setAiData((p) => ({ ...p, [row.id]: res.data }));
      } catch (e) {
        setAiError((p) => ({ ...p, [row.id]: "Failed to fetch AI results" }));
      } finally {
        setAiLoading((p) => ({ ...p, [row.id]: false }));
      }
    }
  };

  return (
    <div style={styles.page}>
      {/* Sticky header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn} aria-label="Go back">
          ⬅ Back
        </button>
        <h2 style={styles.headerTitle}>⚡ Energy Meter Overview</h2>
      </div>

      {/* Scrollable content area */}
      <div style={styles.scrollArea}>
        {loading && <p>Loading data...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 72 }}>Details</th>
                  <SortHeader label="ID" keyName="id" width="260px" />
                  <SortHeader label="Name" keyName="name" width="230px" />
                  <SortHeader label="Location" keyName="location" width="180px" />
                  <SortHeader label="Datetime" keyName="datetime" width="190px" />
                  <SortHeader label="Active Power (kW)" keyName="total_active_power_kw" width="160px" />
                  <SortHeader label="Power Factor" keyName="power_factor" width="120px" />
                  <SortHeader label="Consumption (kWh)" keyName="consumption_kwh" width="160px" />
                  <SortHeader label="Cost" keyName="cost" width="110px" />
                  <SortHeader label="Max Voltage" keyName="max_voltage" width="100px" />
                  <SortHeader label="Min Voltage" keyName="min_voltage" width="100px" />
                  <SortHeader label="Reversed" keyName="reversed" width="110px" />
                  <SortHeader label="Missing" keyName="missing" width="110px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <Fragment key={r.id}>
                    <tr style={idx % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                      <td style={styles.tdCenter}>
                        <button
                          onClick={() => toggleExpand(r)}
                          style={{
                            ...styles.detailsBtn,
                            backgroundColor: expanded[r.id] ? "#dc3545" : "#28a745",
                          }}
                          title={expanded[r.id] ? "Hide details" : "Show details"}
                        >
                          {expanded[r.id] ? "−" : "+"}
                        </button>
                      </td>
                      <td style={styles.tdCenter} title={r.id}>{r.id}</td>
                      <td style={styles.tdCenter}>{r.name || "—"}</td>
                      <td style={styles.tdCenter}>{r.location || "—"}</td>
                      <td style={styles.tdCenter}>
                        {r.datetime ? new Date(r.datetime).toLocaleString() : "—"}
                      </td>
                      <td style={styles.tdCenter}>{formatNumber(r.total_active_power_kw, 3)}</td>
                      <td style={styles.tdCenter}>{formatNumber(r.power_factor, 3)}</td>
                      <td style={styles.tdCenter}>{formatNumber(r.consumption_kwh, 3)}</td>
                      <td style={styles.tdCenter}>
                        {typeof r.cost === "number" ? `${r.cost.toFixed(2)} €` : "—"}
                        {typeof r.tariff_rate === "number" && (
                          <span style={styles.subtle}> @ {r.tariff_rate} €/kWh</span>
                        )}
                      </td>
                      <td style={styles.tdCenter}>{formatNumber(r.max_voltage, 1)}</td>
                      <td style={styles.tdCenter}>{formatNumber(r.min_voltage, 1)}</td>
                      <td style={styles.tdCenter}>{formatBool(r.reversed)}</td>
                      <td style={styles.tdCenter}>{formatBool(r.missing)}</td>
                    </tr>

                    {expanded[r.id] && (
                      <tr>
                        <td style={styles.expandedCell} colSpan={15}>
                          {/* AI content area */}
                          {aiLoading[r.id] && <div style={styles.aiLoading}>Loading AI results…</div>}
                          {aiError[r.id] && <div style={styles.aiError}>{aiError[r.id]}</div>}
                          {!aiLoading[r.id] && !aiError[r.id] && aiData[r.id] && (
                            <div style={styles.aiBox}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <h4 style={{ margin: "0 0 8px" }}>LSTM Predictions</h4>
                                <button style={styles.infoButton} onClick={() => setShowInstructions(prev => !prev)}><Info /></button>
                              </div>
                              {/* INFO */}
                              {showInstructions && (
                                <div style={styles.modalOverlay} onClick={() => setShowInstructions(false)}>
                                  <div style={styles.modal} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                                      <h2>LSTM Info</h2>
                                      <button onClick={() => setShowInstructions(false)} style={styles.closeStatusButton}>
                                        <CircleX />
                                      </button>
                                    </div>

                                    <div style={{ marginTop: "1rem", lineHeight: 1.55 }}>
                                      <h3 style={{ margin: "0 0 8px" }}>What is LSTM forecasting?</h3>
                                      <p>
                                        An <strong>LSTM</strong> (Long Short-Term Memory) is a type of recurrent neural network that’s
                                        built for time-series. It “remembers” recent patterns (seasonality, trends, abrupt changes) and
                                        uses them to predict the next point(s) in the sequence.
                                      </p>

                                      <h4 style={{ margin: "12px 0 6px" }}>How we use it here</h4>
                                      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                                        <li>Inputs: recent consumption (and other contextual features) window per energy meter.</li>
                                        <li>Output: the next step <em>predicted_consumption</em>. We also compute a cost estimate using a tariff.</li>
                                        <li>Refresh: the model is retrained periodically; forecasts update as new data arrives.</li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div style={{ marginBottom: 8 }}>
                                <div><strong>Predicted Consumption:</strong> {formatNumber(aiData[r.id].predicted_consumption, 3)}</div>
                                <div><strong>Predicted Cost:</strong> {formatNumber(aiData[r.id].predicted_consumption * 0.15, 2)} € @ 0.15 €/kWh</div>
                              </div>
                            </div>
                          )}

                          {/* Raw phase details in expanded view */}
                          <div style={styles.aiBox}>
                            <h4 style={{ margin: "0 0 8px" }}>Phase Imbalance Details</h4>
                            {r.phase_imbalance_percent && Object.keys(r.phase_imbalance_percent).length ? (
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {Object.entries(r.phase_imbalance_percent).map(([ph, pct]) => (
                                  <li key={ph}><strong>{ph}</strong>: {pct}%</li>
                                ))}
                              </ul>
                            ) : (
                              <em style={{ color: "#6b7280" }}>No phase imbalance data</em>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td style={styles.tdCenter} colSpan={15}>No energy data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
    background: "#f9fafb",
  },
  header: {
    flex: "0 0 auto",
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
    fontSize: "1.6rem",
    color: "#0f172a",
    textAlign: "center",
    flex: 1,
  },
  scrollArea: {
    flex: "1 1 auto",
    overflow: "auto",
    padding: "1rem 2rem 2rem",
  },
  error: {
    color: "crimson",
    fontWeight: 500,
    marginBottom: "1rem",
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    color: "#007BFF",
  },
  tableWrap: {
    overflowX: "auto",
    background: "#fff",
    borderRadius: "1rem",
    boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: "1200px",
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#f1f5f9",
    textAlign: "center",
    fontWeight: 600,
    padding: "12px 14px",
    fontSize: "0.95rem",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
    zIndex: 1,
  },
  sortIcon: {
    marginLeft: 8,
    fontSize: "0.85em",
    opacity: 0.7,
  },
  rowEven: { backgroundColor: "#fff" },
  rowOdd: { backgroundColor: "#fafafa" },
  tdCenter: {
    padding: "12px 14px",
    borderBottom: "1px solid #f8fafc",
    color: "#111827",
    textAlign: "center",
    whiteSpace: "nowrap",
    maxWidth: 380,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  subtle: {
    marginLeft: 6,
    fontSize: "0.85em",
    color: "#6b7280",
  },
  detailsBtn: {
    border: "none",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
  },
  expandedCell: {
    padding: "14px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
  },
  aiBox: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 10,
  },
  aiLoading: {
    padding: "10px 12px",
    marginBottom: 10,
    background: "#fff8e1",
    border: "1px solid #ffe082",
    borderRadius: 8,
  },
  aiError: {
    padding: "10px 12px",
    marginBottom: 10,
    background: "#fdecea",
    border: "1px solid #f5c6cb",
    borderRadius: 8,
    color: "#b71c1c",
  },
  aiPre: {
    margin: 0,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  infoButton: { padding: '0.9rem 0.2rem', backgroundColor: 'transparent', color: '#007bff', border: 'none', borderRadius: '100%', cursor: 'pointer', fontSize: '1rem', marginLeft: '0.5rem' },
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
};

export default EnergyOverview;
