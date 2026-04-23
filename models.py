"""
models.py
xG and xGOT model training and prediction.
Uses logistic regression on StatsBomb shot data.
"""

from sklearn.linear_model import LogisticRegression
from utils import (
    calculate_angle, calculate_distance,
    GOAL_CENTER_Y, GOAL_HEIGHT, GOAL_Y_MIN, GOAL_Y_MAX,
)


def train_xg_model(df_shot):
    """
    xG model: probability of a shot becoming a goal,
    based on angle (degrees) and distance (yards) only.
    """
    X     = df_shot[["angle", "distance"]]
    y     = df_shot["goal"]
    model = LogisticRegression(max_iter=1000)
    model.fit(X, y)
    return model


def train_xgot_model(df_shot):
    """
    xGOT model: probability of a goal given the shot is on target.
    Features: distance from goal-centre horizontally and vertically.
    Only trains on shots whose end position is within the goal frame.
    """
    on_target = df_shot[
        (df_shot["end_y"] >= GOAL_Y_MIN) &
        (df_shot["end_y"] <= GOAL_Y_MAX) &
        (df_shot["end_z"] <= GOAL_HEIGHT) &
        df_shot["end_y"].notna() &
        df_shot["end_z"].notna()
    ].copy()

    half_h = GOAL_HEIGHT / 2
    on_target["end_y_center"] = (GOAL_CENTER_Y - on_target["end_y"]).abs()
    on_target["end_z_center"] = (half_h - on_target["end_z"]).abs()

    X     = on_target[["end_y_center", "end_z_center"]]
    y     = on_target["goal"]
    model = LogisticRegression(max_iter=1000)
    model.fit(X, y)
    return model


def predict_xg(model, x, y):
    """Return xG probability for a shot taken from (x, y)."""
    angle    = calculate_angle(x, y)
    distance = calculate_distance(x, y)
    return float(model.predict_proba([[angle, distance]])[0, 1])


def predict_xgot(model, end_y, end_z):
    """
    Return xGOT probability for a shot aimed at (end_y, end_z) in the goal frame.
    Returns None if the shot is not on target.
    """
    if end_y is None or end_z is None:
        return None
    if not (GOAL_Y_MIN <= end_y <= GOAL_Y_MAX and 0 <= end_z <= GOAL_HEIGHT):
        return None
    half_h = GOAL_HEIGHT / 2
    ey = abs(GOAL_CENTER_Y - end_y)
    ez = abs(half_h - end_z)
    return float(model.predict_proba([[ey, ez]])[0, 1])
