"""Premium research-only race selector. Does not modify existing AI LAB.

Input is an explicit normalized list of race assessments; no real-money recommendations.
Run: python scripts/premium_ranker.py sample.json
"""
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

REQUIRED = ("venue", "race", "race_date", "probability", "odds", "odds_observed_at", "cutoff_at", "data_complete")

def assess(item):
    missing = [key for key in REQUIRED if key not in item]
    result = {"venue": item.get("venue"), "race": item.get("race"), "decision": "SKIP", "reasons": []}
    if missing:
        result["reasons"].append("missing: " + ", ".join(missing))
        return result
    if item["data_complete"] is not True:
        result["reasons"].append("incomplete source data")
        return result
    try:
        p, odds = float(item["probability"]), float(item["odds"])
        observed = datetime.fromisoformat(item["odds_observed_at"])
        cutoff = datetime.fromisoformat(item["cutoff_at"])
        race_day = str(item["race_date"])
        if not (0 < p < 1 and math.isfinite(p) and odds > 1 and math.isfinite(odds)):
            raise ValueError("invalid probability or odds")
        if observed.tzinfo is None or cutoff.tzinfo is None:
            raise ValueError("timezone required")
        if observed > cutoff or (cutoff - observed).total_seconds() > 600:
            raise ValueError("stale or post-cutoff odds")
        if cutoff.date().isoformat() != race_day:
            raise ValueError("date mismatch")
        if datetime.now(timezone.utc) >= cutoff.astimezone(timezone.utc):
            raise ValueError("race cutoff passed")
        expected_return = p * odds
        result["estimated_return_ratio"] = round(expected_return, 4)
        # Research threshold only; must be calibrated with out-of-sample testing.
        result["decision"] = "REVIEW" if expected_return >= 1.10 else "SKIP"
        result["reasons"].append("research threshold met" if result["decision"] == "REVIEW" else "insufficient estimated edge")
    except (TypeError, ValueError, OverflowError) as exc:
        result["reasons"].append("invalid input: " + str(exc))
    return result

def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python scripts/premium_ranker.py assessments.json")
    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit("expected a JSON array")
    print(json.dumps({"mode": "research_only", "assessments": [assess(x) for x in payload]}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
