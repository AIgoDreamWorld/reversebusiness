# Opportunity Lab v0.1 — cross-checked interactive MVP

**Date:** 2026-11-21 KST. **Branch:** `feat/opportunity-lab-v1`.
**Project:** `reversebusiness`. **Scope:** new standalone modules; upstream original and approved Golden 7×7 unchanged.

## User flow (live local app)
1. Enter a business/content idea or an original URL; choose service, content, or both.
2. Search for up to ten candidates (only when `TAVILY_API_KEY` is configured) **or** paste up to ten evidence URLs.
3. Store candidate URL, retrieved summary, discovery timestamp; avoid duplicates and excluded prior rounds.
4. Open any candidate; enter source URL and note for each original 7×7 axis: Who / What / Where / Market / How / Pricing / Niche.
5. Mark URL+claim as **SOURCED** only, never independent **VERIFIED** merely because the user typed a URL or a search snippet exists. Full independent validation remains a later research step.
6. Generate up to three **strategy drafts**, with each candidate's 7-axis state, missing evidence, 30/60/90-day research plan and conservative/base/optimistic qualitative scenarios. No invented sales forecasts.
7. Enter WJ rejection reason. Preserve previous candidate identities and reasons, start the next round, and prevent reintroducing excluded URLs without a separate new evidence workflow.
8. Export the current round as JSON. Local snapshots are saved under `experiments/opportunity-lab/` and excluded from Git.

## Run (Windows / Node 18+)
```powershell
node bin/opportunity-lab.mjs
# Browser: http://127.0.0.1:4178/
```
External search is **disabled unless** the user explicitly supplies `TAVILY_API_KEY` to the process environment. When enabled, pressing the search button makes a call to the provider and may consume paid credits. No API key is embedded or committed. API provider search snippets are discovered leads, not proof of claims.

## What is NOT verified or implemented
- Fully automatic deep research of ten sites and independent per-claim cross-verification: **NOT_IMPLEMENTED**. Current search API discovers URLs; follow-up citations require explicit examination.
- Exact trend dataset retrieval or forecast: **NOT_IMPLEMENTED**. Trend defaults UNKNOWN. No Google Trends values are simulated.
- A true three-way diversity optimizer: **NOT_IMPLEMENTED**. Three rank-labeled roles are assigned to the top candidates; automatic market differentiation is not yet validated.
- WJ final approval or autonomous publishing: **NOT_IMPLEMENTED**. Explicit reject and history are available; approval action deliberately does not grant production authorization.
- External visibility: **NOT_DEPLOYED**. Server binds only 127.0.0.1.
- End-to-end search-provider live requests: **NOT_EXECUTED** without provider key. No external paid calls.
- No unverified conversion, audience, revenue or margin values should be treated as measured.
- Raw REA report and other project files remain preserved and are not consumed or overwritten by this app.

## Cross-verification sources
- Strategyzer, evidence strength and willingness to pay: https://www.strategyzer.com/library/how-strong-is-your-innovation-evidence
- Google Trends relative 0–100 scores: https://support.google.com/trends/answer/4365533?hl=ko
- YouTube Data API request cost / returned statistics: https://developers.google.com/youtube/data/determine_quota_cost
- Tavily search provider guidance: https://help.tavily.com/articles/7879881576-optimizing-your-query-parameters
- GitHub required checks before merge: https://docs.github.com/en/pull-requests/reference/status-checks

## Tests
`node --test test/opportunity.test.mjs` checks limits, source validity, no hallucinated evidence, HOLD rules, 3-draft output, rejection memory and iteration constraints. `npm test` runs upstream and new tests. Local HTTP smoke is used to check page load, manual discovery, draft recommendations and rejection/research iteration.

## Next hardening target
Automatically inspect discovered public pages, attach citations, distinguish original publisher vs. independent sources, and require independent customer evidence for Who and Niche. Only then can candidate selection be considered validated. Never raise an UNKNOWN result to PASS because the UI looks complete.
