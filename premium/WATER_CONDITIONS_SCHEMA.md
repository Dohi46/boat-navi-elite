# Water conditions research data contract (not yet connected)

Keep each weather observation as an append-only independent record, keyed by
`race_date`, `venue`, `race`, `observed_at`, and `source`.

Required pre-race fields:
- `race_date`: YYYY-MM-DD in Japan local time
- `venue`: official 1–24 venue number
- `race`: 1–12
- `observed_at`: ISO 8601 timestamp with timezone
- `source`: source identifier and retrieval provenance
- `wind_direction`: observed direction, with unit/convention documented
- `wind_speed_m_s`: nonnegative m/s or null when unavailable
- `wave_height_cm`: nonnegative cm or null when unavailable

Join only when `observed_at < cutoff` and observation belongs to the same
venue, race and race date. Never backfill post-race measurements into a
pre-race prediction. Store missing values explicitly and report coverage.

**Current status:** No verified historical water observations are connected.
Weather-based selection remains disabled; do not fabricate measurements.
