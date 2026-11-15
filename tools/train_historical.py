"""Experimental historical venue/lane model; never used for live picks."""
import json, math
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import lightgbm as lgb
SRC=Path("data/history/race-results.json")
OUT=Path("data/models/historical-status.json")
def main():
    data=json.loads(SRC.read_text()) if SRC.exists() else {"days":{}}
    days=data.get("days",{})
    races=sorted([row for rows in days.values() for row in rows],key=lambda r:(r[0],r[1],r[2]))
    valid_days=sorted({r[0] for r in races})
    status={"updatedAt":datetime.now(timezone.utc).isoformat(),"model":"LightGBM historical venue/lane baseline",
            "source":"historical results only; no reconstructed racer statistics","archivedDays":len(days),
            "raceCount":len(races),"activeForPredictions":False}
    if len(valid_days)<30 or len(races)<1000:
        status.update(state="collecting_data",reason="Requires 30 distinct result dates and 1000 races")
    else:
        split=int(len(valid_days)*.8)
        train_dates=set(valid_days[:split])
        train=[r for r in races if r[0] in train_dates]
        test=[r for r in races if r[0] not in train_dates]
        def make(rows):
            return np.asarray([[int(lane),int(r[1])] for r in rows for lane in range(1,7)],dtype=float)
        X=make(train);y=np.asarray([int(lane==r[3]) for r in train for lane in range(1,7)])
        Xt=make(test)
        model=lgb.LGBMClassifier(n_estimators=100,learning_rate=.04,num_leaves=7,max_depth=3,
                                  min_child_samples=100,verbosity=-1,random_state=42,n_jobs=2)
        model.fit(X,y)
        p=np.clip(model.predict_proba(Xt)[:,1].reshape(-1,6),1e-9,None)
        p=p/p.sum(axis=1,keepdims=True)
        winners=np.asarray([r[3]-1 for r in test])
        accuracy=float(np.mean(np.argmax(p,axis=1)==winners))
        loss=float(-np.mean(np.log(p[np.arange(len(test)),winners])))
        lane1=float(np.mean(winners==0))
        status.update(state="evaluated_not_deployed",trainingRaces=len(train),testRaces=len(test),
                      trainingThrough=max(train_dates),testingFrom=min(r[0] for r in test),
                      top1Accuracy=round(accuracy,4),lane1BaselineAccuracy=round(lane1,4),
                      sixWayLogLoss=round(loss,5),
                      note="Venue and lane only. No historical racer features, no v13 equivalence, no live use.")
        Path("data/models").mkdir(parents=True,exist_ok=True)
        model.booster_.save_model("data/models/historical-lane-experimental.txt")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(status,ensure_ascii=False))
if __name__=="__main__":main()
