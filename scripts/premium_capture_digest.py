"""Turn an official scan into a public-safe, research-only status digest.

Never export raw HTML, source measurements, or betting selections.
"""
import argparse
import json
from pathlib import Path

OUTCOMES = {"no_eligible_race", "capture_with_both_fields", "capture_partial_or_skipped"}
STATUSES = {"eligible", "skip_cutoff", "skip_deadline_unknown",
            "skip_invalid_deadline", "fetch_error"}

def digest(scan):
    if scan.get("schema") != "premium-schedule-scan-v1" or scan.get("mode") != "research_only":
        raise ValueError("unsupported scan")
    candidates = scan.get("candidates")
    results = scan.get("results")
    if not isinstance(candidates, list) or not isinstance(results, list) or len(candidates) > 6 or len(results) > 1:
        raise ValueError("invalid scan bounds")
    outcome = scan.get("outcome")
    if outcome not in OUTCOMES:
        raise ValueError("invalid outcome")
    counts = {status: 0 for status in sorted(STATUSES)}
    for candidate in candidates:
        if not isinstance(candidate, dict) or candidate.get("status") not in counts:
            raise ValueError("invalid candidate status")
        counts[candidate["status"]] += 1
    full = sum(r.get("status") == "captured" and r.get("weather_parsed") is True
               and r.get("exhibition_parsed") is True for r in results if isinstance(r, dict))
    if (outcome == "capture_with_both_fields") != (full == 1):
        raise ValueError("inconsistent capture outcome")
    if outcome == "no_eligible_race" and (results or counts["eligible"]):
        raise ValueError("inconsistent empty outcome")
    return {"schema": "premium-capture-digest-v1", "mode": "research_only",
            "date": scan.get("date"), "venue": scan.get("venue"),
            "checked_at": scan.get("checked_at"), "outcome": outcome,
            "candidate_counts": counts, "full_capture_count": full,
            "ready_for_premium": False,
            "note": "Both parsed fields do not verify measurement accuracy or pre-cutoff source observation."}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("scan", type=Path)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    result = digest(json.loads(args.scan.read_text(encoding="utf-8")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
