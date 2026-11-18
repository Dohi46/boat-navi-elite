"""Bounded research scheduler: discover candidates only from uniquely labeled official deadlines.

The official race schedule parser is provisional. Unknown deadlines are skipped.
No bets, no repository writes, and no claims of pre-cutoff source observation.
"""
import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from scripts.premium_official_deadline import fetch_deadline
from scripts.premium_precutoff_collect import collect

JST = ZoneInfo("Asia/Tokyo")

def scan(day, venue, races, *, now=None, deadline_fetch=fetch_deadline, collector=collect):
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        raise ValueError("now requires timezone")
    if not 1 <= venue <= 24 or len(races) > 3 or any(r not in range(1, 13) for r in races):
        raise ValueError("research scan limited to one venue and at most three races")
    results = []
    for race in races:
        try:
            official = deadline_fetch(day, venue, race)
            deadline = official.get("deadline_jst")
            if not deadline:
                results.append({"race": race, "status": "skip_deadline_unknown"})
                continue
            report = collector(day, venue, race, deadline, now=instant)
            report["deadline_source"] = official.get("source_url")
            results.append(report)
        except (OSError, TimeoutError, ValueError) as exc:
            results.append({"race": race, "status": "fetch_error", "error_type": type(exc).__name__})
    return {"schema": "premium-schedule-scan-v1", "mode": "research_only",
            "date": day, "venue": venue, "checked_at": instant.isoformat(),
            "ready_for_premium": False, "results": results}

def scan_upcoming(day, venue, *, now=None, deadline_fetch=fetch_deadline,
                  collector=collect, candidates=(7, 8, 9, 10, 11, 12),
                  minimum_lead_minutes=5):
    """Probe at most six official deadlines; collect the earliest eligible race once."""
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        raise ValueError("now requires timezone")
    if not 1 <= venue <= 24 or not candidates or len(candidates) > 6 or any(r not in range(1, 13) for r in candidates):
        raise ValueError("limit candidate scan to six valid races")
    inspected, eligible = [], []
    for race in candidates:
        try:
            official = deadline_fetch(day, venue, race)
            deadline = official.get("deadline_jst")
            if not deadline:
                inspected.append({"race": race, "status": "skip_deadline_unknown"})
                continue
            cutoff = datetime.fromisoformat(deadline)
            if cutoff.tzinfo is None or cutoff.astimezone(JST).date().isoformat() != day:
                inspected.append({"race": race, "status": "skip_invalid_deadline"})
                continue
            if cutoff - instant < timedelta(minutes=minimum_lead_minutes):
                inspected.append({"race": race, "status": "skip_cutoff"})
                continue
            eligible.append((cutoff, race, official.get("source_url")))
            inspected.append({"race": race, "status": "eligible"})
        except (OSError, TimeoutError, ValueError) as exc:
            inspected.append({"race": race, "status": "fetch_error", "error_type": type(exc).__name__})
    results = []
    if eligible:
        cutoff, race, source = min(eligible, key=lambda item: (item[0], item[1]))
        try:
            result = collector(day, venue, race, cutoff.isoformat(), now=instant)
            result["deadline_source"] = source
            results.append(result)
        except (OSError, TimeoutError, ValueError) as exc:
            results.append({"race": race, "status": "fetch_error", "error_type": type(exc).__name__})
    outcome = ("no_eligible_race" if not eligible else
               "capture_with_both_fields" if results and results[0].get("status") == "captured"
               and results[0].get("weather_parsed") and results[0].get("exhibition_parsed") else
               "capture_partial_or_skipped")
    return {"schema": "premium-schedule-scan-v1", "mode": "research_only",
            "date": day, "venue": venue, "checked_at": instant.isoformat(),
            "selection": "earliest_verified_upcoming_deadline", "candidates": inspected,
            "outcome": outcome, "ready_for_premium": False, "results": results}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--venue", type=int, default=2)
    p.add_argument("--races", type=int, nargs="+", default=[8, 9])
    p.add_argument("--auto-upcoming", action="store_true")
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    now = datetime.now(timezone.utc)
    day = now.astimezone(JST).date().isoformat()
    report = (scan_upcoming(day, args.venue, now=now) if args.auto_upcoming
              else scan(day, args.venue, args.races, now=now))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"date": day, "venue": args.venue, "outcome": report.get("outcome"),
                      "statuses": [r["status"] for r in report["results"]],
                      "candidate_statuses": [(r["race"], r["status"]) for r in report.get("candidates", [])]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
