"""
match_predictor.py
Simulates a match outcome based on two lineups of FUT22 player ratings.
Uses aggregate stats → expected goals → Poisson distribution.
"""

import math
from scipy.stats import poisson


# ── Position role mapping ──────────────────────────────────────────────────
# The data loader already simplifies StatsBomb positions to these four roles
POSITION_ROLE = {
    "GK":  "GK",
    "DEF": "DEF",
    "MID": "MID",
    "FWD": "FWD",
}

VALID_POSITIONS = set(POSITION_ROLE.keys())


def validate_lineup(players: list[dict]) -> tuple[bool, str]:
    """
    Validate an 11-player lineup dict list.
    Each player dict must have: { position, overall, shooting, defending, ... }
    Returns (is_valid, error_message).
    """
    if len(players) != 11:
        return False, f"Need exactly 11 players, got {len(players)}."

    gk_count  = sum(1 for p in players if p.get("position") == "GK")
    fwd_count = sum(1 for p in players if POSITION_ROLE.get(p.get("position")) == "FWD")
    def_count = sum(1 for p in players if POSITION_ROLE.get(p.get("position")) == "DEF")

    if gk_count != 1:
        return False, f"Lineup must have exactly 1 goalkeeper (found {gk_count})."
    if fwd_count < 1:
        return False, "Lineup must have at least 1 forward (ST / CF / LW / RW)."
    if def_count < 2:
        return False, "Lineup must have at least 2 defenders."

    return True, ""


def _team_attack_xg(players: list[dict]) -> float:
    """
    Estimate a team's expected goals per match from player ratings.
    Weighted average: FWDs contribute shooting, MIDs contribute passing.
    Scales to roughly realistic xG range (0.8 – 2.8).
    """
    fwd_shooting = [
        p.get("shooting", 70)
        for p in players
        if POSITION_ROLE.get(p.get("position")) == "FWD"
    ]
    mid_passing = [
        p.get("passing", 65)
        for p in players
        if POSITION_ROLE.get(p.get("position")) == "MID"
    ]

    avg_fwd = sum(fwd_shooting) / len(fwd_shooting) if fwd_shooting else 70
    avg_mid = sum(mid_passing)  / len(mid_passing)  if mid_passing  else 65

    raw = (avg_fwd * 0.65) + (avg_mid * 0.35)
    # Map [60..99] → [0.8..2.8]
    xg = 0.8 + (raw - 60) / (99 - 60) * 2.0
    return round(max(0.5, min(3.5, xg)), 3)


def _team_defense_factor(players: list[dict]) -> float:
    """
    Returns a 0.6–1.0 multiplier representing defensive quality.
    Lower = tighter defence (reduces opponent xG).
    """
    def_defending = [
        p.get("defending", 65)
        for p in players
        if POSITION_ROLE.get(p.get("position")) == "DEF"
    ]
    gk_overall = next(
        (p.get("overall", 75) for p in players if p.get("position") == "GK"), 75
    )

    avg_def = sum(def_defending) / len(def_defending) if def_defending else 65
    combined = (avg_def * 0.6) + (gk_overall * 0.4)
    # Map [60..99] → [1.0..0.6]  (high defence → lower multiplier → lower opp xG)
    factor = 1.0 - (combined - 60) / (99 - 60) * 0.4
    return round(max(0.6, min(1.0, factor)), 3)


def simulate_match(home_players: list[dict], away_players: list[dict]) -> dict:
    """
    Simulate a match. Returns:
      { home_xg, away_xg, probabilities: {home_win, draw, away_win},
        scoreline_grid (top 5 most likely scorelines) }
    """
    home_attack = _team_attack_xg(home_players)
    away_attack = _team_attack_xg(away_players)

    home_def_factor = _team_defense_factor(home_players)
    away_def_factor = _team_defense_factor(away_players)

    # Each team's effective xG is their attack modulated by opponent's defence
    home_xg = round(home_attack * away_def_factor, 3)
    away_xg = round(away_attack * home_def_factor, 3)

    # Poisson scoreline probabilities (cap at 5 goals each)
    MAX_GOALS = 6
    grid = {}
    home_win = draw = away_win = 0.0

    for h in range(MAX_GOALS):
        for a in range(MAX_GOALS):
            p = poisson.pmf(h, home_xg) * poisson.pmf(a, away_xg)
            grid[f"{h}-{a}"] = round(p, 5)
            if   h > a: home_win += p
            elif h == a: draw    += p
            else:        away_win += p

    # Top 5 most likely scorelines
    top5 = sorted(grid.items(), key=lambda x: -x[1])[:5]

    return {
        "home_xg": home_xg,
        "away_xg": away_xg,
        "home_win_pct": round(home_win * 100, 1),
        "draw_pct":     round(draw     * 100, 1),
        "away_win_pct": round(away_win * 100, 1),
        "top_scorelines": [{"score": s, "pct": round(p * 100, 1)} for s, p in top5],
    }
