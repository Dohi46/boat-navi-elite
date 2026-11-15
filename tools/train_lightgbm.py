"""BOAT NEXUS experimental LightGBM lane-win model. Never deploys itself."""
import glob, json, os
from datetime import datetime, timezone
from pathlib import Path

FEATURES = ["lane", "venue", "national_win_rate", "local_win_rate",
            "motor_top_2_percent", "average_start_timing", "local_top_3_percent",
            "exhibition_time"]
OUT = Path("data/models/lightgbm-status.json")

def main():
    import numpy as np
    import lightgbm as lgb
    from sklearn.metrics import log_loss, brier_score_loss
    races = []
    for filename in sorted(glob.glob("data/auto/????-??-??.json")):
        doc = json.loads(Path(filename).read_text())
        for r in doc.get("races", []):
            # Only settled races with a genuine saved pre-race feature snapshot.
            if not r.get("result") or r.get("featureSchema") != "lane-v1":
                continue
            winners = r["result"].get("winningCombinations", [])
            firsts = {str(p.get("combination", "")).split("-")[0] for p in winners}
            if len(firsts) != 1 or next(iter(firsts)) not in set("123456"):
                continue
            rows = []
            for lane in range(1, 7):
                f = r.get("features", {}).get(str(lane), {})
                row = [lane, r.get("venue")] + [f.get(k) for k in FEATURES[2:]]
                rows.append([float(v) if v is not None else np.nan for v in row])
            races.append((r["raceDate"], int(r["venue"]), int(r["race"]), rows, int(next(iter(firsts)))))
    races.sort(key=lambda x: (x[0], x[1], x[2]))
    dates = sorted({r[0] for r in races})
    status = {"updatedAt": datetime.now(timezone.utc).isoformat(), "model": "LightGBM experimental lane-win",
              "featureSchema": "lane-v1", "settledFeatureRaces": len(races), "distinctDates": len(dates),
              "activeForPredictions": False}
    # Group all races by day to avoid mixing a single day's results between train and test.
    if len(dates) < 10 or len(races) < 300:
        status.update(state="collecting_data", reason="Requires at least 300 settled feature races over 10 distinct dates")
    else:
        split = max(1, int(len(dates) * 0.8))
        train_dates = set(dates[:split])
        train = [r for r in races if r[0] in train_dates]
        test = [r for r in races if r[0] not in train_dates]
        if len(train) < 200 or len(test) < 50:
            status.update(state="collecting_data", reason="Insufficient chronological train/test split")
        else:
            X = np.array([row for r in train for row in r[3]], dtype=float)
            y = np.array([int(lane == r[4]) for r in train for lane in range(1, 7)])
            Xt = np.array([row for r in test for row in r[3]], dtype=float)
            yt = np.array([int(lane == r[4]) for r in test for lane in range(1, 7)])
            model = lgb.LGBMClassifier(n_estimators=120, learning_rate=0.035, num_leaves=7,
                                        max_depth=3, min_child_samples=30, verbosity=-1,
                                        random_state=42, n_jobs=2)
            model.fit(X, y)
            p = model.predict_proba(Xt)[:, 1].reshape(-1, 6)
            p = np.clip(p, 1e-8, None)
            p /= p.sum(axis=1, keepdims=True)
            labels = np.array([r[4]-1 for r in test])
            accuracy = float(np.mean(np.argmax(p, axis=1) == labels))
            loss = float(-np.mean(np.log(p[np.arange(len(labels)), labels])))
            baseline = np.tile(np.array([.5, .17, .12, .09, .07, .05]), (len(test), 1))
            baseline_loss = float(-np.mean(np.log(baseline[np.arange(len(labels)), labels])))
            status.update(state="evaluated_not_deployed", trainingRaces=len(train), testRaces=len(test),
                          trainingThrough=max(train_dates), testingFrom=min(r[0] for r in test),
                          top1Accuracy=round(accuracy, 4), sixWayLogLoss=round(loss, 5),
                          simpleLaneBaselineLogLoss=round(baseline_loss, 5),
                          betterThanLaneBaseline=loss < baseline_loss,
                          note="Baseline is a simple lane prior, NOT v13. No automatic model promotion.")
            # Keep experimental model separate. Never overwrite v13 or live predictions.
            Path("data/models").mkdir(parents=True, exist_ok=True)
            model.booster_.save_model("data/models/lightgbm-experimental.txt")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(status, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
