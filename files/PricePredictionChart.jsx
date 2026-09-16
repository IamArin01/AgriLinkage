import { useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Point this at wherever your Flask API is running.
// Local dev: http://localhost:5000  |  Deployed: your backend's real URL.
const API_BASE = "http://localhost:5000";

export default function PricePredictionChart() {
  const [history, setHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [arrivalQty, setArrivalQty] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load recent actual price history on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/history?days=90`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load price history. Is the API running?");
        setLoading(false);
      });
  }, []);

  // Ask the model for a next-week prediction.
  // arrival_qty is the main "what-if" input a user/operator would adjust.
  const getPrediction = () => {
    setError(null);
    const body = arrivalQty ? { arrival_qty: Number(arrivalQty) } : {};

    fetch(`${API_BASE}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => setPrediction(data))
      .catch(() => setError("Prediction request failed."));
  };

  // Merge history + the new predicted point into one array recharts can plot.
  // The predicted point gets its own key so it renders as a separate
  // marker/band rather than continuing the "actual" line.
  const chartData = [...history];
  if (prediction) {
    const lastDate = history.length
      ? new Date(history[history.length - 1].date)
      : new Date();
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + 7);

    chartData.push({
      date: futureDate.toISOString().split("T")[0],
      predicted_low: prediction.predicted_low,
      predicted_high: prediction.predicted_high,
      predicted_price: prediction.predicted_price,
    });
  }

  if (loading) return <div>Loading price history...</div>;

  return (
    <div style={{ width: "100%", padding: "1rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>
        Masur Dal (Mumbai) — Price Trend & Next-Week Forecast
      </h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="number"
          placeholder="Today's arrival qty (optional)"
          value={arrivalQty}
          onChange={(e) => setArrivalQty(e.target.value)}
          style={{ padding: "0.4rem", border: "1px solid #ccc", borderRadius: "4px" }}
        />
        <button
          onClick={getPrediction}
          style={{
            padding: "0.4rem 1rem",
            background: "#2e7d32",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Predict Next Week
        </button>
      </div>

      {prediction && (
        <p style={{ marginBottom: "1rem" }}>
          Predicted range in 7 days:{" "}
          <strong>
            ₹{prediction.predicted_low} – ₹{prediction.predicted_high}
          </strong>{" "}
          per quintal (best estimate: ₹{prediction.predicted_price})
        </p>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Legend />

          {/* Actual historical price */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#1976d2"
            name="Actual Price"
            dot={false}
            connectNulls
          />

          {/* Predicted range, shown as a shaded band on the future point */}
          <Area
            type="monotone"
            dataKey="predicted_high"
            stroke="none"
            fill="#a5d6a7"
            fillOpacity={0.5}
            name="Predicted High"
          />
          <Area
            type="monotone"
            dataKey="predicted_low"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
            name="Predicted Low"
          />
          <Line
            type="monotone"
            dataKey="predicted_price"
            stroke="#2e7d32"
            strokeDasharray="5 5"
            name="Predicted (best estimate)"
            dot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
