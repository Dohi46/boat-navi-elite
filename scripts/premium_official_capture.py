"""Archive official pre-race pages with retrieval timestamps for later verified parsing.

Usage: python scripts/premium_official_capture.py --date 2026-11-18 --venue 2 --race 5 --output /tmp/capture.json
Research-only. Does not scrape odds, make picks, or claim an observation predates cutoff.
"""
import argparse
import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://www.boatrace.jp/owpc/pc/race/beforeinfo"

def capture(day, venue, race, *, opener=urlopen, now=None):
    if date.fromisoformat(day).isoformat() != day:
        raise ValueError("noncanonical date")
    if type(venue) is not int or not 1 <= venue <= 24:
        raise ValueError("venue must be 1..24")
    if type(race) is not int or not 1 <= race <= 12:
        raise ValueError("race must be 1..12")
    url = BASE + "?" + urlencode({"hd": day.replace("-", ""), "jcd": f"{venue:02d}", "rno": race})
    request = Request(url, headers={"User-Agent": "BOAT-NEXUS-Research/1.0"})
    with opener(request, timeout=20) as response:
        body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError("official response too large")
        content_type = response.headers.get("Content-Type", "")
        if "html" not in content_type.lower():
            raise ValueError("expected official HTML")
    observed_at = now or datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return {
        "schema": "premium-official-capture-v1", "mode": "research_only",
        "source_url": url, "source": "BOAT RACE official beforeinfo",
        "race_date": day, "venue": venue, "race": race,
        "retrieved_at": observed_at.isoformat(),
        "html_sha256": hashlib.sha256(body).hexdigest(),
        "html": body.decode("utf-8", errors="replace"),
        "weather": None, "exhibition": None,
        "structured_data_status": "unparsed: do not infer availability or pre-cutoff timing",
        "ready_for_premium": False
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--date", required=True)
    p.add_argument("--venue", type=int, required=True)
    p.add_argument("--race", type=int, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    report = capture(args.date, args.venue, args.race)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
