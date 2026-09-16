"""
Small API serving mandi price predictions to the React frontend.

Endpoints:
  GET  /api/history?days=90         -> recent actual price history (for chart)
  POST /api/predict                 -> next-week predicted price range, given inputs

Run with:  python app.py
Then it's available at http://localhost:5000
"""

from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.joblib"
DATA_PATH = BASE_DIR / "masur_dal_features.csv"

app = Flask(__name__)
CORS(app)  # allows your React dev server (different port) to call this API

# Load the trained model once at startup
bundle = joblib.load(MODEL_PATH)
point_model = bundle["point_model"]
low_model = bundle["low_model"]
high_model = bundle["high_model"]
FEATURES = bundle["features"]

# Load historical data once, so /predict can auto-fill lag/rolling features
history_df = pd.read_csv(DATA_PATH, parse_dates=["Date"])
history_df = history_df.sort_values("Date").reset_index(drop=True)


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "model": str(MODEL_PATH.name)})


@app.route("/api/history", methods=["GET"])
def get_history():
    """Returns recent actual prices — feed this straight into your chart's 'actual' line."""
    days = int(request.args.get("days", 90))
    recent = history_df.tail(days)
    return jsonify([
        {"date": row["Date"].strftime("%Y-%m-%d"), "price": row["modal_price"]}
        for _, row in recent.iterrows()
    ])


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Body (JSON), all optional — anything not given is auto-filled from the
    latest known row in history, which is the normal case for a live app:

    {
      "modal_price": 8200,     // today's price
      "arrival_qty": 150       // today's arrival quantity — the main thing
                                // a mandi operator / API feed would update daily
    }
    """
    body = request.get_json(force=True, silent=True) or {}
    latest = history_df.iloc[-1]

    row = {
        "modal_price": body.get("modal_price", latest["modal_price"]),
        "price_lag1": latest["modal_price"],                     # yesterday = current "today" before this update
        "price_lag7": history_df.iloc[-7]["modal_price"],
        "price_avg30": history_df["modal_price"].tail(30).mean(),
        "arrival_qty": body.get("arrival_qty", latest["arrival_qty"]),
        "arrival_lag1": latest["arrival_qty"],
        "month": pd.Timestamp.now().month,
    }

    X_new = pd.DataFrame([row])[FEATURES]

    point_pred = float(point_model.predict(X_new)[0])
    low_pred = float(low_model.predict(X_new)[0])
    high_pred = float(high_model.predict(X_new)[0])

    return jsonify({
        "predicted_price": round(point_pred, 2),
        "predicted_low": round(low_pred, 2),
        "predicted_high": round(high_pred, 2),
        "horizon": "7 days",
        "inputs_used": row,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
