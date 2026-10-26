import asyncio
from collections import defaultdict
from typing import Any, List, Dict
from sklearn.ensemble import IsolationForest
import numpy as np

async def detect_anomalies(
    sensor_data: List[Any]
) -> List[Dict[str, Any]]:
    """
    Categorize raw sensor_data by sensor type and run anomaly detection per category.

    Args:
      sensor_data: list of tuples returned by your SQL query (SELECT * FROM sensors JOIN sensor_types).
      Each tuple's last element should be the sensor_type string.

    Returns:
      A flat list of dicts with anomaly status for each sensor, including specific anomalous_features.
    """
    # 1. Group by sensor type (assumes type is last element in tuple)
    sensors_by_type: Dict[str, List[Any]] = defaultdict(list)
    for row in sensor_data:
        sensor_type = row[-1]
        sensors_by_type[sensor_type].append(row)

    output: List[Dict[str, Any]] = []

    # 2. For each type, extract numeric features and detect anomalies
    for sensor_type, rows in sensors_by_type.items():
        # Collect numeric feature keys
        feature_keys = set()
        for row in rows:
            latest_data = row[4] or {}
            for k, v in latest_data.items():
                if isinstance(v, (int, float)):
                    feature_keys.add(k)
        feature_keys = sorted(feature_keys)

        # Build feature matrix and track per-sensor values
        X = []
        ids = []
        raw_vals = []
        for row in rows:
            sensor_id = row[0]
            latest_data = row[4] or {}
            vals = [latest_data.get(k, 0) for k in feature_keys]
            X.append(vals)
            ids.append(sensor_id)
            raw_vals.append({k: latest_data.get(k, 0) for k in feature_keys})

        if not X:
            continue

        X_arr = np.array(X, dtype=float)

        # Compute per-feature mean/std for anomaly explanation
        means = np.mean(X_arr, axis=0)
        stds = np.std(X_arr, axis=0)

        # Isolation Forest
        clf = IsolationForest(
            n_estimators=100,
            max_samples=min(len(X_arr), 256),
            contamination='auto',
            random_state=42
        )
        clf.fit(X_arr)
        scores = clf.decision_function(X_arr)
        labels = clf.predict(X_arr)

        # Map results back to sensors
        for idx, (sid, score, lbl) in enumerate(zip(ids, scores, labels)):
            val_map = raw_vals[idx]
            anomalous_features: List[str] = []
            status = 'green'

            # Domain-specific rules and statistical checks
            for j, k in enumerate(feature_keys):
                val = val_map[k]
                k_lower = k.lower()
                # ValvePosition and Battery must be within [0,100]
                if k_lower in ('valveposition', 'battery'):
                    if val < 0 or val > 100:
                        anomalous_features.append(k)
                        status = 'red'
                        continue
                # Statistical z-score check
                if stds[j] > 0:
                    z = (val - means[j]) / stds[j]
                    if abs(z) > 3:
                        anomalous_features.append(k)

            # Isolation Forest detection
            if lbl == -1:
                status = 'red'
            elif score < 0 and status == 'green':
                status = 'yellow'

            output.append({
                'id': sid,
                'type': sensor_type,
                'status': status,
                'score': float(score),
                'anomalous_features': anomalous_features
            })

    return output


def getStatus(status: str, anomaly_status: str):
    if status == "green" and anomaly_status == "green":
        return "green"
    elif status == "green" and anomaly_status == "yellow":
        return "yellow"
    elif status == "green" and anomaly_status == "red":
        return "red"
    elif status == "yellow" and anomaly_status == "green":
        return "yellow"
    elif status == "yellow" and anomaly_status == "yellow":
        return "yellow"
    elif status == "yellow" and anomaly_status == "red":
        return "red"
    elif status == "red":
        return "red"