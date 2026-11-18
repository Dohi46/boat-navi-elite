import unittest
from datetime import datetime, timezone
from scripts.premium_precutoff_collect import collect

class PrecutoffTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 18, 6, 20, tzinfo=timezone.utc)
        self.deadline = "2026-11-18T15:30:00+09:00"

    def test_early_capture(self):
        def fake(day, venue, race):
            return {"retrieved_at": "2026-11-18T06:21:00+00:00",
                    "source_url": "https://www.boatrace.jp/example",
                    "html_sha256": "hash", "weather": None, "exhibition": None}
        r = collect("2026-11-18", 2, 5, self.deadline, fetch=fake, now=self.now)
        self.assertEqual(r["status"], "captured")
        self.assertFalse(r["ready_for_premium"])

    def test_late_capture_skips_without_fetch(self):
        def fail(*args):
            raise AssertionError("must not fetch")
        r = collect("2026-11-18", 2, 5, self.deadline, fetch=fail,
                    now=datetime(2026, 11, 18, 6, 29, tzinfo=timezone.utc))
        self.assertEqual(r["status"], "skip_cutoff")

    def test_fetch_crossing_deadline_skips(self):
        def fake(*args):
            return {"retrieved_at": "2026-11-18T06:31:00+00:00"}
        r = collect("2026-11-18", 2, 5, self.deadline, fetch=fake, now=self.now)
        self.assertEqual(r["status"], "skip_cutoff")

    def test_missing_timezone_rejected(self):
        with self.assertRaises(ValueError):
            collect("2026-11-18", 2, 5, "2026-11-18T15:30:00", now=self.now)

if __name__ == "__main__":
    unittest.main()
