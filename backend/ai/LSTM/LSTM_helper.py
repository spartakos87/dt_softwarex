from typing import Optional, List
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
from pathlib import Path

# ------------------------------
# Config (must match training)
# ------------------------------
SEQLEN = 20
NUM_LAYERS = 2
HIDDEN_SIZE = 256
DROPOUT = 0.2

# ---- paths to model artifacts (match your training layout) ----
BASE_DIR   = Path(__file__).resolve().parent
SCALER_PATH   = BASE_DIR / "scaler.pkl"
IMPUTER_PATH  = BASE_DIR / "imputer.pkl"
FEATURES_PATH = BASE_DIR / "feature_columns.pkl"
WEIGHTS_PATH  = BASE_DIR / "best_model.pth"

# ------------------------------
# Load artifacts
# ------------------------------
try:
    scaler = joblib.load(SCALER_PATH)
except Exception:
    scaler = None
try:
    feature_columns = joblib.load(FEATURES_PATH)
except Exception:
    feature_columns = None
try:
    imputer = joblib.load(IMPUTER_PATH)
except Exception:
    imputer = None

if scaler is None:
    raise RuntimeError("Missing scaler.pkl; cannot run inference.")
if feature_columns is None:
    raise RuntimeError("Missing feature_columns.pkl; cannot align features.")
if imputer is None:
    raise RuntimeError("Missing imputer.pkl; cannot run inference.")
if "consumption" not in feature_columns:
    raise RuntimeError("Training features must include 'consumption' column.")

CONSUMPTION_COL_IDX = feature_columns.index("consumption")

# ------------------------------
# Model
# ------------------------------
class LSTMModel(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers=NUM_LAYERS, dropout=DROPOUT):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        self.fc = nn.Linear(hidden_size, 1)
    def forward(self, x):
        out, _ = self.lstm(x)      # [B, T, H]
        return self.fc(out[:, -1]) # [B, 1]

_model: Optional["LSTMModel"] = None
def _ensure_model(input_size: int):
    global _model
    if _model is None:
        m = LSTMModel(input_size=input_size, hidden_size=HIDDEN_SIZE,
                      num_layers=NUM_LAYERS, dropout=DROPOUT)
        state = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=True)
        m.load_state_dict(state)
        m.eval()
        _model = m

# ------------------------------
# Preprocessing
# ------------------------------
def _expand_db_rows_to_api_df(rows: list, sensor_id: str) -> pd.DataFrame:
    """
    rows: list of tuples (data_json: dict, timestamp: datetime)
    Returns a DataFrame with columns expected by map_incoming_to_training().
    """
    recs = []
    for data, ts in rows:
        # voltages
        volts = [data.get("a_voltage"), data.get("b_voltage"), data.get("c_voltage")]
        v_vals = [v for v in volts if v is not None]
        max_v = max(v_vals) if v_vals else None
        min_v = min(v_vals) if v_vals else None

        # pf: mean of available phase PFs
        pfs = [data.get("a_pf"), data.get("b_pf"), data.get("c_pf")]
        pf_vals = [p for p in pfs if p is not None]
        mean_pf = float(np.mean(pf_vals)) if pf_vals else None

        recs.append({
            "ID": sensor_id,
            "Datetime": pd.to_datetime(ts),
            # map to "Active Power" expected name used in training/inference mapping
            "Active Power": data.get("total_act_power"),
            "Power Factor": mean_pf,
            "Consumption Cost": 0.15,          # if you have it, put it here
            "Max Voltage": max_v,
            "Min Voltage": min_v,
            "Reversed": 0,
            "Missing": 0,
            "Location": None,
            "Name": None
        })
    return pd.DataFrame.from_records(recs)

def map_incoming_to_training(df_in: pd.DataFrame) -> pd.DataFrame:
    """
    Map API/DB schema to training schema exactly used when you fit the scaler/feature_columns.
    Expected training columns (example):
      datetime, consumption, cost, max_voltage, min_voltage, purpose, reversed, tariff_id, missing
    """
    df = pd.DataFrame()
    df["datetime"]    = pd.to_datetime(df_in["Datetime"])
    df["consumption"] = pd.to_numeric(df_in.get("Active Power"), errors="coerce")
    df["cost"]        = pd.to_numeric(df_in.get("Consumption Cost"), errors="coerce")
    df["max_voltage"] = pd.to_numeric(df_in.get("Max Voltage"), errors="coerce")
    df["min_voltage"] = pd.to_numeric(df_in.get("Min Voltage"), errors="coerce")
    # stable categorical placeholders; replace with your real categories if available
    df["purpose"]     = "other"
    df["reversed"]    = pd.to_numeric(df_in.get("Reversed", 0), errors="coerce").fillna(0).astype(int)
    df["tariff_id"]   = "0"
    df["missing"]     = pd.to_numeric(df_in.get("Missing", 0), errors="coerce").fillna(0).astype(int)
    return df

def one_hot_and_align(df: pd.DataFrame) -> pd.DataFrame:
    dfd = pd.get_dummies(df, columns=["purpose", "tariff_id"], drop_first=False)
    # Ensure strict alignment with training-time columns
    for col in feature_columns:
        if col not in dfd.columns:
            dfd[col] = 0
    dfd = dfd[feature_columns]
    return dfd

def impute_then_scale(arr: np.ndarray) -> np.ndarray:
    if imputer is not None:
        arr = imputer.transform(arr)
    else:
        col_means = np.nanmean(arr, axis=0)
        inds = np.where(np.isnan(arr))
        arr[inds] = np.take(col_means, inds[1])
    return scaler.transform(arr)

def _inverse_consumption_with_template(y_scaled: np.ndarray, last_scaled_row: np.ndarray) -> float:
    """
    If 'consumption' was scaled together with X using the same scaler,
    replace its scaled value in the last feature row and inverse-transform.
    """
    templ = last_scaled_row.copy()
    templ[CONSUMPTION_COL_IDX] = float(y_scaled.item())
    inv = scaler.inverse_transform(templ.reshape(1, -1))
    return float(inv[0, CONSUMPTION_COL_IDX])

# ------------------------------
# Public entry: predict from last 20 rows (DB raw -> prediction)
# ------------------------------
def predict_next_from_db_rows(sensor_id: str, rows: list):
    """
    rows: list of (data_json: dict, timestamp: datetime), newest->oldest or oldest->newest (we sort)
    """
    if not rows:
        return {"error": "No history rows provided."}

    # Build a uniform DataFrame and sort ascending by time
    df_hist = _expand_db_rows_to_api_df(rows, sensor_id)
    df_hist = df_hist.sort_values("Datetime")
    if len(df_hist) < SEQLEN:
        return {"error": f"Need at least {SEQLEN} rows; have {len(df_hist)}."}

    # Keep only the last SEQLEN points
    df_hist = df_hist.tail(SEQLEN)

    # Map to training schema, one-hot, align
    df_mapped = map_incoming_to_training(df_hist)
    feat_df = df_mapped.drop(columns=["datetime", "missing"])
    feat_df = one_hot_and_align(pd.concat([df_mapped[["datetime","missing"]], feat_df], axis=1))
    X_raw = feat_df.values.astype(float)

    # Scale (after imputation)
    X_scaled = impute_then_scale(X_raw)

    # Build [1, SEQLEN, F]
    seq = X_scaled[-SEQLEN:, :]     # [SEQLEN, F]
    n_features = seq.shape[1]
    _ensure_model(n_features)
    x = torch.tensor(seq, dtype=torch.float32).unsqueeze(0)  # [1, SEQLEN, F]

    with torch.no_grad():
        y_scaled = _model(x).cpu().numpy().reshape(1)

    # Inverse to original units
    y_next = _inverse_consumption_with_template(y_scaled, last_scaled_row=seq[-1])

    # Infer next timestamp from history cadence
    times = df_mapped["datetime"].sort_values().tail(SEQLEN)
    if len(times) >= 2:
        diffs = times.diff().dropna()
        step = diffs.mode().iloc[0] if not diffs.empty else pd.Timedelta(minutes=15)
    else:
        step = pd.Timedelta(minutes=15)
    next_ts = (times.iloc[-1] + step).isoformat()

    return {
        "id": sensor_id,
        "next_timestamp": next_ts,
        "predicted_consumption": y_next
    }
