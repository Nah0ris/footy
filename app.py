"""
app.py
Flask backend — API routes only.
Data loading and model training happen once at startup.
"""

import os
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, render_template

from data_loader     import load_all_data, collect_shots, collect_shots_with_player, collect_squads
from models          import train_xg_model, train_xgot_model, predict_xg, predict_xgot
from utils           import (
    calculate_angle, calculate_distance, safe_float,
    GOAL_Y_MIN, GOAL_Y_MAX, GOAL_HEIGHT,
)
from match_predictor import validate_lineup, simulate_match, POSITION_ROLE

app = Flask(__name__, template_folder="templates", static_folder="static")

# ── Startup ────────────────────────────────────────────────────────────────
print("Loading World Cup 2022 data …")
df_match, df_matches = load_all_data()
df_shot              = collect_shots(df_match, df_matches, include_penalty=True)
df_shot_player       = collect_shots_with_player(df_match, df_matches)

print("Training models …")
xg_model   = train_xg_model(df_shot)
xgot_model = train_xgot_model(df_shot)

# Pre-compute xG / xGOT for every player shot (used by /api/player)
df_shot_player["our_xg"] = df_shot_player.apply(
    lambda r: predict_xg(xg_model, r["x"], r["y"]), axis=1
)
df_shot_player["our_xgot"] = df_shot_player.apply(
    lambda r: predict_xgot(xgot_model, r["end_y"], r["end_z"])
    if pd.notna(r.get("end_y")) else None,
    axis=1,
)

# Player summary table
player_summary = df_shot_player.groupby("player_name").agg(
    total_shots=("goal", "count"),
    total_goals=("goal", "sum"),
    total_xg   =("our_xg",   "sum"),
    total_xgot =("our_xgot", "sum"),
).reset_index()
player_summary["difference"] = (
    player_summary["total_goals"] - player_summary["total_xg"]
)

# Team summary table
team_summary = df_shot_player.groupby("team_name").agg(
    total_shots=("goal", "count"),
    total_goals=("goal", "sum"),
    total_xg   =("our_xg", "sum"),
).reset_index()
team_summary["difference"] = (
    team_summary["total_goals"] - team_summary["total_xg"]
)

# ── WC 2022 squad data ───────────────────────────────────────────────────
df_squads = collect_squads(df_match, df_matches)

# Load transfers.csv for market values (used as rating proxy)
_TRANSFERS_CSV = os.path.join(os.path.dirname(__file__), "transfers.csv")
if os.path.exists(_TRANSFERS_CSV):
    df_transfers = pd.read_csv(_TRANSFERS_CSV)
    # Keep latest market value per player
    _mv = (df_transfers.dropna(subset=["market_value_in_eur"])
           .sort_values("transfer_date", ascending=False)
           .drop_duplicates(subset=["player_name"], keep="first")
           [["player_name", "market_value_in_eur"]])
    df_squads = df_squads.merge(_mv, on="player_name", how="left")
else:
    df_squads["market_value_in_eur"] = None

# Convert market value to 1-99 rating (log scale)
_mv_vals = df_squads["market_value_in_eur"].dropna()
if len(_mv_vals) > 0:
    _log_min = np.log1p(_mv_vals.min())
    _log_max = np.log1p(_mv_vals.max())
    df_squads["rating"] = df_squads["market_value_in_eur"].apply(
        lambda v: int(50 + 49 * (np.log1p(v) - _log_min) / max(_log_max - _log_min, 1))
        if pd.notna(v) else 70
    )
else:
    df_squads["rating"] = 70

print("Ready!\n")


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# 1 · Shot xG from pitch position
@app.route("/api/xg", methods=["POST"])
def api_xg():
    data  = request.json
    x, y  = float(data["x"]), float(data["y"])
    xg    = predict_xg(xg_model, x, y)
    return jsonify({
        "xg":       safe_float(xg, 4),
        "xg_pct":   safe_float(xg * 100, 2),
        "angle":    safe_float(calculate_angle(x, y), 1),
        "distance": safe_float(calculate_distance(x, y), 1),
    })


# 2 · Shot xGOT from goal-frame position
@app.route("/api/xgot", methods=["POST"])
def api_xgot():
    data         = request.json
    end_y, end_z = float(data["end_y"]), float(data["end_z"])
    xgot         = predict_xgot(xgot_model, end_y, end_z)
    if xgot is None:
        return jsonify({"error": "Shot not on target"}), 400
    return jsonify({
        "xgot":     safe_float(xgot, 4),
        "xgot_pct": safe_float(xgot * 100, 2),
    })


# 3 · Player stats
@app.route("/api/player", methods=["GET"])
def api_player():
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"players": sorted(player_summary["player_name"].tolist())})

    row = player_summary[player_summary["player_name"] == name]
    if row.empty:
        return jsonify({"error": "Player not found"}), 404

    r      = row.iloc[0]
    pshots = df_shot_player[df_shot_player["player_name"] == name]
    on_target = pshots[
        (pshots["end_y"] >= GOAL_Y_MIN) & (pshots["end_y"] <= GOAL_Y_MAX) &
        (pshots["end_z"] <= GOAL_HEIGHT) & pshots["end_y"].notna()
    ]

    shots = []
    for _, s in pshots.iterrows():
        shots.append({
            "x":       safe_float(s["x"]),
            "y":       safe_float(s["y"]),
            "end_y":   safe_float(s["end_y"]) if pd.notna(s.get("end_y")) else None,
            "end_z":   safe_float(s["end_z"]) if pd.notna(s.get("end_z")) else None,
            "outcome": s["outcome_name"],
            "xg":      safe_float(s["our_xg"]),
            "xgot":    safe_float(s["our_xgot"]),
        })

    return jsonify({
        "player":          name,
        "total_shots":     int(r["total_shots"]),
        "total_goals":     int(r["total_goals"]),
        "total_xg":        safe_float(r["total_xg"], 2),
        "total_xgot":      safe_float(r["total_xgot"], 2),
        "difference":      safe_float(r["difference"], 2),
        "shots_on_target": int(len(on_target)),
        "shots":           shots,
    })


# 4 · Team leaderboard
@app.route("/api/teams", methods=["GET"])
def api_teams():
    sort  = request.args.get("sort", "difference")
    order = request.args.get("order", "desc") == "desc"
    df    = team_summary.sort_values(sort, ascending=not order).head(32)
    rows  = [
        {
            "team":        r["team_name"],
            "total_shots": int(r["total_shots"]),
            "total_goals": int(r["total_goals"]),
            "total_xg":    safe_float(r["total_xg"], 2),
            "difference":  safe_float(r["difference"], 2),
        }
        for _, r in df.iterrows()
    ]
    return jsonify({"teams": rows})


# 5 · Goal zone conversion rates
@app.route("/api/zones", methods=["GET"])
def api_zones():
    on_target = df_shot[
        (df_shot["end_y"] >= GOAL_Y_MIN) & (df_shot["end_y"] <= GOAL_Y_MAX) &
        (df_shot["end_z"] <= GOAL_HEIGHT) & df_shot["end_y"].notna()
    ].copy()

    zone_w = (GOAL_Y_MAX - GOAL_Y_MIN) / 3

    def classify(row):
        if   row["end_y"] < GOAL_Y_MIN + zone_w:      h = "left"
        elif row["end_y"] < GOAL_Y_MIN + 2 * zone_w:  h = "center"
        else:                                           h = "right"
        v = "bottom" if row["end_z"] < GOAL_HEIGHT / 2 else "top"
        return f"{v}_{h}"

    on_target["zone"] = on_target.apply(classify, axis=1)

    zones = {}
    for z in on_target["zone"].unique():
        zd    = on_target[on_target["zone"] == z]
        total = len(zd)
        goals = int(zd["goal"].sum())
        zones[z] = {
            "total":      total,
            "goals":      goals,
            "conversion": round(goals / total * 100, 1) if total else 0,
        }
    return jsonify({"zones": zones})


# 6 · Player search (WC 2022 squads)
@app.route("/api/fut_players", methods=["GET"])
def api_fut_players():
    q = request.args.get("q", "").strip().lower()
    if not q or len(q) < 2:
        return jsonify({"players": []})

    df = df_squads[df_squads["player_name"].str.lower().str.contains(q, na=False)]
    df = df.sort_values("rating", ascending=False).head(20)
    return jsonify({"players": _squad_to_list(df)})


# 7 · Match prediction
@app.route("/api/predict_match", methods=["POST"])
def api_predict_match():
    data = request.json
    home = data.get("home", [])
    away = data.get("away", [])

    ok_h, err_h = validate_lineup(home)
    if not ok_h:
        return jsonify({"error": f"Home team: {err_h}"}), 400

    ok_a, err_a = validate_lineup(away)
    if not ok_a:
        return jsonify({"error": f"Away team: {err_a}"}), 400

    result = simulate_match(home, away)
    return jsonify(result)


# 8 · Country list (WC 2022 teams)
@app.route("/api/countries", methods=["GET"])
def api_countries():
    countries = sorted(df_squads["team_name"].unique().tolist())
    return jsonify({"countries": countries})


# 9 · National squad
@app.route("/api/squad", methods=["GET"])
def api_squad():
    country = request.args.get("country", "").strip()
    if not country:
        return jsonify({"players": []})

    df = df_squads[df_squads["team_name"] == country].sort_values("rating", ascending=False)
    return jsonify({"players": _squad_to_list(df)})


def _squad_to_list(df):
    """Convert squad DataFrame rows to JSON-friendly dicts."""
    players = []
    for _, r in df.iterrows():
        players.append({
            "name":     r["player_name"],
            "position": r["role"],        # GK / DEF / MID / FWD
            "overall":  int(r["rating"]),
            "club":     r["team_name"],
            "image":    "",               # no images for StatsBomb data
            "shooting":   int(r["rating"]) if r["role"] == "FWD" else max(50, int(r["rating"]) - 10),
            "passing":    int(r["rating"]) if r["role"] == "MID" else max(50, int(r["rating"]) - 5),
            "defending":  int(r["rating"]) if r["role"] == "DEF" else max(40, int(r["rating"]) - 15),
            "pace":       int(r["rating"]),
            "dribbling":  int(r["rating"]),
            "physicality":int(r["rating"]),
        })
    return players


if __name__ == "__main__":
    app.run(debug=True, port=5050)