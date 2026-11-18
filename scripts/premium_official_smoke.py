"""One-shot official-page connectivity smoke test. No picks or source HTML in artifact."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from scripts.premium_official_capture import capture

def probe(day, venue, race, *, fetch=capture):
    try:
        result = fetch(day, venue, race)
        weather = result["weather"]
        exhibition = result["exhibition"]
        return {
            "schema": "premium-official-smoke-v1", "mode": "research_only",
            "status": "fetched", "race_date": day, "venue": venue, "race": race,
            "source_url": result["source_url"], "retrieved_at": result["retrieved_at"],
            "html_sha256": result["html_sha256"],
            "weather_parsed": weather is not None,
            "exhibition_parsed": exhibition is not None,
            "wind_direction_parsed": bool(weather and weather["wind_direction_deg"] is not None),
            "start_timing_count": sum(lane["start_timing"] is not None for lane in exhibition["lanes"]) if exhibition else 0,
            "entry_mapping_verified": False,
            "ready_for_premium": False,
            "note": "Connectivity alone does not prove pre-cutoff capture or correct field mapping."
        }
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        return {"schema": "premium-official-smoke-v1", "mode": "research_only",
                "status": "fetch_error", "race_date": day, "venue": venue, "race": race,
                "error_type": type(exc).__name__, "ready_for_premium": False}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--date", required=True)
    p.add_argument("--venue", required=True, type=int)
    p.add_argument("--race", required=True, type=int)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    report = probe(args.date, args.venue, args.race)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    # Connectivity failures are recorded in the artifact; no live purchase is enabled.
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
