import unittest
from scripts.premium_auto_adapter import convert

class AdapterTests(unittest.TestCase):
    def test_v13_scores_not_treated_as_probabilities(self):
        doc = {"date":"2026-11-17","engine":"v13-reference-no-odds","races":[{
            "venue":1,"race":1,"raceDate":"2026-11-17",
            "cutoff":"2026-11-17 15:18:00",
            "capturedAt":"2026-11-16T22:59:49.602Z",
            "predictionPhase":"before",
            "picks":[{"pick":"1-2-3","probability":0.0129,"stake":100}]
        }]}
        item=convert(doc)["assessments"][0]
        self.assertEqual(item["decision"],"SKIP")
        self.assertFalse(item["data_complete"])
        self.assertEqual(item["picks"][0]["relative_score"],0.0129)
        self.assertNotIn("probability",item["picks"])

    def test_bad_shape_rejected(self):
        with self.assertRaises(ValueError):
            convert({"races":{}})

if __name__ == "__main__":
    unittest.main()
