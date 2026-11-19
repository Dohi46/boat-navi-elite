# Walk-forward skip-rule experiment — 2026-11-19 snapshot

Research only. Uses settled races from `main:data/auto/2026-11-15.json` through `2026-11-19.json`; 11/19 is incomplete. For each test day, the median of the **maximum pick probability** from all earlier settled days is the threshold; select test-day races whose maximum pick probability meets it. No test-day outcomes are used to set thresholds.

| Test day | Training days | Threshold | All races | All stake | All payout | All ROI | Selected races | Selected stake | Selected payout | Selected ROI |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 11/17 | 11/15–16 | 0.0139441055 | 132 | ¥66,000 | ¥38,710 | 58.65% | 66 | ¥33,000 | ¥24,300 | 73.64% |
| 11/18 | 11/15–17 | 0.0139441055 | 120 | ¥60,000 | ¥55,800 | 93.00% | 61 | ¥30,500 | ¥26,400 | 86.56% |
| 11/19 (partial) | 11/15–18 | 0.0139478086 | 102 | ¥51,000 | ¥45,810 | 89.82% | 50 | ¥25,000 | ¥20,610 | 82.44% |
| **Combined test days** | | | **354** | **¥177,000** | **¥140,320** | **79.28%** | **177** | **¥88,500** | **¥71,310** | **80.58%** |

Difference +1.30 percentage points ROI, but still negative return; only 3 test days, including a partial day. This does **not** establish a reliable edge or profitability. Do not deploy.

Caveats: current-day settlement may change; settled-only inclusion creates time-of-day selection bias on incomplete dates. Rule uses probabilities from an engine labelled `v13-reference-no-odds`; no contemporaneous market odds to compute expected value. Multiple candidate rules must be judged on unseen later dates, not tuned to these three test days. Prefer full settled days for future reports.
