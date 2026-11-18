import unittest
from scripts.premium_capture_digest import digest

class CaptureDigestTests(unittest.TestCase):
    def test_no_eligible_does_not_expose_raw_fields(self):
        report = {"schema": "premium-schedule-scan-v1", "mode": "research_only",
                  "date": "2026-11-18", "venue": 2, "checked_at": "now",
                  "outcome": "no_eligible_race", "candidates": [{"race": 8, "status": "skip_cutoff"}],
                  "results": [], "html": "private"}
        result = digest(report)
        self.assertEqual(result["candidate_counts"]["skip_cutoff"], 1)
        self.assertNotIn("html", result)
        self.assertFalse(result["ready_for_premium"])

    def test_full_capture_still_not_ready(self):
        report = {"schema": "premium-schedule-scan-v1", "mode": "research_only",
                  "outcome": "capture_with_both_fields",
                  "candidates": [{"race": 9, "status": "eligible"}],
                  "results": [{"status": "captured", "weather_parsed": True,
                               "exhibition_parsed": True, "weather": {"wind_speed_mps": 5}}]}
        result = digest(report)
        self.assertEqual(result["full_capture_count"], 1)
        self.assertNotIn("weather", str(result))
        self.assertFalse(result["ready_for_premium"])

    def test_inconsistent_success_is_rejected(self):
        report = {"schema": "premium-schedule-scan-v1", "mode": "research_only",
                  "outcome": "capture_with_both_fields", "candidates": [], "results": []}
        with self.assertRaises(ValueError):
            digest(report)

if __name__ == "__main__":
    unittest.main()
