"""Conservative official deadline extraction; no inference from nearby times."""
import re
from datetime import datetime, timedelta
from html.parser import HTMLParser
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")
BASE = "https://www.boatrace.jp/owpc/pc/race/racelist"

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("td", "th", "tr", "p", "div", "span", "br"):
            self.parts.append(" ")
    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.hidden:
            self.hidden -= 1
    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

def parse_deadline(html, day):
    parser = Text()
    parser.feed(html)
    text = re.sub(r"\s+", " ", "".join(parser.parts))
    # Only a uniquely labeled deadline is acceptable. Do not guess from start times.
    times = re.findall(r"(?:投票締切予定時刻|締切予定時刻|締切予定)\s*[:：]?\s*([01]?\d|2[0-3]):([0-5]\d)", text)
    if len(times) != 1:
        return None
    hour, minute = map(int, times[0])
    return datetime.fromisoformat(f"{day}T{hour:02d}:{minute:02d}:00").replace(tzinfo=JST).isoformat()

def fetch_deadline(day, venue, race, *, opener=urlopen):
    url = BASE + "?" + urlencode({"hd": day.replace("-", ""), "jcd": f"{venue:02d}", "rno": race})
    request = Request(url, headers={"User-Agent": "BOAT-NEXUS-Research/1.0"})
    with opener(request, timeout=20) as response:
        body = response.read(2_000_001)
        if len(body) > 2_000_000 or "html" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("invalid official deadline response")
    return {"deadline_jst": parse_deadline(body.decode("utf-8", errors="replace"), day),
            "source_url": url}
