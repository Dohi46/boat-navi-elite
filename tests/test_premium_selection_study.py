import unittest
from scripts.premium_selection_study import extract, study

def snapshot(date, payout):
    return {"date":date,"races":[{"venue":1,"race":1,"raceDate":date,
      "predictionPhase":"before","cutoff":date+" 15:00:00",
      "capturedAt":date+"T01:00:00+00:00","exhibitionCount":0,
      "features":{"1":{"motor_top_2_percent":45}},
      "picks":[{"pick":"1-2-3","probability":0.016,"stake":100}],
      "result":{"winningCombinations":[{"combination":"1-2-3","amount":payout}]}}]}

class SelectionStudyTests(unittest.TestCase):
    def test_chronological_split(self):
        r=study([snapshot("2026-11-18",0),snapshot("2026-11-17",2100)],"2026-11-17")
        self.assertEqual(r["conditions"]["all"]["train"]["return_rate_percent"],2100)
        self.assertEqual(r["conditions"]["all"]["holdout"]["return_rate_percent"],0)
        self.assertEqual(r["holdout_days"],["2026-11-18"])

    def test_post_cutoff_excluded(self):
        d=snapshot("2026-11-17",2100)
        d["races"][0]["capturedAt"]="2026-11-17T16:00:00+09:00"
        self.assertEqual(extract(d),[])

    def test_duplicate_dates_rejected(self):
        with self.assertRaises(ValueError):
            study([snapshot("2026-11-17",100),snapshot("2026-11-17",200)],"2026-11-17")

if __name__=="__main__":
    unittest.main()
