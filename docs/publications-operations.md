# Publication operations

## Repository authority

`HarperZ9/HarperZ9.github.io` is the only canonical public site and publication repository. It owns publication bodies, routes, records, generated indexes, feeds, figures, build receipts, corrections, deployment state, and live verification receipts.

`HarperZ9/HarperZ9` is a derivative GitHub profile index. It may link to a verified live publication route after Pages succeeds, but it does not own article text or release state. `HarperZ9/telos-v2` is reference-only and is never a publication source or deployment dependency.

The `daily-editorial-research-atlas` automation owns general editorial essays. It must not publish or amend Frontier Safety content. The `frontier-safety-daily-publication` automation owns that separate source and edition workflow.

## Private intake and public-ready promotion

The automations maintain one complete private publication inventory outside public repositories. The private publication inventory contains metadata and hashes, not copied research bodies, credentials, protected session content, private browsing history, or sensitive local paths.

A candidate can enter the public repository only through a reviewed public-ready record. Promotion requires:

1. a nonduplicate thesis and canonical route;
2. refreshed primary or authoritative sources;
3. a claim ledger with source role, date, scope, denominator, uncertainty, limitation, and does-not-prove boundaries where applicable;
4. an explicit decision for any first-person statement attributed to Zain;
5. copyright, privacy, controlled-material, and credential checks;
6. complete article text, citations, figure data, and semantic fallbacks without JavaScript;
7. deterministic generation and independent review.

Raw packets, research notes, automation memory, and private receipts never cross this boundary.

## Collision and idempotency control

Each proposed release derives one idempotency key from four newline-delimited fields:

```text
SHA-256(automation ID + observation boundary + canonical route + public-ready record SHA-256)
```

Before creating a branch, the publishing agent checks the private receipt ledger, open and merged pull requests, current Pages records, feeds, and the live route for that key or equivalent content. A consumed key cannot be reused. An equivalent route or record is a collision even if another session chose a different branch name.

The agent fetches the canonical repository and starts from current main in a fresh, ownership-verified worktree. The normal branch form is `codex/publication/<route>-<date>-<record-prefix>`. Before push and again before merge, the agent verifies that the branch still descends from current main. If main advances, it stops, refreshes collision state, incorporates the new base safely, and reruns affected checks.

Parallel sessions must not edit the same worktree, branch, route, record, edition, or release key. A conflicting owner or unclear checkout state blocks the release.

## Guarded per-refresh release

Zain authorizes each editorial automation refresh to prepare, commit, push, open one pull request, merge, deploy, and live-verify one material nonduplicate publication without another action-time approval only when every gate in this document passes. This authority is limited to the canonical Pages repository and the automation's own content lane. It does not authorize social posts, email, external-publication submissions, private-data disclosure, or a Frontier Safety release from the general editorial automation.

One refresh can produce at most one website release. It must stop before any external action if a claim, identity, privacy, ownership, collision, source, review, or access state is uncertain.

## Build and review gates

The publishing agent performs these checks before push:

1. validate the public record schema and all claim-to-source references;
2. render twice from the same inputs and compare the complete generated diff or build hash;
3. run the focused publication tests and the complete repository test suite;
4. serve the site and run the internal link checker;
5. scan staged artifacts for credentials, private paths, protected markers, placeholders, unsafe controlled material, and unadopted personal voice;
6. verify canonical URLs, feeds, sitemap entries, figure JSON, SVG, HTML fallbacks, and no-JavaScript body parity;
7. inspect desktop, narrow reflow, keyboard focus, text spacing, reduced motion, forced colors, and print behavior;
8. obtain independent review for claim and source parity, privacy, accessibility, deterministic output, authority, and collision safety.

The review artifact records the reviewed commit and findings. Any fix invalidates affected review evidence and requires the relevant checks again.

## Pull request, merge, Pages, and live receipts

The agent pushes once, opens one destination-specific pull request, and records its URL and head commit. It waits for relevant CI and Pages prerequisites. A stale, red, or incomplete branch is not mergeable.

After a green merge, the agent records the merge commit and time, check-suite identities and results, and Pages deployment identity and result. It then requests every changed canonical route and verifies HTTP success, canonical metadata, expected content markers, and a live SHA-256 against the reviewed release bytes. A release is not complete until the live-byte receipt passes.

Only public-safe commit, pull request, deployment, route, and hash identifiers belong in this document or another public receipt. Account state, tokens, local paths, raw packets, and private ledger contents remain private.

## Profile sequencing

The profile repository can receive one stable Publications link only after a valid Pages live receipt exists. A profile update is appropriate only when stable routing materially changes. It must not copy publication bodies, manifests, feeds, edition state, correction state, deployment logic, or private receipts.

## Corrections and rollback

Corrections are append-only records. A correction identifies the affected route and record hash, the earlier public claim, the new evidence, the replacement text, and its own review and live receipts. It does not silently rewrite a dated evidentiary record.

If a merged release is unsafe or materially wrong, stop further distribution and use a reviewed forward correction or a repository-native revert of the exact release commit. Rerun the same build, review, CI, Pages, and live-byte gates. Record the rollback or correction receipt and preserve the superseded hash. Never erase unrelated history or reuse the failed idempotency key.

## No-change behavior

No-change runs remain silent. With no material, reviewed delta, an automation creates no commit, branch, pull request, deployment, profile edit, social draft, or no-change log.
