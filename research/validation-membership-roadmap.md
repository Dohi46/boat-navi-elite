# BOAT NEXUS — staged validation and membership design
Status: research/design only. Do not change v13 prediction engine, RECORD, localStorage bn_records, or saved data/auto snapshots.

## Priorities
1. Data quality: offline integrity checks; distinguish errors, warnings and eligibility exclusions. Never silently count a post-cutoff prediction as a pre-race success.
2. Long-run performance: virtual stake, payout, ROI and coverage by calendar window. Show sample size and excluded races. No ROI guarantee.
3. Validation separation: immutable pre-race predictions; **development** dates used to choose thresholds, **future holdout** dates used only once for assessment. Freeze strategy versions before a holdout begins. Never optimize on the holdout and then report it as independent.
4. Anomaly notification: GitHub Actions failure notifications via repository settings; optionally an issue on repeated failures after reviewing permissions. Do not publish personal contact details or API keys.
5. Membership: design only until holdout performance and legal/privacy requirements are reviewed.

## Validation policy
- Existing 2026-11-15 and 2026-11-16 snapshots are exploratory/development data, not independent proof of any strategy.
- Freeze candidate classification rules and versions before evaluating dates from 2026-11-17 onward. Since some future dates may already have been seen while developing, designate a new cutoff date at deployment time and document it explicitly.
- A valid evaluation race requires pre-cutoff timestamp, intact saved picks, and verifiable settlement. Keep exclusions and reason codes visible.
- Compare each strategy with the same-day baseline on the same eligible races; report number of races, virtual stake, payout, ROI, uncertainty and coverage.
- Do not call a rule-based subset a separately trained AI.

## Monitoring checklist
- Collector scheduled run missing; report file missing; JSON malformed; duplicate race; date mismatch; settlement missing after expected completion; unexpected fall in race coverage.
- GitHub Actions failure should remain visible; enable GitHub notifications for failed workflows. Avoid unreviewed automatic retries that redownload data.
- Research checks should not block or overwrite the v13 production prediction data.

## Future membership architecture (not enabled)
- Public: current AI LAB, transparent aggregate historical results and explanations.
- Premium candidate: selectively screened forecasts and documented no-bet reasoning **only after validation**.
- Authentication and payments must use a server-side trusted service; GitHub Pages/client-side JavaScript alone cannot securely enforce paid access.
- Server verifies membership entitlement; never store payment card details in browser/localStorage or repository.
- Before launch: privacy policy, terms, refunds/cancellation, consumer and gambling-related legal review, data licenses, security review, backup/recovery and clear disclaimers.
- Pricing, membership status and billing integrations are not implemented.
