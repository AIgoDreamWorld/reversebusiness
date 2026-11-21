# Gemini credential readiness — 2026-11-21 12:59 KST

## Scope and evidence
- Windows user environment variable `GEMINI_API_KEY`: PRESENT, NONEMPTY.
- Credential family checked as `GOOGLE_AQ` without exposing the secret.
- `OPENAI_API_KEY`: previously confirmed present in Windows User environment.
- Fresh Node.js process started with only `GEMINI_API_KEY` inherited from the user variable: credential available.
- ReverseBusiness Opportunity Lab restarted on loopback `http://127.0.0.1:4178/` with that process environment.
- `GET /api/state`: `gemini.credentialLoaded=true`, `gemini.authenticationVerified=false`, `gemini.groundingEnabled=false`, `candidates.length=10`, `searchEnabled=true`.
- `/api/state` reveals only status booleans, never the API key.
- UI displays "Gemini 키는 프로그램에 등록됨 · 실제 인증/Google 검색은 비용 검토 전 보류".
- No Google Gemini API call, paid inference, Google Search Grounding or new billing setup was performed.
- Existing `main`, canonical Golden, 7×7 axes and 10 discovered candidate URLs preserved.

## Official documentation cross-check
- Google auth keys and environment variable: https://aistudio.google.com/docs/api-key
- Google Search Grounding mechanism: https://aistudio.google.com/docs/google-search
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing

## Release gates
- **CREDENTIAL_CONFIGURED: PASS** (registered locally and loaded by Node).
- **REMOTE_AUTHENTICATION: NOT_EXECUTED** (not proof of validity).
- **GOOGLE_GROUNDED_SEARCH: BLOCKED** until WJ confirms project's Free/Paid tier and explicitly approves any potentially billable test.
- **FULL_AUTOMATIC_TEN_CANDIDATES: HOLD** (previous Tavily free keyless query cap).
- **WJ_APPROVED: NOT_CLAIMED**.

## Safe next step
User checks Google AI Studio project's pricing tier (Free vs Paid). Do not paste key into chat or console outputs. If billing-enabled API access is approved, execute only one bounded query and capture status, grounding URLs and usage; no extra retry or background calls.
