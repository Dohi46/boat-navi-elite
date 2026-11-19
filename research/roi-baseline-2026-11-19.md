# BOAT NEXUS — ROI baseline (2026-11-19)

Read-only research; **no changes to production predictions, betting recommendations, or free AI LAB**.

## Source and scope
GitHub `main:data/auto/YYYY-MM-DD.json` for 2026-11-15 through 2026-11-19. Count only races with nonempty `result.winningCombinations`. For each settled race, stake = sum of `picks[].stake`; payout = sum over matching trifecta picks of `winningCombinations[].amount * stake / 100`, rounded per pick. These are hypothetical 100-yen-unit payouts, not actual wagering. 2026-11-19 is incomplete at the snapshot.

| Date | Settled races | Hypothetical stake | Hypothetical payout | ROI |
|---|---:|---:|---:|---:|
| 2026-11-15 | 134 | ¥67,000 | ¥57,090 | 85.21% |
| 2026-11-16 | 120 | ¥60,000 | ¥49,150 | 81.92% |
| 2026-11-17 | 132 | ¥66,000 | ¥38,710 | 58.65% |
| 2026-11-18 | 120 | ¥60,000 | ¥55,800 | 93.00% |
| 2026-11-19 (partial) | 102 | ¥51,000 | ¥45,810 | 89.82% |
| **Total** | **608** | **¥304,000** | **¥246,560** | **81.11%** |

## Race-number exploratory grouping
| Race number | Settled | ROI |
|---|---:|---:|
| 1R | 44 | 70.68% |
| 2R | 49 | 91.18% |
| 3R | 52 | 104.54% |
| 4R | 50 | 70.76% |
| 5R | 48 | 50.29% |
| 6R | 48 | 90.96% |
| 7R | 53 | 93.74% |
| 8R | 54 | 62.74% |
| 9R | 52 | 86.19% |
| 10R | 52 | 90.85% |
| 11R | 54 | 88.15% |
| 12R | 52 | 70.35% |

## Next research steps
1. Verify settled/pending and canceled race accounting; do not treat pending as losses.
2. Expand history, freeze train/test boundaries by date, and test skip criteria on **later unseen dates**.
3. Compare always-bet baseline vs skip rules on ROI, net payout, volume, drawdown, and uncertainty. Do not select rules on the same sample used to report their performance.
4. Validate inputs available **before** race time; prohibit post-result leakage.
5. Keep any premium selection logic isolated from free AI LAB and production until reviewed.

**Caution:** Five days, with one partial day, are insufficient to claim an edge or reliable positive expected return. No guaranteed profits.
