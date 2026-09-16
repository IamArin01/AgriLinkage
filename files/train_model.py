"""
Train and save the mandi price prediction models.

Produces 3 models, saved together in one file:
  - point model   -> single best-estimate price for 7 days ahead
  - low model     -> 10th percentile (pessimistic) estimate
  - high model    -> 90th percentile (optimistic) estimate

Run this once (or whenever you get new data) to regenerate model.joblib.
"""

from pathlib import Path

import pandas as pd
import joblib
from sklearn.linear_model import LinearRegression, QuantileRegressor

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "masur_dal_features.csv"
MODEL_PATH = BASE_DIR / "model.joblib"

# ---- 1. Load your cleaned, feature-engineered data ----
df = pd.read_csv(DATA_PATH, parse_dates=["Date"])
df = df.sort_values("Date").reset_index(drop=True)

# ---- 2. Build the 7-day-ahead target ----
df["target_next_week"] = df["modal_price"].shift(-7)
df_model = df.dropna(subset=["target_next_week"]).reset_index(drop=True)

FEATURES = [
    "modal_price",     # today's price
    "price_lag1",      # yesterday's price
    "price_lag7",      # price a week ago
    "price_avg30",     # 30-day rolling average
    "arrival_qty",     # today's arrival volume
    "arrival_lag1",    # yesterday's arrival volume
    "month",           # seasonal indicator
]

X = df_model[FEATURES]
y = df_model["target_next_week"]

# ---- 3. Train on ALL available data (for the deployed/production model) ----
# (Train/test split is for evaluation only — see evaluate_model.py.
#  Once you trust the numbers, the real deployed model should learn from everything.)
point_model = LinearRegression().fit(X, y)
low_model = QuantileRegressor(quantile=0.1, alpha=0, solver="highs").fit(X, y)
high_model = QuantileRegressor(quantile=0.9, alpha=0, solver="highs").fit(X, y)

# ---- 4. Save everything needed to make predictions later ----
joblib.dump(
    {
        "point_model": point_model,
        "low_model": low_model,
        "high_model": high_model,
        "features": FEATURES,
    },
    MODEL_PATH,
)

print(f"Saved model to {MODEL_PATH}")
print(f"Trained on {len(X)} rows, features: {FEATURES}")
