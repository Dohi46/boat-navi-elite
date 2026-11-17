"""Read-only historical evaluation of v13 GitHub daily snapshots.

Usage: python scripts/premium_backtest.py data/auto/2026-11-17.json
All metrics are hypothetical. No recommendations are published.
"""
import argparse
import json
from pathlib import Path
from scripts.premium_auto_adapter import convert

def evaluate(doc):
    adapted = convert(doc)
    races = doc["races"]
    baseline = {"races": 0, "hit_races": 0, "stake": 0, "payout": 0}
    skipped = {"races": 0, "reasons": {}}
    pending = 0
    for original, item in zip(races, adapted["assessments"]):
        if not isinstance(original, dict):
            continue
        skipped["races"] += 1
        for reason in item["reasons"]:
            skipped["reasons"][reason] = skipped["reasons"].get(reason, 0) + 1
        result = original.get("result")
        if not isinstance(result, dict) or not isinstance(result.get("winningCombinations"), list):
            pending += 1
            continue
        # Recalculate from original saved picks and official-like settled combinations,
        # never trust aggregate payout fields without reconciliation.
        winning = {str(w.get("combination")): w.get("amount") for w in result["winningCombinations"] if isinstance(w, dict)}
        stake = payout = 0
        for pick in original.get("picks", []):
            if not isinstance(pick, dict):
                continue
            amount = pick.get("stake")
            if type(amount) not in (int, float) or not 0 < amount < 1000000:
                continue
            stake += amount
            odds_payout = winning.get(pick.get("pick"))
            if type(odds_payout) in (int, float) and odds_payout >= 0:
                payout += amount * odds_payout / 100
        baseline["races"] += 1
        baseline["stake"] += stake
        baseline["payout"] += payout
        baseline["hit_races"] += int(payout > 0)
    stake = baseline["stake"]
    baseline["race_hit_rate_percent"] = round(100 * baseline["hit_races"] / baseline["races"], 2) if baseline["races"] else None
    baseline["return_rate_percent"] = round(100 * baseline["payout"] / stake, 2) if stake else None
    baseline["net"] = baseline["payout"] - stake
    return {"date": doc["date"], "engine": doc.get("engine"), "mode": "research_only",
            "baseline": baseline, "research_selector": {"review": 0, "skip": skipped["races"],
            "reason": "No calibrated probabilities and no timestamped pre-cutoff odds",
            "return_rate_percent": None}, "skipped_reasons": skipped["reasons"],
            "unsettled_races": pending,
            "limitations": ["Historical result is used only for evaluation, never selection.",
                            "A single date cannot establish out-of-sample performance.",
                            "No claim of profitable selection or calibrated win probability."]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshots", nargs="+", type=Path)
    args = parser.parse_args()
    for path in args.snapshots:
        doc = json.loads(path.read_text(encoding="utf-8"))
        print(json.dumps(evaluate(doc), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
