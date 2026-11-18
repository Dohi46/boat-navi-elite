"""Read-only audit of daily prediction snapshot freshness and settlement coverage."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

def audit(doc, now):
    if now.tzinfo is None:
        raise ValueError("timezone-aware now required")
    if not isinstance(doc.get("races"), list):
        raise ValueError("missing races")
    races=doc["races"]
    settled=sum(bool((r.get("result") or {}).get("winningCombinations")) for r in races)
    pending=len(races)-settled
    settlement=doc.get("settlement") or {}
    checked=settlement.get("checkedAt")
    age=None
    if checked:
        dt=datetime.fromisoformat(checked.replace("Z","+00:00"))
        age=round((now-dt).total_seconds()/60,1)
    return {"schema":"premium-daily-freshness-audit-v1","mode":"research_only",
            "date":doc.get("date"),"race_count":len(races),
            "settled_races":settled,"pending_races":pending,
            "reported_settled_races":settlement.get("settledRaces"),
            "settlement_count_consistent":settlement.get("settledRaces")==settled,
            "last_settlement_checked_at":checked,"settlement_age_minutes":age,
            "stale_over_30_minutes":age is None or age>30,
            "ready_for_premium":False}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("input",type=Path)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    result=audit(json.loads(args.input.read_text(encoding="utf-8")),datetime.now(timezone.utc))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False))

if __name__=="__main__":
    main()
