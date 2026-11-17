"""Build an explicitly opt-in, aggregate-only research dashboard JSON.

python scripts/premium_dashboard_report.py data/auto/*.json --output /tmp/premium-summary.json
Does not publish or modify prediction snapshots. No ticket-level data.
"""
import argparse
import json
from datetime import date
from pathlib import Path
try:
    from scripts.premium_selection_study import extract, metrics, CONDITIONS
except ModuleNotFoundError:
    from premium_selection_study import extract, metrics, CONDITIONS

def summarize(docs, min_days=14):
    dates = {}
    for doc in docs:
        day = doc.get("date")
        if not isinstance(day, str) or day in dates:
            raise ValueError("missing or duplicate snapshot date")
        try:
            if date.fromisoformat(day).isoformat() != day:
                raise ValueError("noncanonical date")
        except ValueError as exc:
            raise ValueError("invalid snapshot date: " + day) from exc
        dates[day] = extract(doc)
    rows = [r for d in sorted(dates) for r in dates[d]]
    base = metrics(rows)
    daily = [{"date": d, **metrics(dates[d])} for d in sorted(dates)]
    conditions = []
    for name, predicate in CONDITIONS.items():
        selected = [r for r in rows if predicate(r)]
        m = metrics(selected)
        conditions.append({"name": name, **m,
                           "skip_races": len(rows) - len(selected),
                           "skip_rate_percent": round(100*(len(rows)-len(selected))/len(rows), 2) if rows else None})
    return {"schema": "premium-dashboard-v1", "mode": "research_only",
            "date_start": min(dates) if dates else None,
            "date_end": max(dates) if dates else None,
            "snapshot_days": len(dates), "minimum_days": min_days,
            "ready_for_premium": False, "enough_days_for_research": len(dates) >= min_days,
            "baseline": base, "conditions": conditions, "daily": daily,
            "notice": "Hypothetical historical metrics only. No verified pre-cutoff odds or calibrated probabilities."}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("snapshots", nargs="+", type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--min-days", type=int, default=14)
    args = p.parse_args()
    if args.min_days < 1:
        p.error("--min-days must be positive")
    report = summarize([json.loads(f.read_text(encoding="utf-8")) for f in args.snapshots], args.min_days)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")

if __name__ == "__main__":
    main()
