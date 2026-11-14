#!/usr/bin/env python3
"""Offline historical water-condition analysis for BOAT NEXUS v14.

Input: downloaded Boatrace Open API daily JSON files. No network, no browser
storage access. This is exploratory aggregation, NOT a trained prediction model.
Usage: python3 tools/analyze_historical_water.py data/daily/*.json
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

def numeric(value):
    try:
        return float(value) if value is not None and str(value).strip() else None
    except (ValueError, TypeError):
        return None

def wind_bucket(v):
    if v < 3: return "0-2m/s"
    if v < 5: return "3-4m/s"
    return "5m/s+"

def wave_bucket(v):
    if v < 3: return "0-2cm"
    if v < 6: return "3-5cm"
    return "6cm+"

def main(paths):
    groups = defaultdict(lambda: {"races": 0, "inside_wins": 0, "outside_wins": 0})
    seen = set()
    scanned = usable = 0
    for path in paths:
        try:
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            print(f"skip {path}: {e}", file=sys.stderr)
            continue
        for venue, stadium in (data.get("programs", {}).get("stadiums", {}) or {}).items():
            for race_id, race in (stadium.get("races", {}) or {}).items():
                scanned += 1
                date = race.get("date")
                key = (date, str(venue), str(race_id))
                if not date or key in seen: continue
                seen.add(key)
                preview = race.get("preview") or {}
                wind, wave = numeric(preview.get("wind_speed")), numeric(preview.get("wave_height"))
                if wind is None or wave is None or wind < 0 or wave < 0: continue
                # A 3-trifecta payout is evidence of the winning BOAT number, not
                # necessarily its actual entry course. Do not call it an 'inside win'.
                payouts = ((race.get("result") or {}).get("payouts") or {}).get("trifecta")
                if not isinstance(payouts, list) or len(payouts) != 1: continue
                pick = str(payouts[0].get("combination", ""))
                if len(pick) != 5 or pick[1] != "-" or pick[3] != "-" or pick[0] not in "123456": continue
                usable += 1
                group = groups[(str(venue), wind_bucket(wind), wave_bucket(wave))]
                group["races"] += 1
                group["inside_wins" if pick[0] == "1" else "outside_wins"] += 1
    print("venue,wind_bucket,wave_bucket,races,boat1_win_pct,other_boat_win_pct")
    for (venue, wind, wave), g in sorted(groups.items()):
        n = g["races"]
        print(f'{venue},{wind},{wave},{n},{100*g["inside_wins"]/n:.2f},{100*g["outside_wins"]/n:.2f}')
    print(f"Scanned {scanned} races; usable {usable}. 1号艇 != 1コース when entry changes.", file=sys.stderr)
    print("Caution: weather timing and representativeness are not verified; do not use these rates as live model weights.", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python3 tools/analyze_historical_water.py daily1.json [daily2.json ...]")
    main(sys.argv[1:])
