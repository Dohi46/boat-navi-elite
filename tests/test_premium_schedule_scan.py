import unittest
from datetime import datetime, timezone
from scripts.premium_schedule_scan import scan, scan_upcoming

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

    def test_upcoming_selects_earliest_future_race(self):
        deadlines = {8: "2026-11-18T15:10:00+09:00",
                     9: "2026-11-18T15:40:00+09:00",
                     10: "2026-11-18T15:30:00+09:00"}
        selected = []
        def collector(day, venue, race, deadline, **kwargs):
            selected.append(race)
            return {"race": race, "status": "captured", "ready_for_premium": False}
        report = scan_upcoming("2026-11-18", 2, now=NOW, candidates=(8, 9, 10),
                               deadline_fetch=lambda day, venue, race: {"deadline_jst": deadlines[race]},
                               collector=collector)
        self.assertEqual(selected, [10])
        self.assertEqual(report["outcome"], "capture_partial_or_skipped")
        self.assertEqual(report["results"][0]["status"], "captured")
        self.assertEqual(report["candidates"][0]["status"], "skip_cutoff")

    def test_upcoming_full_capture_requires_both_fields(self):
        deadline = "2026-11-18T15:40:00+09:00"
        report = scan_upcoming("2026-11-18", 2, now=NOW, candidates=(9,),
                               deadline_fetch=lambda *args: {"deadline_jst": deadline},
                               collector=lambda *args, **kwargs: {
                                   "race": 9, "status": "captured",
                                   "weather_parsed": True, "exhibition_parsed": True})
        self.assertEqual(report["outcome"], "capture_with_both_fields")
        self.assertFalse(report["ready_for_premium"])

    def test_upcoming_partial_capture_not_full_success(self):
        deadline = "2026-11-18T15:40:00+09:00"
        report = scan_upcoming("2026-11-18", 2, now=NOW, candidates=(9,),
                               deadline_fetch=lambda *args: {"deadline_jst": deadline},
                               collector=lambda *args, **kwargs: {
                                   "race": 9, "status": "captured",
                                   "weather_parsed": True, "exhibition_parsed": False})
        self.assertEqual(report["outcome"], "capture_partial_or_skipped")
        self.assertFalse(report["ready_for_premium"])

    def test_upcoming_all_expired_never_collects(self):
        report = scan_upcoming("2026-11-18", 2, now=NOW, candidates=(8,),
                               deadline_fetch=lambda *args: {"deadline_jst": "2026-11-18T15:00:00+09:00"},
                               collector=lambda *args, **kwargs: self.fail("must not collect"))
        self.assertEqual(report["results"], [])
        self.assertEqual(report["outcome"], "no_eligible_race")
        self.assertEqual(report["candidates"][0]["status"], "skip_cutoff")

    def test_upcoming_candidate_limit(self):
        with self.assertRaises(ValueError):
            scan_upcoming("2026-11-18", 2, now=NOW, candidates=tuple(range(1, 8)))

    def test_bounded_requests(self):
        with self.assertRaises(ValueError):
            scan("2026-11-18", 2, [1, 2, 3, 4], now=NOW)

if __name__ == "__main__":
    unittest.main()
