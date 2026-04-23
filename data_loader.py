"""
data_loader.py
Loads StatsBomb World Cup 2022 event data.
Geometry helpers and model training have been moved to utils.py and models.py.
"""

import numpy as np
import pandas as pd
from mplsoccer import Sbopen
from utils import calculate_angle, calculate_distance


def load_all_data():
    """Download / cache all WC 2022 match events via StatsBomb open-data."""
    parser   = Sbopen()
    df_match = parser.match(competition_id=43, season_id=106)

    df_matches = {}
    for match_id in df_match["match_id"]:
        event, _, _, _ = parser.event(match_id)
        df_matches[match_id] = {"event": event}

    return df_match, df_matches


def collect_shots(df_match, df_matches, include_penalty=True):
    """Return a DataFrame of all shots across all matches."""
    features = [
        "x", "y", "outcome_name", "sub_type_name",
        "shot_statsbomb_xg", "end_y", "end_z",
    ]
    frames = []
    for match_id in df_match["match_id"]:
        ev   = df_matches[match_id]["event"]
        mask = (ev["type_name"] == "Shot") & (ev["period"] <= 4)
        if not include_penalty:
            mask &= ev["sub_type_name"] != "Penalty"
        frames.append(ev.loc[mask, [c for c in features if c in ev.columns]])

    df = pd.concat(frames, ignore_index=True)
    for col in features:
        if col not in df.columns:
            df[col] = np.nan

    df["angle"]    = df.apply(lambda r: calculate_angle(r["x"], r["y"]), axis=1)
    df["distance"] = df.apply(lambda r: calculate_distance(r["x"], r["y"]), axis=1)
    df["goal"]     = (df["outcome_name"] == "Goal").astype(int)
    return df


def collect_shots_with_player(df_match, df_matches):
    """Same as collect_shots but includes player_name and team_name columns."""
    features = [
        "player_name", "team_name",
        "x", "y", "outcome_name", "sub_type_name",
        "shot_statsbomb_xg", "end_y", "end_z",
    ]
    frames = []
    for match_id in df_match["match_id"]:
        ev   = df_matches[match_id]["event"]
        mask = (ev["type_name"] == "Shot") & (ev["period"] <= 4)
        frames.append(ev.loc[mask, [c for c in features if c in ev.columns]])

    df = pd.concat(frames, ignore_index=True)
    for col in features:
        if col not in df.columns:
            df[col] = np.nan

    df["angle"]    = df.apply(lambda r: calculate_angle(r["x"], r["y"]), axis=1)
    df["distance"] = df.apply(lambda r: calculate_distance(r["x"], r["y"]), axis=1)
    df["goal"]     = (df["outcome_name"] == "Goal").astype(int)
    return df


# ── StatsBomb position → simplified role ──────────────────────────────────
_POSITION_MAP = {
    "Goalkeeper":                "GK",
    "Right Back":               "DEF",
    "Right Center Back":        "DEF",
    "Center Back":              "DEF",
    "Left Center Back":         "DEF",
    "Left Back":                "DEF",
    "Right Wing Back":          "DEF",
    "Left Wing Back":           "DEF",
    "Right Defensive Midfield": "MID",
    "Left Defensive Midfield":  "MID",
    "Center Defensive Midfield":"MID",
    "Right Center Midfield":    "MID",
    "Center Midfield":          "MID",
    "Left Center Midfield":     "MID",
    "Right Midfield":           "MID",
    "Left Midfield":            "MID",
    "Center Attacking Midfield":"MID",
    "Right Attacking Midfield": "MID",
    "Left Attacking Midfield":  "MID",
    "Right Wing":               "FWD",
    "Left Wing":                "FWD",
    "Right Center Forward":     "FWD",
    "Left Center Forward":      "FWD",
    "Center Forward":           "FWD",
    "Striker":                  "FWD",
    "Secondary Striker":        "FWD",
}


def collect_squads(df_match, df_matches):
    """
    Extract every unique (player, team, position) from WC 2022 events.
    Returns a DataFrame with columns:
        player_name, team_name, position, role
    """
    rows = []
    for match_id in df_match["match_id"]:
        ev = df_matches[match_id]["event"]
        # Only events with player and team
        sub = ev[ev["player_name"].notna() & ev["team_name"].notna()]
        for _, r in sub[["player_name", "team_name", "position_name"]].drop_duplicates().iterrows():
            rows.append({
                "player_name":  r["player_name"],
                "team_name":    r["team_name"],
                "position_name": r.get("position_name", ""),
            })

    df = pd.DataFrame(rows).drop_duplicates(subset=["player_name", "team_name"])
    df["role"] = df["position_name"].map(_POSITION_MAP).fillna("MID")
    return df.sort_values(["team_name", "role", "player_name"]).reset_index(drop=True)

