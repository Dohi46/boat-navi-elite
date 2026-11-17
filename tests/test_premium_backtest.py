import unittest
from scripts.premium_backtest import evaluate

class BacktestTests(unittest.TestCase):
    def test_settlement_recomputed_and_selector_skips(self):
        doc={"date":"2026-11-17","engine":"v13-reference-no-odds","races":[{
          "venue":1,"race":1,"raceDate":"2026-11-17",
          "cutoff":"2026-11-17 15:18:00","capturedAt":"2026-11-16T22:59:49.602Z",
          "predictionPhase":"before","picks":[{"pick":"1-2-3","probability":0.01,"stake":100}],
          "result":{"winningCombinations":[{"combination":"1-2-3","amount":2110}],"payout":99999}
        }]}
        report=evaluate(doc)
        self.assertEqual(report["baseline"]["payout"],2110)
        self.assertEqual(report["baseline"]["stake"],100)
        self.assertEqual(report["baseline"]["hit_races"],1)
        self.assertEqual(report["research_selector"]["review"],0)
        self.assertEqual(report["research_selector"]["skip"],1)
        self.assertIsNone(report["research_selector"]["return_rate_percent"])

    def test_malformed_row_does_not_shift_skip_reasons(self):
        doc={"date":"2026-11-17","races":[None,{
          "venue":1,"race":1,"raceDate":"2026-11-16",
          "cutoff":"2026-11-17 15:18:00","capturedAt":"2026-11-16T22:59:49.602Z",
          "predictionPhase":"before","picks":[{"pick":"1-2-3","stake":100}],
          "result":{"winningCombinations":[]}
        }]}
        report=evaluate(doc)
        self.assertEqual(report["research_selector"]["skip"],1)
        self.assertEqual(report["skipped_reasons"]["race date mismatch"],1)

if __name__=="__main__":
    unittest.main()
