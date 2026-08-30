# Frontier Safety Briefing operations

## Publication model

The website is the canonical record. A reviewed edition JSON renders into four synchronized surfaces:

- the current HTML page
- an immutable dated HTML and JSON archive
- X copy
- LinkedIn copy

The SHA-256 value is derived from canonical edition JSON. Current and archived JSON must match byte-for-meaning after parsing.

Incident notices on the daily digest cite the canonical incident briefing only. The briefing's source manifest and build receipt carry the underlying developer statements, affected-party telemetry, independent analysis, and procedural records. This keeps source roles distinct and prevents the routing surface from collapsing heterogeneous evidence into a single label.

## Scheduled monitoring

GitHub Actions runs the curated source check at 15:30 UTC. The monitoring job has `contents: read` permission, does not persist checkout credentials, and cannot commit or push. It fetches only registered URLs, applies the registered normalization profile, and compares SHA-256 fingerprints with the last reviewed source state.

Codex automation `frontier-safety-daily-publication` runs an operator review daily at 08:00 local time. It remains silent on no-change runs and requests action-time confirmation before any X or LinkedIn post. It does not grant repository write permission or publish an edition. Website publication requires the manual dispatch described below.

- No change: the job makes no repository edit, edition, social draft, or no-change log.
- Source change: the job preserves a short-lived review artifact. It does not turn changed page text into a factual claim.
- Unbaselined source: the job marks the new active source as review-required and preserves the review artifact even when no existing-source fingerprint changed.
- Fetch error: the last valid edition remains live. An error does not overwrite source state.

The monitor exports changed, fetch-error, unbaselined, and review-required counts. Any nonzero count preserves the source-review packet. Monitoring never advances `frontier-safety/data/source-state.json`. That file represents a reviewed baseline, not the latest unattended fetch. After a normal edition publishes, a reviewer advances source state from the accepted, error-free review packet in a separate reviewed change. Until that transition is accepted, monitoring can continue to report the same source delta. A fetch-error report must never become reviewed state.

## Manual reviewed publication

Publication is a separate `workflow_dispatch` path. Its job has the minimal `contents: write` permission needed for the final repository push. Checkout credentials remain disabled through input scanning, rendering, tests, reproducibility comparison, staging, and staged-artifact scanning. The workflow exposes `GITHUB_TOKEN` only to the final push step through an ephemeral Git credential helper.

Before a normal publication:

1. Commit the reviewed edition JSON under `frontier-safety/data/editions/` through the normal review path.
2. Dispatch the workflow with `publish_reviewed_edition=true` and `publication_mode=normal`.
3. Confirm the source check reports at least one changed existing source, zero fetch errors, zero unbaselined sources, and exactly the same review-required count as changed count. The publication gate rejects any other combination, including one changed existing source plus one new source.
4. Confirm the rendered edition makes a material change. Identical output creates no commit or push.

The workflow pins every GitHub Action to an immutable commit SHA and names the readable release in a comment. Python validation dependencies are version-pinned. The build must reproduce every generated current HTML, archived HTML and JSON, current JSON, history JSON, and social draft byte for byte before a publication commit is allowed.

The publication workflow has no reviewed-baseline receipt bypass. A reviewer can accept a successful new fingerprint into source state with the source checker's explicit `--accept-reviewed SOURCE_ID` path, but that state transition occurs in a separate reviewed change and does not authorize edition publication. If a proposed edition depends only on a newly registered source, normal publication remains fail-closed until a separately designed and tested receipt contract exists. Do not use correction mode to bypass that boundary.

## Review procedure

1. Read the changed first-party source in full.
2. Record event time, publication time, and observation time separately.
3. Identify the source role.
4. Draft the smallest supported change.
5. Add a `does_not_prove` boundary.
6. Check pending independent reviews through the reviewers' own sites.
7. Add a correction entry if the new record changes a prior claim.
8. Build twice and confirm idempotence.
9. Run targeted tests, full tests, link checks, metadata checks, reproducibility comparison, and the public-artifact credential scan.
10. Publish the website before social copy.

## Credential and public-artifact gate

The workflow scans the reviewed edition input before rendering. Correction mode also scans the recorded correction reason. After rendering, it scans every staged public artifact before commit. Findings block publication without printing the matched secret value.

The scanner covers private-key headers, GitHub, OpenAI, AWS, Google, Slack, Hugging Face, and Stripe credential formats, plus credential-like assignments such as API keys, access tokens, client secrets, and passwords. Explicit placeholders such as `[REDACTED]`, `null`, and environment-variable references remain valid so documentation can describe safe secret handling without creating known false positives.

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

Dispatch a correction with `publication_mode=correction`, `edition_state=correction`, a non-empty public `corrections` entry, and a recorded `correction_reason`. The gate normalizes and scans the reason, then records it in the publication commit body. Correction mode does not require a fresh source delta and can proceed while a monitored source has a fetch error, because correcting a known public record must not depend on an unrelated fetch. The reviewed correction evidence still has to support the edition itself.

## 2026-08-24 Hugging Face false-positive review

The Hugging Face technical timeline produced an apparent fingerprint delta when dynamic engagement and discussion content changed. Review found that those surfaces were outside the article record. The registered `huggingface_blog_article` profile now fingerprints the article container while excluding engagement elements and content outside that container. A same-day recheck recorded zero changed source IDs and zero fetch-error IDs after the profile was applied.

This was a monitoring false-positive review, not a new factual development. It did not create or justify a new Frontier Safety edition. The 2026-08-24 baseline remains the recorded edition.

## Initial receipt

- Edition: 2026-08-24
- Local edition hash: `c8ca79052d804290c7143e014fbdba03a89263d3babbc5e248f73d0359054fa4`
- Website feature commit: `b786d2f3d9153f1feba42c64d618f728c39788d3`
- Publication-integrity commit: `3b99be84dbbba327209cbc68ad3bfc6f6de29764`
- Integration state: held because the inherited site baseline has two Behavior-Transform metadata failures outside this workstream
- Pull request: draft [#140](https://github.com/HarperZ9/HarperZ9.github.io/pull/140)
- Pages build: pending
- X post: not posted
- LinkedIn post: not posted

## 2026-08-25 correction publication receipt

- Edition: 2026-08-25
- Observation time: `2026-08-25T15:06:19Z`
- Correction state: reviewed correction; the 2026-08-24 dated archive and hash remain unchanged
- Live edition target: [https://harperz9.github.io/frontier-safety.html](https://harperz9.github.io/frontier-safety.html)
- Edition hash: `0034b2bcf37697e96bee6c271057b15820c23ef4f8f52746bd630b933f07fe2d`
- Reviewed edition commit: `abdb8f4995142bc2d6372e43a7641e0cd93c5b33`
- Social receipt schema commit: `960900a767017aa8e6e71eba147241b93b50a55a`
- Social URL integrity commit: `458de2f79de43413cf397ee3ab0efae36fb8a908`
- Pull request: [#143](https://github.com/HarperZ9/HarperZ9.github.io/pull/143)
- Merge receipt: GitHub PR #143 records the final merge commit and merge time; pending at the time this pre-publication receipt was committed
- Pages build receipt: the repository's Pages deployment for the PR #143 merge commit; pending at the time this pre-publication receipt was committed
- Live hash verification: required after the Pages build succeeds; pending at the time this pre-publication receipt was committed
- Reviewed source-state baseline: content unchanged at Git blob `9193e6231401017d31e266bf73e11023f095cd50`; canonical LF file SHA-256 `59306c296fcc8f1b0ae77cdc187d9fbc5768ef6e1fb7c8bae7d193409684fb42`; acceptance of the new source fingerprint remains a separate reviewed change
- X post: not posted; edition-matched draft retained
- LinkedIn post: not posted; edition-matched draft retained

## 2026-08-27 publication receipt

- Edition: 2026-08-27
- Observation time: `2026-08-27T15:34:57Z`
- Publication state: reviewed changed edition; no correction to the 2026-08-24 or 2026-08-25 archives
- Live edition target: [https://harperz9.github.io/frontier-safety.html](https://harperz9.github.io/frontier-safety.html)
- Dated archive target: [https://harperz9.github.io/frontier-safety/archive/2026-08-27.html](https://harperz9.github.io/frontier-safety/archive/2026-08-27.html)
- Edition hash: `f587cc7c074b5dcf93b5bbcf03a525cec69b9c29b0524b45b1548a5624374b3e`
- Reviewed content commits: `013876f0fc3a8c824e23f0f0d99f1c82b59d1835`, `7b3519d1ed6b2fe313d6fd7abfbcd273d42c6983`, and integrity commit `e7027d3`
- Main reconciliation merge: `2c562d5bb8949e67563f248e1e97e607270d3572`
- Pull request: [#150](https://github.com/HarperZ9/HarperZ9.github.io/pull/150)
- Source review: the 2026-08-28 curated check ran once at `2026-08-28T15:05:40Z`; three OpenAI fingerprint deltas were reviewed as nonmaterial, the OpenAI Private Safety Processing preview received its first reviewed baseline, the published METR and Redwood case analysis replaced the announcement placeholder, and Anthropic's August risk report now fingerprints the exact PDF bytes. The NVD extraction error did not overwrite its last valid baseline.
- Independent-review boundary: the METR and Redwood report is recorded as a scoped case analysis under its stated evidence and engagement conditions, not as proof of every claim or control outcome.
- Reproducibility: the deterministic generator produced identical output on two consecutive runs; the 2026-08-24 and 2026-08-25 archives remained byte-reproducible.
- Verification: 178 targeted Frontier Safety and deployment tests passed; the full suite passed 339 tests with one unrelated inherited Retro media-manifest size mismatch; 866 internal links across 131 pages had zero failures; public credential, private-path, claim-language, archive-discovery, accessibility, and diff gates passed.
- Visual review: current and dated-archive pages passed Chrome desktop and responsive inspection with no horizontal overflow, visible methodology caption, and working keyboard navigation. The requested 390-pixel override rendered at Chrome's actual 520 CSS-pixel minimum; that exact limitation is retained rather than claiming a 390-pixel surface.
- Merge receipt: the final merge commit and merge time are recorded by PR #150; pending at the time this pre-publication receipt was committed.
- Pages build receipt: the Pages deployment associated with the PR #150 merge; pending at the time this pre-publication receipt was committed.
- Live hash verification: required after Pages succeeds; pending at the time this pre-publication receipt was committed.
- 2026-08-28 decision: no new edition. Anthropic's August 27 Model Hardware Standard research preview is material but newly observed and unbaselined, so the normal publication gate remains fail-closed.
- X destination: `@zaindanaharper` (`ZentropyLabs.ai`); exact-edition local records show no post receipt; draft retained and not posted pending action-time confirmation.
- LinkedIn destination: `Zain Harper`; exact-edition local records show no post receipt; draft retained and not posted pending action-time confirmation.

## 2026-08-28 OpenAI / Hugging Face incident long-form receipt

- Publication type: public-safe long-form writing page and visual control-plane diagram, not a new dated Frontier Safety digest edition.
- Live article target: [https://harperz9.github.io/frontier-safety-openai-hugging-face-incident.html](https://harperz9.github.io/frontier-safety-openai-hugging-face-incident.html)
- Live writing-index target: [https://harperz9.github.io/writing.html](https://harperz9.github.io/writing.html)
- Live diagram target: [https://harperz9.github.io/img/diagrams/frontier-safety-incident-control-plane.svg](https://harperz9.github.io/img/diagrams/frontier-safety-incident-control-plane.svg)
- Source roles: OpenAI self-report and technical report, Hugging Face affected-party disclosure, and METR independent investigation report are cited separately in the article body.
- Public-safety boundary: the article intentionally stays at control categories and omits live bypass corpora, exploit chains, payloads, credentials, hostnames, target-specific techniques, and affected-version details.
- Feature commit: `1e417436e1ed02ceab36dd88c6715fc6a6289217`
- Pull request: [#157](https://github.com/HarperZ9/HarperZ9.github.io/pull/157)
- Merge commit: `7702a4c6b359c3d3e6e877e0ce93955b710d06e6`
- CI receipt: GitHub Actions run `33207890445`, `CI / static-site`, succeeded on merge commit `7702a4c6b359c3d3e6e877e0ce93955b710d06e6`.
- Pages receipt: GitHub Actions run `33207889297`, `pages-build-deployment`, succeeded on merge commit `7702a4c6b359c3d3e6e877e0ce93955b710d06e6`.
- Local verification before merge: `python -m pytest` passed `374` tests; `git diff --check` passed; Python Playwright rendered the article at desktop and mobile widths with the article loaded, source links present, diagram alt present, no horizontal overflow, and no page errors.
- Live verification after Pages deployment: article, writing index, all three Markdown article parts, and SVG diagram returned HTTP `200`; live article shell contained the title and diagram link; live Markdown parts contained the `warning shot` framing, public-safety boundary, and source links.
- Social distribution: no X or LinkedIn post was made in this receipt. Social derivatives remain a separate representational-publication step.

## 2026-08-30 NVD monitor repair receipt

- Trigger: scheduled run `33319946864` recorded four OpenAI HTTP 403 responses and an NVD `nvd_vulnerability_detail container not found` error. The monitor correctly published nothing and did not advance reviewed state.
- Reproduction: a fresh local run at `2026-08-30T22:14:55Z` reached all OpenAI sources. It reproduced only the NVD failure and recorded two still-unreviewed OpenAI fingerprint deltas. The four earlier OpenAI 403 responses are therefore treated as transient fetch failures, not accepted content state.
- Root cause: the NVD vulnerability-detail route returned a 2,445-byte NVD home document to the unattended client instead of the registered vulnerability container.
- Repair: the public reading URL remains `https://nvd.nist.gov/vuln/detail/CVE-2025-3248`, while the fingerprint route now uses NVD's official CVE API at `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2025-3248`.
- Fingerprint contract: the `nvd_cve_api` profile requires exactly one well-formed CVE record, canonicalizes object-key order and formatting, and excludes request-time transport metadata such as the API response timestamp. A substantive record edit still changes the fingerprint.
- Source review: the reviewed API response returned exactly one record, `CVE-2025-3248`, status `Analyzed`, published `2025-04-07T15:15:44.897`, last modified `2026-07-14T23:17:27.010`. Its English description concerns Langflow versions before 1.3.0 and an unauthenticated code-injection condition. The source remains context-only, and no current public briefing text depends on that CVE record.
- Adapter commit: `f288640`.
- Reviewed baseline transition: only `nvd-cve-2025-3248` was accepted at `2026-08-30T22:20:46Z`; its canonical API-record SHA-256 is `340c5961a3a7119e85e464563cad0c8452ca6cfd9fb886734f69a3fe594dd440` over 3,791 normalized characters. The two OpenAI deltas were not accepted.
- Post-transition check: `2026-08-30T22:21:10Z`, zero fetch errors, zero unbaselined sources, and two review-required deltas: `openai-pacing-model-development` and `openai-private-safety-processing-preview`.
- Verification: the focused source-checker suite passed 91 tests; the complete Python suite passed 413 tests; the live full-registry check returned zero errors.
- Publication state: no new digest, correction, social post, or reviewed OpenAI baseline was created by this repair.

## 2026-08-30 OpenAI cloud-runner monitor repair receipt

- Correction to the earlier provisional diagnosis: post-merge monitor run `33339098303` reproduced HTTP 403 responses for all four OpenAI article routes on commit `2dfdcf5bb2a3394876d866beaf2ff5e5eef3d86c`. The responses are persistent for GitHub-hosted runners, not transient source failures.
- Boundary diagnosis: branch-only run `33339213754` on commit `4b0aed409217e0a70368b8786300338b9b8d2fb2` tested the monitor user agent and a browser user agent, with and without a trailing slash and with an explicit locale. Every article route returned HTTP 403. OpenAI's `robots.txt`, sitemap index, and RSS feed returned HTTP 200 from the same `westus3` runner under both user agents. This isolates the failure to OpenAI's article-route policy for that runner environment, not the article parser or request headers.
- Repair contract: public reading links remain the exact OpenAI article URLs. Unattended fingerprints now use OpenAI's first-party `security` or `company` sitemap and select exactly one canonical article entry. The `openai_sitemap_entry` profile requires a unique canonical URL, a `lastmod` value, and well-formed alternate-language links, then canonicalizes the record before hashing.
- Scope limitation: the sitemap signal detects canonical-entry metadata, localization, and `lastmod` changes. It does not prove that OpenAI updates `lastmod` for every substantive body edit, and it is not a replacement for human review of the public article when a change is signaled. The direct reading route remains the claim source.
- Prior body-delta review: the stored article-body baselines for `openai-pacing-model-development` and `openai-private-safety-processing-preview` were 10,290 and 6,637 normalized characters. Current direct reads were 10,311 and 6,658 characters, respectively, a 21-character increase in each. Exact prior normalized text was not retained, so the changed span cannot be reconstructed from the hashes alone. Older Internet Archive snapshots did not reproduce those exact baselines and showed that the old article-container profile included rotating related-article cards. No claim is made that the exact 21-character deltas were definitively nonmaterial.
- Current claim review: the current Private Safety Processing article still states early-customer testing, cross-interaction pattern detection, limited safety signals without personnel access to underlying prompts or responses, and a planned September rollout and technical white paper. Those are the only current briefing claims that depend on either of the two changed pages, and the briefing already labels them developer claims at preview stage. No correction or new edition is warranted by the reviewed current source.
- Reviewed transition: at `2026-08-30T22:35:42Z`, the four current sitemap records were accepted as an adapter-transition baseline. Their canonical SHA-256 values are `71a78b61361dfac67e3f58989126b1a1ff6d2dda2e33db81a52e65af8f989f9c`, `1c051ac74db7438bdcf679d9116e1c741df808d7c03ba70ee1a9eb67f0df569b`, `2e9ba580505ccad14873e4247daf44f99b2352aa45bda0c2086e8cabf339217c`, and `15120fdc9a0b96049e0ec4b21b42078f017b550427f100997ed04f4a6d255438`, in registry order.
- Post-transition local check: `2026-08-30T22:35:45Z`, zero changed, error, unbaselined, or review-required source IDs.
- Publication state: the repair creates no digest, correction, social post, or public claim change.
