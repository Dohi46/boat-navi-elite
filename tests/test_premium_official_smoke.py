import unittest
from scripts.premium_official_smoke import probe

class OfficialSmokeTests(unittest.TestCase):
    def test_fetch_success_is_not_approval(self):
        def fake(day, venue, race):
            return {"weather": {"wind_direction_deg": None},
                    "exhibition": {"lanes": [{"start_timing": None}] * 6},
                    "source_url": "https://www.boatrace.jp/example",
                    "retrieved_at": "2026-11-18T00:00:00+00:00", "html_sha256": "abc"}
        result = probe("2026-11-18", 2, 5, fetch=fake)
        self.assertEqual(result["status"], "fetched")
        self.assertFalse(result["ready_for_premium"])
        self.assertEqual(result["start_timing_count"], 0)

    def test_network_error_is_reported(self):
        def fail(day, venue, race):
            raise TimeoutError("network")
        result = probe("2026-11-18", 2, 5, fetch=fail)
        self.assertEqual(result["status"], "fetch_error")
        self.assertEqual(result["error_type"], "TimeoutError")

if __name__ == "__main__":
    unittest.main()
