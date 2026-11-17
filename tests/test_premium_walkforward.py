import unittest
from scripts.premium_walkforward import walkforward
def snapshot(date, payout):
    return {"date": date, "races": [{
        "venue": 1, "race": 1, "raceDate": date,
        "predictionPhase": "before", "cutoff": date + " 15:00:00",
        "capturedAt": date + "T01:00:00+00:00",
        "picks": [{"pick": "1-2-3", "stake": 100, "probability": 0.016}],
        "result": {"winningCombinations": [{"combination": "1-2-3", "amount": payout}]}
    }]}

class WalkForwardTests(unittest.TestCase):
    def test_training_never_contains_evaluation_day(self):
        report=walkforward([snapshot("2026-11-17",2100),
                            snapshot("2026-11-18",0),
                            snapshot("2026-11-19",2100)],min_train_days=2)
        self.assertEqual(report["fold_count"],1)
        self.assertEqual(report["evaluation_days"],1)
        self.assertEqual(report["evaluation_settled_races"],1)
        self.assertFalse(report["enough_holdout_for_review"])
        self.assertIsNotNone(report["holdout_warning"])
        fold=report["folds"][0]
        self.assertEqual(fold["evaluation_date"],"2026-11-19")
        self.assertEqual(fold["train_dates"],["2026-11-17","2026-11-18"])
        self.assertEqual(fold["conditions"]["all"]["evaluation"]["settled_races"],1)

    def test_insufficient_history_is_not_success(self):
        report=walkforward([snapshot("2026-11-17",2100)],min_train_days=14)
        self.assertEqual(report["fold_count"],0)
        self.assertEqual(report["evaluation_days"],0)
        self.assertFalse(report["enough_holdout_for_review"])
        self.assertFalse(report["ready_for_premium"])

    def test_invalid_date_rejected(self):
        with self.assertRaisesRegex(ValueError,"invalid snapshot date"):
            walkforward([snapshot("2026-11-31",0)],1)

    def test_duplicate_dates_rejected(self):
        with self.assertRaises(ValueError):
            walkforward([snapshot("2026-11-17",0),snapshot("2026-11-17",0)],1)

if __name__=="__main__":
    unittest.main()
