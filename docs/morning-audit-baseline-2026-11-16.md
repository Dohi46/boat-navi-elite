# BOAT NAVI ELITE — Morning v13 audit baseline

Period: 2026-11-15 to 2026-11-16 (JST). Settled stored predictions only; 254 races, 1,270 selected picks. Audit calculated from the committed data/auto JSON files.

| Metric | Value |
| --- | ---: |
| Total stake | ¥127,000 |
| Total payout | ¥106,240 |
| Net | -¥20,760 |
| Return rate | 83.65% |
| Hits / picks | 86 / 1,270 (6.77%) |
| Mean selected-pick v13 relative score | 1.366% |

## By predicted winner
| Head | Picks | Hits | Return rate |
| --- | ---: | ---: | ---: |
| 1 | 1,186 | 82 | 84.52% |
| 2 | 53 | 4 | 113.21% |
| 3 | 25 | 0 | 0% |
| 4 | 6 | 0 | 0% |
| 5-6 | 0 | 0 | N/A |

## Selected-pick score diagnostic
| v13 relative-score bin | Picks | Observed hit rate | Return rate |
| --- | ---: | ---: | ---: |
| 1.00% to <1.25% | 275 | 4.73% | 71.78% |
| 1.25% to <1.50% | 773 | 6.34% | 88.93% |
| 1.50% to <2.00% | 222 | 10.81% | 80.00% |

## Interpretation and safeguards
- v13 scores are normalized relative model weights, not calibrated real-world probabilities. Do **not** use them as probability estimates in expected-value betting.
- Selection bias: only the stored top-five predictions are evaluated, not all 120 combinations.
- Final payouts are **not** pre-race odds; historical payouts must never be used as if available at selection time.
- The head-2 subgroup is too small to infer an advantage; do not optimize on this sample.
- New odds snapshots should store capturedAt, source, venue, race, odds for each combination, and cutoff; missing or late snapshots should be excluded from any pre-race EV backtest.
- Before production adoption, calibrate on historical training periods, freeze the strategy, then validate on unseen later races with consistent stake and transaction rules.
- Read-only audit script: `node tools/audit_morning_predictions.cjs`. GitHub Actions uploads its JSON output as an artifact; it does not modify live predictions.

This is a baseline report, **not** a validated profitable strategy.
