"""Read-only adapter for existing data/auto/YYYY-MM-DD.json v13 snapshots.

Never interprets v13 relative weights as calibrated win probabilities.
No write to the source snapshot, free AI LAB, or localStorage.
"""
import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

def convert(doc):
    if not isinstance(doc, dict) or not isinstance(doc.get("races"), list):
        raise ValueError("expected document with races array")
    date = doc.get("date")
    if not isinstance(date, str) or not date:
        raise ValueError("missing snapshot date")
    output = []
    for row in doc["races"]:
        if not isinstance(row, dict):
            continue
        reasons = []
        picks = row.get("picks")
        if not isinstance(picks, list) or not picks:
            reasons.append("missing picks")
            picks = []
        if row.get("raceDate") != date:
            reasons.append("race date mismatch")
        if row.get("predictionPhase") != "before":
            reasons.append("not a pre-cutoff prediction")
        try:
            cutoff = datetime.strptime(row["cutoff"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=JST)
            captured = datetime.fromisoformat(row["capturedAt"].replace("Z", "+00:00"))
            if captured.tzinfo is None or captured >= cutoff:
                reasons.append("prediction captured after cutoff or missing timezone")
        except (KeyError, TypeError, ValueError):
            reasons.append("invalid cutoff or capturedAt")
        if not all(isinstance(p, dict) and isinstance(p.get("pick"), str) for p in picks):
            reasons.append("invalid picks")
        # v13 probability is a relative score, not calibrated probability.
        # Source snapshot lacks verified contemporaneous per-ticket odds.
        reasons.extend(["uncalibrated v13 relative scores", "no verified pre-cutoff odds"])
        output.append({
            "venue": row.get("venue"), "race": row.get("race"), "race_date": row.get("raceDate"),
            "source_engine": doc.get("engine"), "source_created_at": doc.get("createdAt"),
            "picks": [{"pick": p.get("pick"), "relative_score": p.get("probability"), "stake": p.get("stake")} for p in picks if isinstance(p, dict)],
            "decision": "SKIP", "data_complete": False, "reasons": reasons
        })
    return {"mode": "research_only", "source_date": date, "assessments": output}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = convert(json.loads(args.snapshot.read_text(encoding="utf-8")))
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(content, encoding="utf-8")
    else:
        print(content, end="")

if __name__ == "__main__":
    main()
