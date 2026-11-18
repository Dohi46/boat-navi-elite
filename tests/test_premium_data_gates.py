import unittest
from scripts.premium_data_gates import (
    odds_gate, weather_gate, exhibition_gate, calibration_gate,
    skip_assessment, venue_report, audit_entry,
)

CUTOFF = "2026-11-18T15:00:00+09:00"
BEFORE = "2026-11-18T14:55:00+09:00"
AFTER = "2026-11-18T15:01:00+09:00"

class DataGatesTests(unittest.TestCase):
    def test_odds_time_and_values(self):
        good = {"observed_at": BEFORE, "combination": "1-2-3", "decimal_odds": 12.3}
        self.assertTrue(odds_gate(good, CUTOFF)["valid"])
        self.assertFalse(odds_gate({**good, "observed_at": AFTER}, CUTOFF)["valid"])
        self.assertFalse(odds_gate({**good, "decimal_odds": float("nan")}, CUTOFF)["valid"])

    def test_weather_requires_provenance_and_pre_cutoff(self):
        good = {"observed_at": BEFORE, "source": "test sensor",
                "wind_speed_mps": 3, "wave_height_cm": 4, "wind_direction_deg": 90}
        self.assertTrue(weather_gate(good, CUTOFF)["valid"])
        self.assertFalse(weather_gate({**good, "observed_at": AFTER}, CUTOFF)["valid"])
        self.assertFalse(weather_gate({**good, "source": ""}, CUTOFF)["valid"])

    def test_exhibition_six_lanes(self):
        good = {"observed_at": BEFORE, "source": "test",
                "lanes": [{"lane": i, "exhibition_time": 6.7, "start_timing": .15} for i in range(1, 7)]}
        self.assertTrue(exhibition_gate(good, CUTOFF)["valid"])
        self.assertFalse(exhibition_gate({**good, "lanes": good["lanes"][:5]}, CUTOFF)["valid"])

    def test_relative_scores_not_probabilities(self):
        self.assertFalse(calibration_gate({"model_kind": "v13_relative", "probability": .5})["valid"])
        self.assertTrue(calibration_gate({"model_kind": "calibrated_probability", "probability": .5,
                                         "out_of_sample_verified": True, "model_version": "test-v1"})["valid"])

    def test_skip_is_fail_closed(self):
        self.assertEqual(skip_assessment(None, None, None, None, CUTOFF)["decision"], "SKIP")

    def test_venue_requires_sample(self):
        result = venue_report([{"venue": 1, "stake": 100, "payout": 150}])
        self.assertEqual(result["1"]["return_rate_percent"], 150)
        self.assertFalse(result["1"]["sample_sufficient"])

    def test_audit_deterministic_and_rejects_late(self):
        record = {"race_date": "2026-11-18", "venue": 1, "race": 1,
                  "prediction_captured_at": BEFORE, "cutoff_at": CUTOFF,
                  "picks": ["1-2-3"], "source_version": "test"}
        self.assertEqual(audit_entry(record)["sha256"], audit_entry(dict(reversed(list(record.items()))))["sha256"])
        with self.assertRaises(ValueError):
            audit_entry({**record, "prediction_captured_at": AFTER})

if __name__ == "__main__":
    unittest.main()
