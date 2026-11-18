"""Walk-forward descriptive research with strictly earlier training dates.

Example:
 python scripts/premium_walkforward.py data/auto/*.json --min-train-days 14
Never publishes picks; historical results are used for evaluation only.
"""
import argparse
import json
from datetime import date
from pathlib import Path
try:
    from scripts.premium_selection_study import extract, metrics, CONDITIONS
except ModuleNotFoundError:
    from premium_selection_study import extract, metrics, CONDITIONS

def walkforward(docs, min_train_days=14):
    if min_train_days < 1:
        raise ValueError("min_train_days must be positive")
    days = {}
    for doc in docs:
        day = doc.get("date")
        if not isinstance(day, str) or day in days:
            raise ValueError("missing or duplicate snapshot date")
        try:
            if date.fromisoformat(day).isoformat() != day:
                raise ValueError("noncanonical date")
        except ValueError as exc:
            raise ValueError("invalid snapshot date: " + day) from exc
        days[day] = extract(doc)
    dates = sorted(days)
    folds = []
    for i in range(min_train_days, len(dates)):
        prior = [r for day in dates[:i] for r in days[day]]
        current = days[dates[i]]
        by_condition = {}
        for name, rule in CONDITIONS.items():
            # Fixed, preregistered rules only; no holdout-driven optimization.
            by_condition[name] = {
                "historical": metrics([r for r in prior if rule(r)]),
                "evaluation": metrics([r for r in current if rule(r)]),
            }
        folds.append({"evaluation_date": dates[i], "train_dates": dates[:i],
                      "conditions": by_condition})
    combined = {name: metrics([r for fold in folds
                 for r in days[fold["evaluation_date"]] if rule(r)])
                 for name, rule in CONDITIONS.items()}
    stability = {}
    for name in CONDITIONS:
        observations = [f["conditions"][name]["evaluation"] for f in folds]
        observed = [m for m in observations if m["settled_races"] > 0 and m["return_rate_percent"] is not None]
        profitable = sum(m["return_rate_percent"] >= 100 for m in observed)
        total = len(observed)
        total_stake = sum(m["stake"] for m in observed)
        total_payout = sum(m["payout"] for m in observed)
        leave_one_day_out = []
        for m in observed:
            remaining_stake = total_stake - m["stake"]
            if remaining_stake > 0:
                leave_one_day_out.append(round(100 * (total_payout - m["payout"]) / remaining_stake, 2))
        largest_payout_day = max((m["payout"] for m in observed), default=0)
        # Risk is measured on settled evaluation DAYS, not individual races.
        # Skipped/no-stake days break the losing-day streak.
        losing_streak = max_losing_streak = 0
        equity = peak = max_drawdown = 0
        for m in observations:
            if m["stake"] <= 0:
                losing_streak = 0
                continue
            losing_streak = losing_streak + 1 if m["net"] < 0 else 0
            max_losing_streak = max(max_losing_streak, losing_streak)
            equity += m["net"]
            peak = max(peak, equity)
            max_drawdown = max(max_drawdown, peak - equity)
        stability[name] = {
            "max_consecutive_losing_days": max_losing_streak,
            "max_daily_net_loss": min((m["net"] for m in observed), default=None),
            "max_drawdown_yen": max_drawdown if observed else None,
            "risk_unit": "evaluation_days",
            "risk_note": "Day-level hypothetical settled stake/payout; no bankroll or race-level losing streak.",
            "largest_day_payout_share_percent": round(100 * largest_payout_day / total_payout, 2) if total_payout > 0 else None,
            "leave_one_day_out_min_return_rate_percent": min(leave_one_day_out, default=None),
            "leave_one_day_out_max_return_rate_percent": max(leave_one_day_out, default=None),
            "leave_one_day_out_days": len(leave_one_day_out),
            "single_day_dependency_warning": (
                "Largest payout day exceeds half of all payouts"
                if total_payout > 0 and largest_payout_day / total_payout > .5 else None
            ),
            "evaluated_days": total,
            "days_with_no_settled_races": len(observations) - total,
            "days_at_or_above_100_percent": profitable,
            "days_below_100_percent": total - profitable,
            "profitable_day_share_percent": round(100 * profitable / total, 2) if total else None,
            "min_daily_return_rate_percent": min((m["return_rate_percent"] for m in observed), default=None),
            "max_daily_return_rate_percent": max((m["return_rate_percent"] for m in observed), default=None),
            "caution": "Descriptive only; days have unequal stake and overlapping training histories."
        }
    evaluation_dates = [fold["evaluation_date"] for fold in folds]
    evaluation_races = combined["all"]["settled_races"]
    evaluation_ready = len(evaluation_dates) >= 7 and evaluation_races >= 100
    return {"mode": "research_only", "min_train_days": min_train_days,
            "evaluation_days": len(evaluation_dates),
            "evaluation_settled_races": evaluation_races,
            "enough_holdout_for_review": evaluation_ready,
            "holdout_warning": None if evaluation_ready else "Fewer than 7 evaluation dates or 100 settled evaluation races; no reliability claim",
            "available_days": dates, "fold_count": len(folds),
            "stability": stability,
            "folds": folds, "all_evaluation_dates": combined,
            "ready_for_premium": False,
            "note": "Selection thresholds are fixed; no odds or calibrated probabilities. "
                    "Do not claim independent folds or profitability."}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshots", nargs="+", type=Path)
    parser.add_argument("--min-train-days", type=int, default=14)
    args = parser.parse_args()
    docs = [json.loads(p.read_text(encoding="utf-8")) for p in args.snapshots]
    print(json.dumps(walkforward(docs, args.min_train_days), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
