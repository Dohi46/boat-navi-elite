import unittest
from datetime import datetime, timezone
from scripts.premium_schedule_scan import scan

NOW = datetime(2026, 11, 18, 6, 20, tzinfo=timezone.utc)

class ScheduleScanTests(unittest.TestCase):
    def test_unknown_deadline_skips_capture(self):
        result = scan("2026-11-18", 2, [5], now=NOW,
                      deadline_fetch=lambda *args: {"deadline_jst": None},
                      collector=lambda *args, **kwargs: self.fail("capture must not run"))
        self.assertEqual(result["results"][0]["status"], "skip_deadline_unknown")

    def test_known_deadline_calls_collector(self):
        result = scan("2026-11-18", 2, [5], now=NOW,
                      deadline_fetch=lambda *args: {"deadline_jst": "2026-11-18T15:30:00+09:00", "source_url": "official"},
                      collector=lambda *args, **kwargs: {"status": "captured", "ready_for_premium": False})
        self.assertEqual(result["results"][0]["status"], "captured")
        self.assertEqual(result["results"][0]["deadline_source"], "official")

    def test_bounded_requests(self):
        with self.assertRaises(ValueError):
            scan("2026-11-18", 2, [1, 2, 3, 4], now=NOW)

if __name__ == "__main__":
    unittest.main()
