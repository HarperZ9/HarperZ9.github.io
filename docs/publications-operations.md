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

### Release receipt: canonical funnel, 2026-09-02

- Pull request: [#179](https://github.com/HarperZ9/HarperZ9.github.io/pull/179)
- Reviewed head: `43987b0c0daed8ec43c845a77b0b7ccf900411f1`
- Reviewed base: `395b42d94ffd96f20b7fa05abe59ac90a392a602`
- Merge commit: `a58eb4a7009b0e514a51a17c1a106d7d63c30e59`
- Merged: `2026-09-02T03:29:35Z`
- Pull-request CI: [static-site](https://github.com/HarperZ9/HarperZ9.github.io/actions/runs/33587156132/job/100113587152), success
- Post-merge CI: [run 33587238230](https://github.com/HarperZ9/HarperZ9.github.io/actions/runs/33587238230), success
- Pages: [deployment 33587237339](https://github.com/HarperZ9/HarperZ9.github.io/actions/runs/33587237339), success
- Live observation: `2026-09-02T03:32:16Z`
- Deterministic build receipt SHA-256: `e322b5c02663ddbefd58aac208e14eb900ab2e278c2477bfe6db0e40f99e60f0`
- Reviewed release fingerprint: `ca3282da3f9c17f2aad290aaf9eea8f55dda49364a5a0502e46f822747c7fb5b`

Every route below returned HTTP 200 and its live bytes matched the merged source bytes exactly.

| Route | Live SHA-256 |
| --- | --- |
| `publications.html` | `097cb2b082218dd85f02fc4cba314c86234d7feb930df73fb1bbb8074cd11eb9` |
| `the-second-hearing.html` | `84d02adf9074ac0ed4b51312fb8418936af6aaf0fca613f49ae93876ccecc5c0` |
| `availability-is-not-reach.html` | `abb434517e91e563cc42a7ca232081899d9db53b1ab8f87e1690badd8bb1d233` |
| `figures/the-second-hearing-evidence-map.html` | `14ab71758d2a5af1b34415da0c150bf74a064aeadf930708e3f647d03a380ce4` |
| `figures/availability-is-not-reach.html` | `08eec87392d887738159922eb2f04db094590d8b5d5be1ddb4e08aacf13f50d6` |
| `frontier-safety-openai-hugging-face-incident.html` | `0c91bc93f458b59e71fa7cff4a981f8bb6bed8afed4414d788ba4a4ce05ed7b1` |
| `models-propose-oracles-dispose.html` | `57ec379c5eb5a2605bc2616b419638863c8439c20d8340a110e65a0858a0a1aa` |
| `no-receipt-no-accept.html` | `f8acd6307ce162b4dc8dcf3b742f907093e8f30766462e3d6564c320543982ec` |
| `pick-the-lock-for-everyone-talk.html` | `9967a0039aaa2d5ccb9baf315bf2e062a7eeb46549dd07acd80007a7e7e212fa` |
| `pick-the-lock-for-everyone.html` | `bc2c3cdf7933307cf1d543c3ed9f1b7a617354b29637218900339ddfc5166275` |
| `feed.xml` | `9c6a61600ad0f338965f815e5a0a1621e3419fbbaf541d2fea9bc8a68f3aa6bb` |
| `feed.json` | `6e18053e4b235c35d0eed85f1fb4d6b47571625e2fd8a39f631be079db65ae98` |
| `sitemap.xml` | `250b79dc60d2afde46ef262f285dff285c385b9c44c7c3ec1920df97b1a68822` |
| `figures/the-second-hearing-evidence-map.json` | `428b70c158a17dde59ba45514b4b61667d406cf7484cd7c0dc13f0632e5b51f7` |
| `figures/availability-is-not-reach.json` | `d3a5d138c067e2cc317e116c39cee1aed5695a15d680d7753833b6804fdc6ae3` |
| `publications/build.json` | `e322b5c02663ddbefd58aac208e14eb900ab2e278c2477bfe6db0e40f99e60f0` |
| `publications/data/index.json` | `9020e6c95412b0fb27f2a840d4395b245c68c013ae2098a596dc47ab788a37e0` |
| `img/og/the-second-hearing.png` | `6829c320cd6f927af99647f15359c8f4f80268458623d613bd38f03aa3d4a96d` |
| `img/og/availability-is-not-reach.png` | `1fc9224e556ae8eceb9bc1df3bba60d651c483ee0840bd64cdbd2e8a2dc6bc65` |
| `img/og/publications.png` | `f920a70711420db35c473c0aeb5d16419d167d464715e1b91c6d265949f2292d` |
| `system/publication-article.css` | `27ed6bb84edce2e704442dd9508856fdc4eeb822d0b899bb9191d420e8a428ee` |

The Frontier source refresh in this release window was nonmaterial. Four OpenAI sitemap fingerprints changed, but direct first-party reads found no substantive claim or article-date change. No duplicate edition, amendment, social draft, or no-change publication was created.

## Profile sequencing

The profile repository can receive one stable Publications link only after a valid Pages live receipt exists. A profile update is appropriate only when stable routing materially changes. It must not copy publication bodies, manifests, feeds, edition state, correction state, deployment logic, or private receipts.

## Corrections and rollback

Corrections are append-only records. A correction identifies the affected route and record hash, the earlier public claim, the new evidence, the replacement text, and its own review and live receipts. It does not silently rewrite a dated evidentiary record.

If a merged release is unsafe or materially wrong, stop further distribution and use a reviewed forward correction or a repository-native revert of the exact release commit. Rerun the same build, review, CI, Pages, and live-byte gates. Record the rollback or correction receipt and preserve the superseded hash. Never erase unrelated history or reuse the failed idempotency key.

## No-change behavior

No-change runs remain silent. With no material, reviewed delta, an automation creates no commit, branch, pull request, deployment, profile edit, social draft, or no-change log.
