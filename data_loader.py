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
