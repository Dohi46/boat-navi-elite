# Premium Research (isolated development branch)

This is an experimental selector, **not** a production prediction or paid access system.

- Existing index.html, app.js, v13 calculations and free AI LAB remain unchanged.
- Input: a manually normalized JSON array with venue, race, race_date (YYYY-MM-DD), probability (0–1), odds, odds_observed_at and cutoff_at (ISO timestamps with timezone), data_complete (boolean).
- Output: REVIEW or SKIP with reasons. REVIEW is only a research flag, not a purchase instruction.
- Missing or stale data produces SKIP. No generated predictions are published.
- Probability estimates require calibration and historical out-of-sample validation. The 1.10 expected-return threshold is a placeholder.
- Next: inspect actual data/auto schema, build a read-only adapter, and add regression tests before UI work.
- Paid predictions must not be stored in GitHub Pages/public JSON. Authentication and authorization must be server-side.
