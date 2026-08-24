# Frontier Safety Briefing operations

## Publication model

The website is the canonical record. A reviewed edition JSON renders into four synchronized surfaces:

- the current HTML page
- an immutable dated HTML and JSON archive
- X copy
- LinkedIn copy

The SHA-256 value is derived from canonical edition JSON. Current and archived JSON must match byte-for-meaning after parsing.

## Daily source check

GitHub Actions runs the curated source check at 15:30 UTC. It fetches only registered URLs, removes script and style content, normalizes text, and compares SHA-256 fingerprints with the last reviewed state.

Codex automation `frontier-safety-daily-publication` runs the reviewed publication workflow daily at 08:00 local time. It remains silent on no-change runs and requests action-time confirmation before any X or LinkedIn post.

- No change: the job makes no repository edit, edition, social draft, or no-change log.
- Source change: the job preserves a short-lived review artifact. It does not turn changed page text into a factual claim.
- Fetch error: the last valid edition remains live. An error does not overwrite source state.
- Reviewed edition: a manual workflow dispatch can render, test, and commit one reviewed JSON edition. Identical input creates no commit.

## Review procedure

1. Read the changed first-party source in full.
2. Record event time, publication time, and observation time separately.
3. Identify the source role.
4. Draft the smallest supported change.
5. Add a `does_not_prove` boundary.
6. Check pending independent reviews through the reviewers' own sites.
7. Add a correction entry if the new record changes a prior claim.
8. Build twice and confirm idempotence.
9. Run targeted tests, full tests, link checks, metadata checks, and a secret/private-path scan.
10. Publish the website before social copy.

## Social distribution state

The generator writes edition-matched drafts under `frontier-safety/social/`. X and LinkedIn are external publication surfaces, not the record of truth.

Before posting:

- confirm the live page resolves to the edition hash
- recheck the account and existing posts for an exact edition collision
- post once through an authenticated supported control
- record the final post URL

If authentication, account state, rate limits, or platform controls are unavailable, leave the draft unposted and record that exact state. Do not claim publication and do not retry in a loop.

## Corrections

Corrections are append-only. A corrected edition adds a correction entry describing the earlier text, the new evidence, and the replacement. The dated archive remains addressable.

## Initial receipt

- Edition: 2026-08-24
- Local edition hash: `c8ca79052d804290c7143e014fbdba03a89263d3babbc5e248f73d0359054fa4`
- Website feature commit: `b786d2f3d9153f1feba42c64d618f728c39788d3`
- Integration state: held because the inherited site baseline has two Behavior-Transform metadata failures outside this workstream
- Pull request: pending
- Pages build: pending
- X post: not posted
- LinkedIn post: not posted
