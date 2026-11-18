"""Research-only pre-cutoff capture. Requires a verified, explicit local deadline."""
import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from scripts.premium_official_capture import capture
from scripts.premium_official_deadline import fetch_deadline

JST = ZoneInfo("Asia/Tokyo")

def collect(day, venue, race, deadline, *, fetch=capture, now=None, minimum_lead_minutes=2, deadline_fetch=fetch_deadline):
    if date.fromisoformat(day).isoformat() != day:
        raise ValueError("invalid race date")
    deadline_source = None
    if deadline == "auto":
        official = deadline_fetch(day, venue, race)
        deadline = official.get("deadline_jst")
        deadline_source = official.get("source_url")
        if not deadline:
            return {"schema": "premium-precutoff-v1", "mode": "research_only",
                    "race_date": day, "venue": venue, "race": race,
                    "status": "skip_deadline_unknown", "ready_for_premium": False}
    cutoff = datetime.fromisoformat(deadline)
    if cutoff.tzinfo is None:
        raise ValueError("deadline requires explicit timezone offset")
    cutoff = cutoff.astimezone(JST)
    if cutoff.date().isoformat() != day:
        raise ValueError("deadline must match race date in Japan")
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    lead = cutoff - instant.astimezone(JST)
    base = {"schema": "premium-precutoff-v1", "mode": "research_only",
            "race_date": day, "venue": venue, "race": race,
            "deadline_jst": cutoff.isoformat(), "deadline_source": deadline_source,
            "checked_at": instant.isoformat(),
            "ready_for_premium": False}
    if lead < timedelta(minutes=minimum_lead_minutes):
        return {**base, "status": "skip_cutoff", "reason": "insufficient time before verified deadline"}
    result = fetch(day, venue, race)
    retrieved = datetime.fromisoformat(result["retrieved_at"])
    if retrieved.tzinfo is None or retrieved >= cutoff:
        return {**base, "status": "skip_cutoff", "reason": "capture not verified before deadline"}
    weather, exhibition = result.get("weather"), result.get("exhibition")
    return {**base, "status": "captured",
            "retrieved_at": retrieved.isoformat(), "source_url": result["source_url"],
            "html_sha256": result["html_sha256"],
            "weather": weather, "exhibition": exhibition,
            "weather_parsed": weather is not None,
            "exhibition_parsed": exhibition is not None,
            "note": "Deadline must be independently verified; capture time is not source observation time."}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--date", required=True)
    p.add_argument("--venue", required=True, type=int)
    p.add_argument("--race", required=True, type=int)
    p.add_argument("--deadline-jst", required=True, help="Verified deadline with timezone, or auto for official extraction")
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    try:
        report = collect(args.date, args.venue, args.race, args.deadline_jst)
    except (OSError, TimeoutError, ValueError) as exc:
        report = {"schema": "premium-precutoff-v1", "mode": "research_only",
                  "status": "fetch_error", "error_type": type(exc).__name__,
                  "ready_for_premium": False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in ("weather","exhibition")}, ensure_ascii=False))

if __name__ == "__main__":
    main()
