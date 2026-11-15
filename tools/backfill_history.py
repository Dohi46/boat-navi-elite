"""Backfill historical BOAT RACE outcomes; no reconstructed pre-race features.
Writes compact race-level rows for chronological historical model training.
"""
import argparse, datetime as dt, json, time, urllib.request
from pathlib import Path
OUT=Path("data/history/race-results.json")
def parse_day(day):
    compact=day.replace("-","")
    url=f"https://boatraceopenapi.github.io/api/v1/{day[:4]}/{compact}.json"
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"BOAT-NEXUS-history-research/1.0"})
        with urllib.request.urlopen(req,timeout=18) as response:
            payload=json.load(response)
    except Exception as e:
        print(day,"unavailable",str(e)[:120],flush=True)
        return None
    stadiums=payload.get("programs",{}).get("stadiums",{})
    if not isinstance(stadiums,dict): return None
    rows=[]
    for venue,stadium in stadiums.items():
        for race_id,r in (stadium.get("races") or {}).items():
            if r.get("date")!=day: continue
            payouts=(r.get("result") or {}).get("payouts",{}).get("trifecta",[])
            if not isinstance(payouts,list) or len(payouts)!=1: continue
            combination=str(payouts[0].get("combination",""))
            lanes=combination.split("-")
            if len(lanes)!=3 or len(set(lanes))!=3 or any(x not in "123456" for x in lanes):continue
            rows.append([day,int(venue),int(race_id),int(lanes[0])])
    return rows
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--days",type=int,default=365)
    ap.add_argument("--max-fetch",type=int,default=40)
    args=ap.parse_args()
    today=dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    end=today-dt.timedelta(days=1)
    start=end-dt.timedelta(days=args.days-1)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    old=json.loads(OUT.read_text()) if OUT.exists() else {"schema":"historical-outcomes-v1","days":{}}
    # Cache only days with a successfully parsed payload; unavailable dates can retry.
    days=old["days"]
    pending=[start+dt.timedelta(days=i) for i in range(args.days)]
    pending=[str(day) for day in pending if str(day) not in days]
    # Oldest first to build a stable chronological dataset.
    for day in pending[:args.max_fetch]:
        rows=parse_day(day)
        if rows is not None:days[day]=rows
        time.sleep(.08)
    # Bound the archive to the requested window, and sort keys deterministically.
    days={k:days[k] for k in sorted(days) if str(start)<=k<=str(end)}
    OUT.write_text(json.dumps({"schema":"historical-outcomes-v1","start":str(start),"end":str(end),"days":days},ensure_ascii=False,separators=(",",":"))+"\n")
    print("archived days",len(days),"races",sum(len(v) for v in days.values()),"remaining",args.days-len(days))
if __name__=="__main__":main()
