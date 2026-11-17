import unittest
from scripts.premium_dashboard_report import summarize

def doc(date, result):
    return {"date":date,"races":[{"venue":1,"race":1,"raceDate":date,
      "predictionPhase":"before","cutoff":date+" 15:00:00",
      "capturedAt":date+"T01:00:00+00:00","exhibitionCount":0,
      "features":{"1":{"motor_top_2_percent":20}},
      "picks":[{"pick":"1-2-3","probability":0.01,"stake":100}],
      "result":{"winningCombinations":[{"combination":"1-2-3","amount":result}]}}]}

class DashboardTests(unittest.TestCase):
    def test_aggregates_only_and_not_ready(self):
        r=summarize([doc("2026-11-17",2100)],14)
        self.assertEqual(r["baseline"]["payout"],2100)
        self.assertEqual(r["daily"][0]["date"],"2026-11-17")
        self.assertEqual(r["daily"][0]["payout"],2100)
        self.assertEqual(r["conditions"][0]["skip_races"],0)
        self.assertFalse(r["ready_for_premium"])
        self.assertFalse(r["enough_days_for_research"])
        self.assertFalse(r["conditions"][0]["sample_sufficient_for_review"])
        self.assertIsNotNone(r["conditions"][0]["sample_warning"])
        self.assertNotIn("picks",str(r))
        self.assertNotIn("1-2-3",str(r))
    def test_daily_totals_match_baseline(self):
        r=summarize([doc("2026-11-17",2100),doc("2026-11-18",0)])
        self.assertEqual(sum(d["stake"] for d in r["daily"]),r["baseline"]["stake"])
        self.assertEqual(sum(d["payout"] for d in r["daily"]),r["baseline"]["payout"])
        self.assertEqual(r["snapshot_days"],2)

    def test_selected_and_excluded_partition_baseline(self):
        first=doc("2026-11-17",2100)
        second=doc("2026-11-18",0)
        first["races"][0]["features"]["1"]["motor_top_2_percent"]=45
        r=summarize([first,second])
        cond=next(c for c in r["conditions"] if c["name"]=="lane1_motor_at_least_40")
        self.assertEqual(cond["selected_races"],1)
        self.assertEqual(cond["excluded_baseline"]["selected_races"],1)
        self.assertEqual(cond["stake"]+cond["excluded_baseline"]["stake"],r["baseline"]["stake"])
        self.assertEqual(cond["payout"]+cond["excluded_baseline"]["payout"],r["baseline"]["payout"])
        self.assertEqual(cond["roi_delta_vs_all_percentage_points"],1050.0)

    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            summarize([doc("2026-11-17",0),doc("2026-11-17",0)])

if __name__=="__main__":
    unittest.main()
