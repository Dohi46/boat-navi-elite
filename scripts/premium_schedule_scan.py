"""Bounded research scheduler: discover candidates only from uniquely labeled official deadlines.

The official race schedule parser is provisional. Unknown deadlines are skipped.
No bets, no repository writes, and no claims of pre-cutoff source observation.
"""
import argparse
import json
from datetime import datetime, timezone
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

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--venue", type=int, default=2)
    p.add_argument("--races", type=int, nargs="+", default=[5, 6])
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    now = datetime.now(timezone.utc)
    day = now.astimezone(JST).date().isoformat()
    report = scan(day, args.venue, args.races, now=now)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"date": day, "venue": args.venue,
                      "statuses": [r["status"] for r in report["results"]]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
