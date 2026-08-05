# Branch retirement ledger (2026-08-05)

Twenty branches sat unmerged into `main`. Each was assessed by the only question that matters
for a live site: **does this branch hold something `main` does not?** Not "has it been merged" —
old work here was frequently re-authored by hand rather than merged, so patch-ids do not match
and `git cherry` reports false positives.

**Method.** For every branch, for every file it touched, compare the branch's version of that
file against `main`'s version directly (`git diff main origin/BRANCH -- PATH`), discounting the
sitewide `system.css?v=` stamp. An empty diff means `main` already carries the content. A
non-empty diff was then read to establish DIRECTION: does the branch add something missing, or
is it an older draft `main` has since grown past?

**Why not merge them.** Most sit 60 to 160 commits behind. A merge would not have been a
no-op; it would have reverted shipped work. `site/2026-08-04-outreach-refresh` would have
returned the public Flywheel page to v0.2.2 pinned against `flywheel-desktop`, a repository
that has since been archived into `flywheel`. `site/2026-07-30-measured-verification` would
have deleted the Flywheel flagship workflow from the demonstrations page. That is the whole
hazard, and it is why every verdict below is anchored to file content rather than to graph
topology.

**Nothing is lost, and the promise is now a real ref.** Every retired branch's tip SHA is
recorded here, and each one also carries a permanent annotated tag on `origin`:

```bash
git checkout -b <name> retired/<name>
```

The first version of this ledger promised recovery by bare SHA. That worked, but only for as long
as the host kept serving an unreferenced object, which is not a guarantee anybody should rely on.
Thirty-three `retired/*` tags now hold those commits reachable forever, which is what made it safe
to delete the local mirrors as well as the remote branches. Verified by restoring one at random
and reading its tree back.

## Retired: content already in `main`, byte for byte

These four differ from `main` in nothing but the CSS cache stamp. `fix/pr-evidence-recount`
shipped as PR #111; the branch was simply never deleted.

| Branch | Tip | Evidence |
|---|---|---|
| `fix/latest-release-link` | `0eb1363` | zero files differ from `main` |
| `fix/pr-evidence-recount` | `42bed35` | `portfolio.html` identical; shipped as #111 |
| `publish/pick-lock-v3-2026-07-24` | `d2f21ae` | zero files differ from `main` |
| `site/2026-07-30-ci-repair` | `f2ebcb0` | zero files differ from `main` |

## Retired: `main` is strictly newer, and merging would regress

| Branch | Tip | What merging would have undone |
|---|---|---|
| `fix/flywheel-033-currency` | `9beedda` | re-pins v0.3.3 with a hardcoded SHA-256; `main` carries the durable `releases/latest` link that survives 0.3.4 and beyond |
| `site/2026-08-04-outreach-refresh` | `92bb017` | reverts Flywheel to v0.2.2 on the archived `flywheel-desktop` repo |
| `site/2026-07-30-measured-verification` | `478ce56` | deletes the Flywheel flagship workflow from `demonstrations.html` |
| `chore/update-readme-current-state` | `7be8269` | replaces the React-shell test contract with one asserting the retired white-ceramic home (`system/home.css`, Ribbon Field) |
| `publish/conviction-coda-2026-07-22` | `9365fdc` | removes 75 and 53 lines from essay sections `main` has since finished |
| `publish/redemption-canyon-2026-07-22` | `c74a4fa` | same lineage, an earlier draft |
| `publish/open-failure-foundation-2026-07-22` | `4e6cf61` | removes 91 lines from `pick-the-lock-for-everyone.html` |
| `publish/pick-the-lock-for-everyone-2026-07-22` | `58223db` | earlier draft of the same page and its test |
| `publish/current-story-visual-sequence-2026-07-23` | `308e91d` | removes 23 URLs from `sitemap.xml` |
| `publish/high-resolution-visual-coda-2026-07-23` | `823e916` | PR #79. Four abandoned sprite pipelines (`hq-data`, `hq-data-v2`, `avif-data`, `avif-data-v2`, `avif-data-v3`, `avif25-data`), one chunk each, plus a stray `connector-file-path-test.txt`. `main` serves the sequence from `art/current-story/data/` and the 27-scene atlas with receipts. |
| `publish/high-resolution-27-frame-coda-2026-07-24` | `d7f36bd` | two chunks of the same retired pipeline |

## Retired: dead build lineage (2026-07-12/13)

All four reference hashed bundles (`assets/index-BlofTrJV.js`, `index-BP9vft9V.js`,
`index-pWGxxfgs.js`) that no longer exist; `main` ships `index-gDDtH3kw.js`. Their page edits
target files rewritten many times since.

| Branch | Tip | Note |
|---|---|---|
| `agent/deploy-public-boundary-20260713` | `15006f8` | would delete 4,101 lines relative to `main` |
| `feat/evidence-led-home` | `f68ed98` | superseded by the React shell |
| `feat/calibrate-preview-evidence` | `bef53f9` | publishes Calibrate Pro demo assets |
| `fix/calibrate-readiness-boundary` | `76ba64a` | withholds Calibrate Pro from promotion |

The last two are a matched pair, and the second is the later decision. `main` has no
`media/demos/calibrate-pro/`, and the demos directory carries crucible, flywheel, forum,
gather, and index only. Calibrate Pro was deliberately not promoted; that decision stands.

## PUBLISHED (2026-08-05), then retired: the writing that was being held

`publish/living-breathing-reaction-2026-07-23` — tip `a13f240`. **This branch is the one
exception and it is being kept.**

It is the only branch in the twenty that ADDS more than it removes, and three of its files are
absent from `main` entirely:

- `writing/pick-the-lock-for-everyone/05b.md` (4,976 bytes) — `main` has 01 through 06 including
  04b, 04c, 04d, but no 05b
- `writing/pick-the-lock-for-everyone-talk/02e.md` (3,363 bytes) — `main` has 02, 02b, 02c, 02d,
  but no 02e
- `writing/living-breathing-reaction.md` (3,485 bytes) — a standalone piece, unreferenced by any
  page in `main`

**Correction, after an adversarial re-check of this entry.** The first version of this ledger
implied the whole of it was unpublished. It is not. The sampling argument, the strongest thing
in the section, IS already live: `writing/pick-the-lock-for-everyone-v3/10.md` on `main` carries
it, closing line included. "Fuck the label. Keep the lineage."

What is genuinely absent from `main` is narrower, and it is the personal half: the opening that
names father, mother, stepfather, brother, and the possession block that follows it. Which means
the branch's unique remainder is precisely the material the 2026-07-25 boundary excludes, and
the part worth publishing was published without it.

**It was not published, and this pass does not publish it, for two reasons that belong
together.** The section opens by naming family and by confessing — and a boundary set on
2026-07-25, two days AFTER this was drafted, holds that essays from that point cover the work
and the mission, with family and confession out. Second, the talk version marks itself
`[Optional movement. Keep the voltage. Kill the possession.]` — the author already flagged it as
a candidate rather than a commitment.

Publishing it was the operator's call, not a cleanup decision, so the branch was kept and the
question left open rather than answered by deletion.

**The operator then made the call: publish.** All three texts are live as of 2026-08-05, each
placed where it belongs and reproduced verbatim, selection only:

- the frame and the possession turn were inserted into `writing/pick-the-lock-for-everyone-v3/10.md`
  at the two seams where the draft's own flow continued. The draft's sampling paragraphs were not
  copied, since the essay already carried them in a fuller form.
- `writing/pick-the-lock-for-everyone-talk/02e.md` became its own movement in the spoken edition,
  between "nobody should have to become the floor" and the local-first close. Its
  `[Optional movement. Keep the voltage. Kill the possession.]` header was a stage direction to the
  author, not prose for a reader; the decision it flagged had now been made, so the note went and
  the movement stayed.
- the artist's statement went onto `current-story.html`, after the sequence rather than before it,
  instead of becoming a second page for the same seventeen images.

One gate changed with it. The essay's profanity budget was one; four more arrive together in the
passage that is ABOUT the word. It is now pinned at exactly five with the three redirect lines
asserted by name, which is a tighter constraint than the one it replaced, not a looser one.

The branch is therefore retired like the rest, tip `a13f240`, restorable by SHA. It is recorded
here separately because its verdict was decided by a person rather than by a diff.


## The rest of the local repository (2026-08-05)

The twenty branches above were the ones unmerged into `main`. Clearing them exposed the rest, and
it got the same treatment rather than a different one.

- **56 merged remote branches** and **94 merged local branches** deleted. Fully contained in
  `main` by definition; verified with an ahead-count of zero on every one before deleting.
- **12 further local-only branches** assessed the same way: ten `preserve/pre-replay-*` snapshots
  from 2026-06-30 to 07-02, `feat/music-experience` (2026-06-25), and `agent/restore-telos-v2-home`.
  All predate the React redesign and everything after it; each one's differing files exist in
  `main` in a later form. `essay/no-receipt-no-accept` was already whole in `main`, press kit
  included. All are tagged and retired.
- **6 stale worktrees** removed. Four reported as dirty and none of it was real: 77 "modified"
  files in the telos-v2 worktree and one in the calibrate worktree were `core.autocrlf` line-ending
  churn with an empty diff body, and the remaining changes were `.superpowers/sdd/*` planning
  scaffolding. Checked before removing, because a worktree named for a restore is exactly the kind
  of thing that should not be deleted on the assumption that it is noise.

End state: one branch (`main`), one worktree, zero open pull requests, thirty-three retirement
tags.