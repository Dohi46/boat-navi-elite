import unittest
from datetime import datetime, timezone
from scripts.premium_daily_freshness import audit

class FreshnessAuditTests(unittest.TestCase):
    def test_stale_partial_settlement(self):
        now=datetime(2026,11,18,13,8,tzinfo=timezone.utc)
        doc={"date":"2026-11-18","races":[{"result":{"winningCombinations":[{"combination":"1-2-3","amount":1000}]}},{"result":None}],
             "settlement":{"settledRaces":1,"checkedAt":"2026-11-18T12:22:00Z"}}
        report=audit(doc,now)
        self.assertEqual(report["pending_races"],1)
        self.assertTrue(report["stale_over_30_minutes"])
        self.assertTrue(report["settlement_count_consistent"])
        self.assertFalse(report["ready_for_premium"])

    def test_detect_inconsistent_counts(self):
        report=audit({"races":[{"result":None}],"settlement":{"settledRaces":1}},
                     datetime(2026,11,18,tzinfo=timezone.utc))
        self.assertFalse(report["settlement_count_consistent"])

if __name__=="__main__":
    unittest.main()
