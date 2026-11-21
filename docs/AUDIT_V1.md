# AIBA evidence audit v0.1 (experimental)

An opt-in audit layer for the upstream ReverseBusiness v0.6.0 report; upstream files and the Golden 7횞7, 3횞3 and REA workflows are untouched.

## Scope
- Reuses upstream `checkReport` (required summary and evidence ledger).
- Reads the adjacent `source.json` for explicit newsletter / no-account statements.
- If an observed `signup` step is only a generic Sign Up CTA while source evidence suggests newsletter, blocks approval as `POTENTIAL_SIGNUP_MISCLASSIFICATION`.
- Refuses final approval with unverified terms. It never automatically changes `robots-only` to `checked`.
- Cannot verify actual clicks, account creation, contractual prices, commercial success, or legal rights. A `PASS` here is only structural evidence-audit status, never production approval.

## Run
```powershell
node scripts/evidence-audit.mjs path/to/report.json path/to/source.json --dissect-only
node --test test/evidence-audit.test.mjs
npm test
```

Exit codes: 0 for no blockers; 1 for HOLD; 2 for parsing/usage failure. Warnings are shown separately.

## The Dor Brothers controlled case (2026-11-21)
Original input (outside repository) from public surface+REA browser flow read: 1 page, 12 observed claims, 4 unknown.
Its published public page source includes both "No account, no mailing list. Just the brief." and "Sign up with your email address to receive news and updates."
`evidence-audit` returns HOLD for three independent reasons:
- `UPSTREAM_VALIDATION_ERROR`: empty `meta.one_line`
- `POTENTIAL_SIGNUP_MISCLASSIFICATION`: account signup not verified; newsletter CTA may be mislabeled
- `TERMS_NOT_VERIFIED`: robots-only is not a terms review

This safeguard is deliberately conservative. Fix descriptions from verified evidence rather than removing checks. The 7횞7 business opportunity analysis and actual rendering/building are out of scope.
