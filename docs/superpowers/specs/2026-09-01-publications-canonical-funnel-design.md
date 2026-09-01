# Publications Canonical Funnel Design

**Status:** Approved in chat on 2026-09-01. Written-source review pending.

**Scope:** Daily research intake, editorial preparation, publication generation,
deployment, and receipts for `harperz9.github.io`.

## Decision

`HarperZ9/HarperZ9.github.io` is the canonical source and deployment repository
for the public website and publication funnel.

`HarperZ9/telos-v2` is reference-only for this program. Useful renderers,
schemas, or tests may be ported into the Pages repository after their behavior
is verified. The publication system must not restore a two-repository release
dependency or overwrite the live site with an older generated tree.

`HarperZ9/HarperZ9` is the GitHub profile presentation repository. It is a
consumer of already-live Pages routes, not a second website, publication store,
or release authority. It may maintain concise links and summaries that help a
visitor reach the canonical site. It must not own publication bodies, source or
claim manifests, feeds, edition state, publication automation, or Pages deploy
logic.

This decision follows current first-party state:

- GitHub Pages deploys `HarperZ9/HarperZ9.github.io` from `main` at `/`.
- The Pages repository owns the active Frontier Safety source-check and guarded
  publication workflow.
- The current Publications front door, plain-language copy, and career truth
  corrections were committed, reviewed, merged, and deployed from the Pages
  repository.
- The profile repository describes and links the public work but contains no
  publication renderer, briefing corpus, feed, sitemap, or deployment workflow.
  Its repository homepage already points to `https://harperz9.github.io/`.
- `telos-v2` has no Pages deployment and has not absorbed the current
  Publications or career releases.
- The `telos-v2` deploy script protects parts of the live home because their
  source was never reconstructed there. It therefore cannot currently
  regenerate the whole deployed site without regression risk.

The existing README statements that call `telos-v2` canonical are stale and
must be corrected as part of implementation.

### Repository authority table

| Repository or state | Authority | May contain | Must not contain |
| --- | --- | --- | --- |
| `HarperZ9/HarperZ9.github.io` | Canonical public site, publication source, build, deployment, and live receipts | Publication records and bodies, manifests, renderers, feeds, indexes, routes, tests, and deployment state | Private research history, credentials, or controlled material |
| `HarperZ9/HarperZ9` | GitHub profile presentation and routing | Concise profile copy and stable links to verified live Pages routes | Publication bodies, competing current-edition state, source ledgers, feeds, renderers, or deployment logic |
| `HarperZ9/telos-v2` | Reference-only design and implementation laboratory | Reusable ideas or code pending verification and explicit porting | Canonical release state or authority to overwrite Pages |
| Private automation state | Research intake and complete private inventory | Source observations, candidates, hashes, holds, review state, and collision controls | Public claims or a substitute public publication route |

The authority direction is one-way for releases: private research produces a
reviewed public-ready packet; Pages publishes and verifies it; the profile may
then link to the verified route. A profile change can never establish that a
publication exists or is current before the Pages live receipt does.

## Outcome

Scheduled research tasks feed one evidence-led editorial funnel that can ship a
material, reviewed update on each refresh without requesting another approval.
The system publishes no-change output only when the output itself is material;
it never creates empty editions, duplicate routes, duplicate pull requests, or
no-change commits.

The public result has three entry forms:

1. **Recurring briefings** for time-sensitive, source-monitored developments.
2. **Canonical dossiers** for one event or question at durable depth.
3. **Essays and notes** for music, education, psychology and trauma, tools,
   abstract art, and other recurring interests.

The Publications page remains the editorial front door. Search and filters are
secondary conveniences, not the primary information architecture.

## Meaning of “migrate all”

Every relevant scheduled-task artifact enters the private migration inventory.
Public release is narrower.

The inventory records:

- stable artifact identity and SHA-256;
- producing automation and observation time;
- source URLs and source roles;
- claim candidates, limitations, uncertainty, and non-claims;
- route and edition collision state;
- rights, privacy, personal-voice, and controlled-material status;
- editorial readiness and the reason for any hold.

Raw session history, private correspondence, social-account data, protected
records, credentials, controlled security material, and unadopted personal
claims never enter the public repository. “All” means complete private
accounting, not indiscriminate publication.

## Architecture

### 1. Private research intake

The Frontier Safety and editorial-atlas automations remain responsible for
gathering and analyzing sources in their own private state. Each refresh emits
a collision-safe candidate packet with source snapshots, claim candidates,
uncertainty, limitations, and a content hash.

Research and publication are separate states. A gathered source is not a
published claim.

### 2. Public-ready publication records

Only reviewed, public-safe material crosses into the Pages repository. A
publication record owns:

- stable route ID, category, form, title, summary, author, and dates;
- ordered body sections;
- source manifest with publisher, title, URL, source role, publication or
  observation date, and retrieval date;
- claim ledger with status, source IDs, scope, limitation, and `doesNotProve`;
- figure records with units, population, numerator and denominator when
  applicable, transformation, uncertainty, and semantic fallback;
- correction and amendment history;
- AI-assistance disclosure;
- social derivatives marked `prepared` or bound to first-party publication
  receipts.

The record format may reuse verified ideas from the `telos-v2` briefing schema,
but its implementation and canonical data live in the Pages repository.

### 3. Deterministic static rendering

The renderer produces complete static article HTML, Publications index entries,
archive entries, Atom and JSON feeds, sitemap routes, figure assets, semantic
figure fallbacks, and build receipts.

JavaScript may enhance search, filtering, or navigation. It must not fetch or
construct the primary article body. Every article remains complete with
JavaScript disabled.

The renderer is deterministic: identical source records produce byte-identical
outputs. Each build receipt binds input and output SHA-256 values.

### 4. Guarded per-refresh publication authority

Zain has authorized each scheduled refresh to prepare, commit, push, merge, and
deploy a publication update without another action-time approval when all of
the following are true:

- the source and route are nonduplicate;
- a material delta exists;
- every public claim is source-bound and truth-bounded;
- personal first-person claims have been adopted by Zain;
- no private or controlled material crosses the public boundary;
- the output uses the current register and passes readability checks;
- focused and full release tests pass;
- a review artifact has no unresolved blocking finding;
- the branch is based on current `main` and no in-flight owner touches the same
  routes;
- the final merge, Pages deployment, live bytes, and canonical URLs are
  recorded.

The refresh fails closed on any missing source, unbaselined source, collision,
test failure, unresolved review finding, stale base, or live parity failure.
No material delta means no commit, pull request, deployment, or no-change log.

Each refresh uses one idempotency key derived from the automation, observation
boundary, route, and public-ready packet hash. An existing open or merged key
stops a duplicate release.

### 5. Frontier Safety ownership

Frontier Safety keeps one canonical August 26 OpenAI and Hugging Face incident
dossier. Recurring editions link to it and do not copy its full chronology into
a competing canonical record.

The Frontier automation owns source monitoring and dated editions. The broader
editorial automation may reference a Frontier edition but must not create a
second edition, amendment, social draft, or source scan for the same boundary.

### 6. Editorial-atlas ownership

The editorial automation owns standalone essays and notes outside the Frontier
edition stream. Initial reviewed candidates are:

- “The Second Hearing,” about repeated listening, familiarity, prediction, and
  the limits of replay-count evidence;
- “Availability Is Not Reach,” about tutoring availability, student reach,
  delivered dosage, and the difference between experimental and scaled effects.

Later categories enter through the same contract. A daily cadence is permission
to publish a ready work, not pressure to invent one.

### 7. GitHub profile synchronization

The profile repository remains a small, human-readable front door into the
canonical Pages site. A publication release may create a separate derivative
profile update only when the new route materially changes the profile's reading
or collaboration paths.

Profile synchronization follows these rules:

- use only stable canonical `https://harperz9.github.io/` URLs that have a live
  deployment receipt;
- summarize in plain language and link to the complete work instead of copying
  the article or maintaining a second “latest edition” record;
- derive any date, title, category, or status from the verified Pages record;
- use a separate branch, review, pull request, CI result, merge receipt, and
  profile live check;
- remain silent when the profile route or summary does not materially change;
- never let the profile automation publish, amend, or correct the underlying
  work.

These rules preserve one public hiring and collaboration funnel without making
the GitHub profile and the website competing sources of truth.

## Register and readability contract

Every publication leads with a concrete question or finding. The opening uses
the sequence: question, finding, evidence, limit.

Release copy must:

- use concrete nouns and active verbs;
- define specialized terms on first use;
- keep one principal claim per sentence where practical;
- state who observed or reported a fact;
- place evidence and limitations near the claim they qualify;
- distinguish measurement, interpretation, and open question;
- avoid hype, abstract product language, internal workflow vocabulary, and
  marketing claims;
- avoid em dashes;
- never use publication status, a DOI, a repository, or a benchmark as a proxy
  for peer review, adoption, deployment, or quality.

These rules operationalize the Reddit feedback that unclear “claudish” and
marketing language obscured what the work does and reduced confidence in its
claims.

## Accessibility and presentation contract

All publication routes require:

- complete no-JavaScript reading;
- semantic headings, landmarks, tables, captions, and figure fallbacks;
- keyboard traversal and visible, unobscured focus;
- 320-pixel and 400-percent reflow without page-level horizontal scrolling;
- AA contrast and non-color status cues;
- reduced-motion, forced-colors, text-spacing, and print behavior;
- useful alt text and no flashing above 3 Hz;
- Hanken Grotesk for reading and Conso for data and utility roles;
- verdict-only interface color, with spectrum confined to owned art or one
  focal figure.

The first decisive artifact appears in or immediately after the opening thesis.
Figures carry a plain-language claim, figure number, units, scope, denominator,
date, provenance, transformation, uncertainty, limitation, `doesNotProve`, and
adjacent text or table fallback.

## Release sequence

### Release 1: authority and no-JavaScript repair

- Correct repository authority documentation.
- Record the profile repository as a derivative index and add a no-split test
  that rejects publication bodies, edition state, feeds, manifests, renderers,
  or publication deployment logic there.
- Port only the generator capability required by the Pages repository.
- Pre-render the full text of legacy JavaScript-dependent essays.
- Add regression tests that prove the primary article text is present in the
  initial HTML response.

### Release 2: public-ready intake and automation contract

- Add the publication-record schema, renderer, collision ledger, build receipt,
  and deterministic checks.
- Update both scheduled automation prompts with the guarded per-refresh
  authority in this design.
- Preserve a private complete inventory and expose only public-safe manifests.

### Release 3: first editorial works

- Publish “The Second Hearing” with its four-experiment comparison figure.
- Publish “Availability Is Not Reach” with two separate denominator panels,
  never a false funnel.
- Update the Publications index, archive, feeds, sitemap, and live receipts.

### Release 4: current Frontier delta

- Reconcile the newest verified Anthropic, METR, OpenAI, AISI, and standards
  sources against the existing source registry.
- Publish one bounded dated update only if the Frontier material-delta gate
  passes.
- Route incident detail to the August 26 canonical dossier.

## Verification

Each release runs, at minimum:

- renderer red-green regression tests;
- deterministic double render and input/output hash comparison;
- publication schema and duplicate-route checks;
- source, claim, figure, date, denominator, and `doesNotProve` validation;
- no-JavaScript full-body parity checks;
- readability and prohibited-register checks;
- complete Python and Node site suites;
- internal and external link checks appropriate to the release;
- privacy, secret, protected-path, and controlled-material scans;
- cross-repository authority checks proving that publication IDs and edition
  state exist only in Pages, while profile publication links resolve to
  receipt-verified canonical Pages URLs;
- desktop, mobile, 320-pixel, 400-percent, keyboard, focus, text-spacing,
  reduced-motion, forced-colors, and print checks;
- staged diff and independent review;
- pull-request CI, main CI, Pages deployment, live HTTP, and live-byte parity.

Prepared social copy is not a published post. A social record moves to
`published` only with the exact first-party URL and timestamp.

## Failure and rollback

Generation is transactional. A failed record cannot partially update the
index, feeds, figures, or article routes. A failed deployment leaves the last
verified Pages commit authoritative.

A factual correction creates a visible correction or amendment record. It does
not silently rewrite history. A presentation-only fix may update the current
route when the underlying claims and dates remain unchanged, but still receives
a normal build and deployment receipt.

## Non-goals

- No new CMS or database.
- No publication quota.
- No automatic social posting without its own exact receipt contract.
- No public release of raw scheduled-task history or private account data.
- No publication of live bypasses, exploit chains, targets, credentials,
  private traces, or unpublished vulnerabilities.
- No attempt to make `telos-v2` canonical again inside this release train.
