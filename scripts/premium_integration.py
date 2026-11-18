"""Offline premium research data integration; accepts supplied observations, never fetches or invents live data."""
import argparse
import json
from pathlib import Path
from scripts.premium_data_gates import odds_gate, weather_gate, exhibition_gate, calibration_gate, skip_assessment

def integrate(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("races"), list):
        raise ValueError("expected races list")
    output = []
    for row in payload["races"]:
        if not isinstance(row, dict):
            continue
        cutoff = row.get("cutoff_at")
        odds = row.get("odds")
        weather = row.get("weather")
        exhibition = row.get("exhibition")
        calibration = row.get("calibration")
        decision = skip_assessment(odds, weather, exhibition, calibration, cutoff, row.get("risk"))
        output.append({"venue": row.get("venue"), "race": row.get("race"),
                       "decision": decision["decision"], "reasons": decision["reasons"],
                       "gates": decision["gates"]})
    return {"schema": "premium-integration-v1", "mode": "research_only",
            "ready_for_premium": False, "races": output,
            "source_status": "user-supplied offline observations; no live feed configured",
            "note": "Never infer pre-cutoff observations from results. All recommendations disabled."}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = integrate(json.loads(args.input.read_text(encoding="utf-8")))
    result = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(result, encoding="utf-8")
    else:
        print(result, end="")

if __name__ == "__main__":
    main()
