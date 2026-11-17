"""Multi-day, chronological, read-only selection research for v13 snapshots.

Example:
 python scripts/premium_selection_study.py data/auto/2026-11-*.json --train-end 2026-11-15
No data is published or written. Results are hypothetical and descriptive.
"""
import argparse
import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

def finite_number(x):
    return type(x) in (int, float) and math.isfinite(x)

def pre_cutoff(row, day):
    try:
        if row.get("raceDate") != day or row.get("predictionPhase") != "before":
            return False
        cutoff = datetime.strptime(row["cutoff"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=JST)
        captured = datetime.fromisoformat(row["capturedAt"].replace("Z", "+00:00"))
        return captured.tzinfo is not None and captured < cutoff
    except (KeyError, TypeError, ValueError):
        return False

def extract(doc):
    day = doc.get("date")
    if not isinstance(day, str) or not isinstance(doc.get("races"), list):
        raise ValueError("invalid daily snapshot")
    out = []
    for r in doc["races"]:
        if not isinstance(r, dict) or not pre_cutoff(r, day):
            continue
        picks = r.get("picks")
        if not isinstance(picks, list) or not picks:
            continue
        clean = [p for p in picks if isinstance(p, dict) and
                 isinstance(p.get("pick"), str) and
                 finite_number(p.get("stake")) and 0 < p["stake"] <= 100000]
        if not clean:
            continue
        # Snapshot contains relative v13 scores, NOT calibrated probabilities.
        top = clean[0]
        score = top.get("probability")
        if not finite_number(score):
            score = None
        features = r.get("features") or {}
        first_lane = features.get("1") if isinstance(features, dict) else None
        motor = first_lane.get("motor_top_2_percent") if isinstance(first_lane, dict) else None
        if not finite_number(motor):
            motor = None
        result = r.get("result")
        winning = None
        if isinstance(result, dict) and isinstance(result.get("winningCombinations"), list):
            winning = {w["combination"]: w["amount"] for w in result["winningCombinations"]
                       if isinstance(w, dict) and isinstance(w.get("combination"), str)
                       and finite_number(w.get("amount")) and w["amount"] >= 0}
        stake = sum(p["stake"] for p in clean)
        payout = sum(p["stake"] * winning[p["pick"]] / 100 for p in clean
                     if winning is not None and p["pick"] in winning)
        out.append({"date": day, "venue": r.get("venue"), "race": r.get("race"),
                    "top_score": score, "top_first_lane": top["pick"].startswith("1-"),
                    "lane1_motor": motor, "exhibition_count": r.get("exhibitionCount"),
                    "stake": stake, "payout": payout if winning is not None else None})
    return out

def metrics(rows):
    settled = [r for r in rows if r["payout"] is not None]
    stake = sum(r["stake"] for r in settled)
    payout = sum(r["payout"] for r in settled)
    return {"selected_races": len(rows), "settled_races": len(settled),
            "pending_races": len(rows)-len(settled),
            "hit_races": sum(r["payout"] > 0 for r in settled),
            "stake": stake, "payout": payout, "net": payout-stake,
            "hit_rate_percent": round(100*sum(r["payout"] > 0 for r in settled)/len(settled),2) if settled else None,
            "return_rate_percent": round(100*payout/stake,2) if stake else None}

# Conditions are fixed before evaluation; no result-based threshold fitting.
CONDITIONS = {
    "all": lambda r: True,
    "top_pick_starts_lane1": lambda r: r["top_first_lane"],
    "lane1_motor_at_least_40": lambda r: r["lane1_motor"] is not None and r["lane1_motor"] >= 40,
    "exhibition_at_least_6": lambda r: finite_number(r["exhibition_count"]) and r["exhibition_count"] >= 6,
    "top_relative_score_at_least_0_015": lambda r: r["top_score"] is not None and r["top_score"] >= .015,
}

def study(docs, train_end):
    days = {}
    for doc in docs:
        day = doc.get("date")
        if day in days:
            raise ValueError("duplicate date: " + str(day))
        datetime.strptime(day, "%Y-%m-%d")
        days[day] = doc
    rows = [r for day in sorted(days) for r in extract(days[day])]
    train = [r for r in rows if r["date"] <= train_end]
    holdout = [r for r in rows if r["date"] > train_end]
    results = {}
    for name, predicate in CONDITIONS.items():
        results[name] = {"train": metrics([r for r in train if predicate(r)]),
                         "holdout": metrics([r for r in holdout if predicate(r)])}
    return {"mode": "research_only", "train_end": train_end,
            "train_days": sorted(d for d in days if d <= train_end),
            "holdout_days": sorted(d for d in days if d > train_end),
            "conditions": results,
            "weather_status": "unavailable: no verified pre-cutoff weather snapshots joined",
            "warning": "Descriptive, not predictive. Relative v13 scores are not calibrated probabilities. No paid picks."}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("snapshots", nargs="+", type=Path)
    p.add_argument("--train-end", required=True, help="YYYY-MM-DD")
    args = p.parse_args()
    datetime.strptime(args.train_end, "%Y-%m-%d")
    docs = [json.loads(path.read_text(encoding="utf-8")) for path in args.snapshots]
    print(json.dumps(study(docs, args.train_end), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
