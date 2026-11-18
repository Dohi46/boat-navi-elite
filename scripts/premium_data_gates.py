"""Research-only input gates for seven premium capabilities. No purchase recommendations."""
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
import math

JST = ZoneInfo("Asia/Tokyo")

def timestamp(value):
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None

def before_cutoff(value, cutoff, max_age_seconds=None):
    observed, end = timestamp(value), timestamp(cutoff)
    if not observed or not end or observed > end:
        return False
    return max_age_seconds is None or (end - observed).total_seconds() <= max_age_seconds

def number(value, low=None, high=None):
    if type(value) not in (int, float) or not math.isfinite(value):
        return False
    return (low is None or value >= low) and (high is None or value <= high)

def odds_gate(record, cutoff):
    """Requires timestamped per-ticket decimal odds; never uses settlement odds."""
    if not isinstance(record, dict) or not before_cutoff(record.get("observed_at"), cutoff, 600):
        return {"valid": False, "reason": "missing, stale or post-cutoff odds"}
    if not isinstance(record.get("combination"), str) or not number(record.get("decimal_odds"), 1.01):
        return {"valid": False, "reason": "invalid ticket odds"}
    return {"valid": True, "reason": None}

def weather_gate(record, cutoff):
    if not isinstance(record, dict) or not before_cutoff(record.get("observed_at"), cutoff, 1800):
        return {"valid": False, "reason": "missing, stale or post-cutoff weather"}
    if not isinstance(record.get("source"), str) or not record["source"].strip():
        return {"valid": False, "reason": "weather provenance missing"}
    if not (number(record.get("wind_speed_mps"), 0, 60) and
            number(record.get("wave_height_cm"), 0, 500) and
            number(record.get("wind_direction_deg"), 0, 360)):
        return {"valid": False, "reason": "invalid weather measurement"}
    return {"valid": True, "reason": None}

def exhibition_gate(record, cutoff):
    if not isinstance(record, dict) or not before_cutoff(record.get("observed_at"), cutoff, 1800):
        return {"valid": False, "reason": "missing, stale or post-cutoff exhibition"}
    if not isinstance(record.get("source"), str) or not record["source"].strip():
        return {"valid": False, "reason": "exhibition provenance missing"}
    lanes = record.get("lanes")
    if not isinstance(lanes, list) or len(lanes) != 6:
        return {"valid": False, "reason": "six lanes required"}
    ids = [lane.get("lane") for lane in lanes if isinstance(lane, dict)]
    if sorted(ids) != list(range(1, 7)):
        return {"valid": False, "reason": "invalid lane assignments"}
    for lane in lanes:
        if not number(lane.get("exhibition_time"), 4, 10) or not number(lane.get("start_timing"), -1, 2):
            return {"valid": False, "reason": "invalid exhibition data"}
    return {"valid": True, "reason": None}

def calibration_gate(record):
    """A relative v13 score is explicitly NOT a probability."""
    if not isinstance(record, dict) or record.get("model_kind") != "calibrated_probability":
        return {"valid": False, "reason": "uncalibrated probability"}
    if not record.get("out_of_sample_verified") or not number(record.get("probability"), 0, 1):
        return {"valid": False, "reason": "unverified probability"}
    if not isinstance(record.get("model_version"), str) or not record["model_version"].strip():
        return {"valid": False, "reason": "missing model version"}
    return {"valid": True, "reason": None}

def skip_assessment(odds, weather, exhibition, calibration, cutoff, risk=None):
    gates = {"odds": odds_gate(odds, cutoff),
             "weather": weather_gate(weather, cutoff),
             "exhibition": exhibition_gate(exhibition, cutoff),
             "calibration": calibration_gate(calibration)}
    reasons = [name + ": " + gate["reason"] for name, gate in gates.items() if not gate["valid"]]
    if risk is None or risk.get("enough_holdout_for_review") is not True:
        reasons.append("risk: insufficient independent holdout review")
    elif risk.get("high_risk") is not False:
        reasons.append("risk: not cleared")
    # Deliberately no live purchase/review decision until complete independent validation.
    return {"mode": "research_only", "decision": "SKIP", "gates": gates,
            "reasons": reasons or ["research-only: live recommendations disabled"]}

def venue_report(rows):
    """Historical settled race metrics only; never use for same-day selection."""
    grouped = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("venue"), int):
            continue
        if not (1 <= row["venue"] <= 24 and number(row.get("stake"), 0) and
                number(row.get("payout"), 0)):
            continue
        group = grouped.setdefault(row["venue"], {"races": 0, "stake": 0, "payout": 0})
        group["races"] += 1
        group["stake"] += row["stake"]
        group["payout"] += row["payout"]
    return {str(k): {**v, "return_rate_percent": round(100*v["payout"]/v["stake"], 2) if v["stake"] else None,
                     "sample_sufficient": v["races"] >= 100}
            for k, v in sorted(grouped.items())}

def audit_entry(record):
    """Canonical digest enables later tamper detection when digest is kept separately."""
    if not isinstance(record, dict):
        raise ValueError("audit record must be an object")
    required = ("race_date", "venue", "race", "prediction_captured_at", "cutoff_at",
                "picks", "source_version")
    if any(key not in record for key in required):
        raise ValueError("missing audit fields")
    if not before_cutoff(record["prediction_captured_at"], record["cutoff_at"]):
        raise ValueError("post-cutoff or unverified prediction")
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return {"sha256": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
            "canonical_record": record, "mode": "research_only"}
