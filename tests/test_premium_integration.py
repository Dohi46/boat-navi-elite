import unittest
from scripts.premium_integration import integrate

class IntegrationTests(unittest.TestCase):
    def test_missing_feeds_skip_with_reasons(self):
        result = integrate({"races": [{"venue": 1, "race": 1, "cutoff_at": "2026-11-18T15:00:00+09:00"}]})
        self.assertFalse(result["ready_for_premium"])
        row = result["races"][0]
        self.assertEqual(row["decision"], "SKIP")
        self.assertTrue(any("odds:" in reason for reason in row["reasons"]))
        self.assertTrue(any("calibration:" in reason for reason in row["reasons"]))

    def test_even_all_supplied_gates_cannot_publish(self):
        time = "2026-11-18T14:55:00+09:00"
        result = integrate({"races": [{
            "cutoff_at": "2026-11-18T15:00:00+09:00",
            "odds": {"observed_at": time, "combination": "1-2-3", "decimal_odds": 15},
            "weather": {"observed_at": time, "source": "test", "wind_speed_mps": 2,
                        "wave_height_cm": 3, "wind_direction_deg": 90},
            "exhibition": {"observed_at": time, "source": "test", "lanes": [
                {"lane": i, "exhibition_time": 6.7, "start_timing": .1} for i in range(1, 7)]},
            "calibration": {"model_kind": "calibrated_probability", "probability": .2,
                            "out_of_sample_verified": True, "model_version": "test"},
            "risk": {"enough_holdout_for_review": True, "high_risk": False},
        }]})
        self.assertEqual(result["races"][0]["decision"], "SKIP")
        self.assertIn("research-only", result["races"][0]["reasons"][0])

    def test_invalid_document(self):
        with self.assertRaises(ValueError):
            integrate({"races": None})

if __name__ == "__main__":
    unittest.main()
