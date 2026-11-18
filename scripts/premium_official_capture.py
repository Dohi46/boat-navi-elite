"""Archive official pre-race pages with retrieval timestamps for later verified parsing.

Usage: python scripts/premium_official_capture.py --date 2026-11-18 --venue 2 --race 5 --output /tmp/capture.json
Research-only. Does not scrape odds, make picks, or claim an observation predates cutoff.
"""
import argparse
import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path
from html.parser import HTMLParser
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://www.boatrace.jp/owpc/pc/race/beforeinfo"

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("tr", "td", "th", "li", "div", "p", "br"):
            self.parts.append(" ")
    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.hidden:
            self.hidden -= 1
        if tag in ("tr", "td", "th", "li", "div", "p"):
            self.parts.append(" ")
    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

def parse_conditions(html, retrieved_at):
    """Parse only explicitly visible data; never infer wind-arrow images or ST."""
    parser = VisibleText()
    parser.feed(html)
    text = re.sub(r"\s+", " ", "".join(parser.parts))
    def measurement(label, unit):
        match = re.search(re.escape(label) + r"\s*(-?\d+(?:\.\d+)?)\s*" + re.escape(unit), text)
        return float(match.group(1)) if match else None

    air = measurement("気温", "℃")
    wind = measurement("風速", "m")
    water = measurement("水温", "℃")
    wave = measurement("波高", "cm")
    weather = None
    if (air is not None and wind is not None and water is not None and wave is not None
            and -20 <= air <= 60 and 0 <= wind <= 60
            and -5 <= water <= 45 and 0 <= wave <= 500
            and "水面気象情報" in text):
        weather = {"observed_at": retrieved_at, "source": "BOAT RACE official beforeinfo",
                   "air_temperature_c": air, "wind_speed_mps": wind,
                   "water_temperature_c": water, "wave_height_cm": wave,
                   "wind_direction_deg": None}
        # Direction often appears as an icon; only accept an explicit labeled number.
        direction = re.search(r"風向(?:き)?\s*([0-9]{1,3})\s*(?:度|°)", text)
        if direction and 0 <= int(direction.group(1)) <= 360:
            weather["wind_direction_deg"] = int(direction.group(1))

    # Scope the six rows to the racer table, not previous-race ST statistics.
    before_start = text.split("スタート展示", 1)[0]
    triplets = re.findall(
        r"\b(?:[3-9][0-9](?:\.[0-9]+)?)\s*kg\s+([4-9]\.[0-9]{2})\s+(-?[0-9]\.[0-9])\b",
        before_start)
    exhibition = None
    if len(triplets) == 6:
        exhibition = {"observed_at": retrieved_at, "source": "BOAT RACE official beforeinfo",
                      "lanes": [{"lane": i, "exhibition_time": float(pair[0]),
                                 "tilt": float(pair[1]), "start_timing": None}
                                for i, pair in enumerate(triplets, 1)],
                      "start_exhibition_status": "unparsed"}

    # Start exhibition is a distinct table: do NOT confuse it with prior-race ST.
    start_match = re.search(r"スタート展示\s*コース\s*並び\s*ST\s*(.*?)\s*水面気象情報", text)
    if exhibition and start_match:
        section = start_match.group(1)
        # A six-row table must explicitly include course numbers 1..6 and ST.
        entries = re.findall(r"(?<!\d)([1-6])\s+(?:Image\s+)?(F?\.?\d{1,2})(?!\d)", section)
        if len(entries) == 6 and [int(e[0]) for e in entries] == list(range(1, 7)):
            for lane, (_, st) in zip(exhibition["lanes"], entries):
                lane["start_timing"] = -float(st[1:]) if st.startswith("F") else float(st)
            exhibition["start_exhibition_status"] = "parsed_course_order_only"
            exhibition["entry_course_mapping_status"] = "unverified: boat identity not in text"
    return weather, exhibition

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
    html = body.decode("utf-8", errors="replace")
    weather, exhibition = parse_conditions(html, observed_at.isoformat())
    return {
        "schema": "premium-official-capture-v1", "mode": "research_only",
        "source_url": url, "source": "BOAT RACE official beforeinfo",
        "race_date": day, "venue": venue, "race": race,
        "retrieved_at": observed_at.isoformat(),
        "html_sha256": hashlib.sha256(body).hexdigest(),
        "html": html,
        "weather": weather, "exhibition": exhibition,
        "structured_data_status": "partial_weather_and_exhibition" if weather and exhibition else ("partial_weather_only" if weather else ("partial_exhibition_only" if exhibition else "unparsed")),
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
