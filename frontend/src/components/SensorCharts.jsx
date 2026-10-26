import { API_BASE } from "../config";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from "react";
import axios from "axios";

function SensorChart({ sensorId }) {
  const [data, setData] = useState([]);
  const [keys, setKeys] = useState([]);
  const [slot1Key, setSlot1Key] = useState("");
  const [slot2Key, setSlot2Key] = useState("");

  const styles = {
    dropdown: {
      padding: '0.4rem',
      borderRadius: '5px',
      border: '1px solid #ccc'
    }
  };

  useEffect(() => {
    if (!sensorId) return;
    const token = sessionStorage.getItem("token");
    axios.get(`${API_BASE}/sensor/history/${sensorId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => {
        const processed = res.data.map(entry => ({
          timestamp: new Date(entry.timestamp).toLocaleTimeString(),
          ...entry.data,
        }));
        setData(processed);

        const dataKeys = Object.keys(processed[0] || {}).filter(k => k !== "timestamp");
        setKeys(dataKeys);
        if (dataKeys.length > 0) {
          setSlot1Key(dataKeys[0]);
          setSlot2Key(dataKeys.length > 1 ? dataKeys[1] : dataKeys[0]);
        }
      })
      .catch(err => console.error("Failed to fetch history:", err));
  }, [sensorId]);

  if (!data.length) return <p>No historical data available.</p>;

  const renderChart = (selectedKey) => (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey={selectedKey}
          stroke="#10a01cff"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div>
      <h3>Data Charts</h3>
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>

        {/* Slot 1 */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <label>
            Select Metric for Slot 1:{" "}
            <select
              style={styles.dropdown}
              value={slot1Key}
              onChange={(e) => setSlot1Key(e.target.value)}
            >
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {slot1Key && renderChart(slot1Key)}
        </div>

        {/* Slot 2 */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <label>
            Select Metric for Slot 2:{" "}
            <select
              style={styles.dropdown}
              value={slot2Key}
              onChange={(e) => setSlot2Key(e.target.value)}
            >
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          {slot2Key && renderChart(slot2Key)}
        </div>

      </div>
    </div>
  );
}

export default SensorChart;
