"""
utils.py
Pitch geometry helpers and shared constants (StatsBomb 120×80 coordinate system).
"""

import math
import numpy as np

# ── Pitch constants ────────────────────────────────────────────────────────
GOAL_LEFT     = [120, 44]
GOAL_RIGHT    = [120, 36]
GOAL_CENTER_Y = 40.0
GOAL_HEIGHT   = 2.44       # metres (FIFA standard)
GOAL_Y_MIN    = 36.0
GOAL_Y_MAX    = 44.0


def calculate_angle(x, y):
    """Shooting angle subtended by the goal posts (degrees)."""
    v0    = np.array(GOAL_LEFT)  - np.array([x, y])
    v1    = np.array(GOAL_RIGHT) - np.array([x, y])
    angle = np.arctan2(np.linalg.det([v0, v1]), np.dot(v0, v1))
    return float(abs(np.degrees(angle)))


def calculate_distance(x, y):
    """Distance from shot position to the nearest goal-line point (yards)."""
    x_dist = 120 - x
    y_dist = 0.0
    if y < GOAL_Y_MIN:
        y_dist = GOAL_Y_MIN - y
    elif y > GOAL_Y_MAX:
        y_dist = y - GOAL_Y_MAX
    return float(math.sqrt(x_dist ** 2 + y_dist ** 2))


def safe_float(v, digits=4):
    """Return rounded float or None for NaN / None values."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return round(float(v), digits)
