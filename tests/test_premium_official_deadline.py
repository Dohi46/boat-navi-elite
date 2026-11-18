import unittest
from datetime import datetime, timezone
from scripts.premium_official_deadline import parse_deadline
from scripts.premium_precutoff_collect import collect

class OfficialDeadlineTests(unittest.TestCase):
    def test_explicit_deadline(self):
        html = "<html><body><span>締切予定時刻 15:30</span></body></html>"
        self.assertEqual(parse_deadline(html, "2026-11-18"), "2026-11-18T15:30:00+09:00")

    def test_ambiguous_deadlines_are_unknown(self):
        self.assertIsNone(parse_deadline("締切予定 15:30 締切予定 15:40", "2026-11-18"))
        self.assertIsNone(parse_deadline("発売開始 15:30", "2026-11-18"))

    def test_auto_deadline_unknown_never_fetches(self):
        def no_capture(*args):
            raise AssertionError("must not fetch")
        result = collect("2026-11-18", 2, 5, "auto", fetch=no_capture,
                         deadline_fetch=lambda *args: {"deadline_jst": None, "source_url": "official"},
                         now=datetime(2026, 11, 18, 6, 20, tzinfo=timezone.utc))
        self.assertEqual(result["status"], "skip_deadline_unknown")

    def test_auto_deadline_capture(self):
        result = collect("2026-11-18", 2, 5, "auto",
                         deadline_fetch=lambda *args: {"deadline_jst": "2026-11-18T15:30:00+09:00", "source_url": "official"},
                         fetch=lambda *args: {"retrieved_at": "2026-11-18T06:21:00+00:00",
                                              "source_url": "official", "html_sha256": "hash",
                                              "weather": None, "exhibition": None},
                         now=datetime(2026, 11, 18, 6, 20, tzinfo=timezone.utc))
        self.assertEqual(result["status"], "captured")
        self.assertEqual(result["deadline_source"], "official")

if __name__ == "__main__":
    unittest.main()
