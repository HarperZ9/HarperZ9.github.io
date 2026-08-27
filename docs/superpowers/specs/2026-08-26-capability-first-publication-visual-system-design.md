# Capability-First Public Presence and Publication Visual System

Status: approved direction, written specification review

## Objective

Extend the hiring-first public presence into a capability-first map of Zain Dana
Harper's current work. Mature tools are first-class systems. `Featured` controls
homepage placement, not prestige or maturity. The site should help a visitor answer
four questions quickly:

1. What can these systems do?
2. How do they relate to one another?
3. What evidence supports each claim?
4. How can I hire, collaborate with, evaluate, or deploy the relevant work?

The same architecture owns a daily publication surface. Each briefing uses current,
authoritative sources and includes diagrams or data visualizations when they make the
evidence easier to understand. The visuals must remain reconstructable, accessible,
and honest about uncertainty.

This specification supplements the approved hiring-first design. Where the earlier
design treats `flagship` as a small category, this specification supersedes it:
first-class presentation is the normal standard for every mature public system.

## Controlling Decisions

- Hiring remains the first homepage entrance.
- Nearly every mature system receives first-class documentation and presentation.
- `Featured` is a reversible editorial attribute used to limit homepage density.
- Capability domains, use cases, relationships, maturity, and evidence organize the
  catalog. `Platform`, `engine`, and `flagship` do not form competing navigation trees.
- Recorded workflows and browser-native checks remain available as historical demos,
  but they no longer occupy prime homepage space.
- A living current operating surface replaces those sections.
- Diagrams and charts share one visual grammar across the site, repositories, and
  publications.
- Daily briefings are source-driven records, not engagement content. The pipeline
  publishes at most one canonical briefing per calendar day.

## Capability Architecture

### Primary domains

Systems may belong to more than one domain:

1. **Agent systems and orchestration**
2. **Evaluation, verification, and provenance**
3. **Security, privacy, and high-discretion operations**
4. **Developer infrastructure, languages, and release engineering**
5. **Graphics, simulation, color, and media**
6. **Research, education, and public-interest tooling**

These domains describe what a system enables. They do not force a tool into one
exclusive box.

### Canonical system registry

One public registry owns the system model. Generated consumers include the homepage,
catalog, capability pages, relationship map, static navigation, repository links, and
publication references.

Each public record contains:

- stable system ID and public name;
- one-sentence purpose and concrete use case;
- canonical public route and source or access route;
- capability-domain tags;
- audience and deployment-context tags;
- maturity: shipped, active, research, controlled-private, or archived;
- editorial placement: featured or catalog-only;
- access mode: run, install, inspect, request, or read;
- dated evidence: release, tests, benchmark, paper, pull request, or public receipt;
- explicit limitations and non-claims;
- public or private boundary;
- inputs, outputs, dependencies, and related systems;
- last verified date and evidence source.

Missing evidence renders as an honest null. A private boundary produces a useful public
explanation, not a guessed source link or a broken route.

### System pages

Every mature public system receives the same depth standard:

1. what it does;
2. who it is for;
3. one representative workflow;
4. how to run or evaluate it;
5. architecture and relationships;
6. current evidence and date;
7. limitations, authorization boundaries, and non-claims;
8. related systems and next action.

Visual treatment may vary by capability family, but information depth and verification
standards do not.

## Homepage: Current Operating Surface

The homepage preserves the approved first sequence:

1. hiring thesis and three work routes;
2. selected evidence and current contributions;
3. current operating surface;
4. research and publication entry;
5. direct contact and complete map.

The current operating surface replaces the old recorded-workflow and browser-check
showcases. It contains five coordinated views:

### Capability map

A compact relationship diagram shows representative systems, capability domains, and
the verified artifacts that connect them. The diagram is generated from registry data.
It is not a hand-maintained second taxonomy.

### Release and evidence stream

A dated list shows current public releases, accepted contributions, benchmark results,
papers, and verified changes. Every entry links to its source and states its evidence
type. Open work remains visibly open. A local test is not presented as adoption.

### Current research briefings

The newest verified briefing appears with its publication date, source count, one
primary diagram, limitations, and a route into the complete archive.

### Representative workflows

Current workflows are derived from registry relationships. A workflow appears only when
its inputs, transformations, outputs, and evidence are current. Historical demos remain
reachable from system pages and the archive.

### Action routes

Hiring, collaboration, evaluation, authorized deployment, and research contact routes
remain adjacent to the evidence they depend on.

Essential content renders without JavaScript. Interactive diagrams progressively
enhance semantic HTML rather than replacing it.

## Shared Visualization Grammar

### Purpose

Visuals explain structure, change, magnitude, uncertainty, or evidence lineage. They are
not decorative substitutes for prose.

### Supported figure families

- **Relationship map:** systems, dependencies, inputs, outputs, and evidence links.
- **Timeline:** events, disclosures, policy actions, releases, and source dates.
- **Comparison table or matrix:** repeated attributes, evidence coverage, and limits.
- **Measured chart:** time series, distributions, ratios, counts, or benchmark results.
- **Flow diagram:** source intake, transformation, verification, and publication.
- **Uncertainty view:** confidence interval, range, missingness, disputed status, or
  evidence gap.

The system chooses the smallest figure that materially improves understanding. A short
list remains a short list.

### Visual identity

- Near-black ground, ice ink, Hanken Grotesk for reading, and Conso for data.
- Cyan means verified or actionable. Rust means drift, caution, or disputed state.
- Muted ink means unavailable, historical, or secondary context.
- At most one expressive hot mark per view.
- Angular rules, apertures, facets, contour lines, and measured grid structures replace
  generic cards and dashboard chrome.
- Generative material may frame a figure, but never encode evidence unless its mapping is
  explicit and reproducible.
- Motion is optional, reduced-motion safe, and never required to read the result.

### Figure evidence contract

Every generated figure carries a machine-readable companion record containing:

- figure ID and briefing or system ID;
- source URLs and retrieval dates;
- exact input values and units;
- transformations, filters, and aggregation rules;
- uncertainty and missing-data handling;
- renderer version and deterministic seed when relevant;
- accessible title, description, and table fallback;
- claim supported by the figure;
- explicit statement of what the figure does not prove.

The published figure links to this record or exposes it through a details element.

### Accessibility

- Every figure has an accessible name and concise description.
- Complex figures include a complete semantic table or structured text fallback.
- Information never depends on color alone.
- Lines and marks remain distinguishable through shape, dash, label, or texture.
- Focus order follows reading order, and interactive figures are keyboard operable.
- Tooltips do not contain unique information.
- Charts remain legible at 320 CSS pixels and at 200 percent zoom.
- Print and no-script views retain the evidence and source list.

## Daily Publication Pipeline

### Cadence and identity

The research loop may run hourly, but it publishes at most one canonical briefing per
calendar day. A day with no material, verified development produces no public filler and
no no-change post.

Each briefing has a stable date-based ID, permanent route, source manifest, claim map,
figure records, build receipt, and publication receipt. Re-running the same date is
idempotent unless a correction creates a versioned amendment.

### Pipeline

1. **Discover:** search primary and authoritative sources across frontier AI safety,
   laboratories, regulators, standards bodies, cybersecurity, evaluations, research,
   open source, engineering, and relevant industry activity.
2. **Reconcile:** compare candidates against the newest published briefing, source
   archive, and correction ledger.
3. **Acquire:** preserve source URL, publisher, title, publication date, retrieval date,
   and a bounded source excerpt or structured fact record.
4. **Classify claims:** separate verified facts, source-attributed allegations,
   interpretation, uncertainty, and open questions.
5. **Synthesize:** write the briefing with feature-first prose, direct links, dated
   limitations, and no unsupported causal claims.
6. **Visualize:** select only figures supported by reconstructable data. Generate figure
   records and semantic fallbacks.
7. **Validate:** run schema, citation, duplicate, link, accessibility, rendering,
   secret, public-copy, and overclaim checks.
8. **Review:** inspect desktop, mobile, print, and no-script output. A correction or
   disputed-source condition stops publication until represented accurately.
9. **Publish:** add one canonical site article, update the archive and feeds, commit,
   deploy, and verify the live route against the exact commit.
10. **Distribute:** produce consistent X and LinkedIn derivatives from the canonical
    article. Record external posts only after first-party publication receipts exist.
11. **Correct:** preserve the original receipt, publish a dated correction, regenerate
    affected figures, and link both directions.

### Source policy

- Prefer regulators, courts, official company incident reports, evaluator reports,
  standards bodies, papers, and first-party repositories.
- Use independent secondary reporting to discover or contextualize, not to replace an
  available primary source.
- Attribute investigative and disputed claims to the party making them.
- Do not turn a subpoena, allegation, or investigation into a finding of liability.
- Do not quote beyond source and copyright limits.
- Do not publish private chat history, local session content, credentials, or unpublished
  protected artifacts.

## Current Frontier Briefing Scope

The next briefing must reconcile four first-party perspectives:

1. Alabama Attorney General Steve Marshall's August 24, 2026 announcement of an
   investigation and subpoena concerning OpenAI and the Hugging Face incident:
   <https://www.alabamaag.gov/attorney-general-marshall-launches-investigation-into-openai-and-sam-altman-for-massive-artificial-intelligence-data-breach/>
2. Redwood Research and METR's August 26, 2026 independent investigation of agent
   behavior, coordination, transcript manipulation, and the investigation's dataset and
   analysis limitations:
   <https://www.redwoodresearch.org/research/hugging-face-incident>
3. OpenAI's August 26, 2026 incident report and remediation account:
   <https://openai.com/index/hugging-face-incident-and-the-road-ahead/>
4. Hugging Face's technical timeline and recovered-action accounting:
   <https://huggingface.co/blog/agent-intrusion-technical-timeline>

The article must distinguish:

- the Alabama Attorney General's allegations and consumer-protection inquiry;
- OpenAI's account of its systems, model configurations, controls, and remediation;
- Hugging Face's forensic reconstruction of activity on its systems;
- Redwood Research and METR's independent behavioral analysis and stated limitations.

Recommended figures are:

- a dated incident and disclosure timeline;
- a source-perspective matrix showing scope, evidence, and unresolved questions;
- an investigation-scale diagram using only cited counts and clearly labeled
  denominators;
- a control-boundary flow showing intended isolation, observed boundary crossings, and
  the separate layers of technical containment, monitoring, and governance.

The figures must not reproduce operational exploit detail, imply that all agents or
deployed models behave alike, or present investigative allegations as adjudicated fact.

## Failure and Boundary Behavior

- A failed source retrieval produces an unavailable source record, not a guessed claim.
- Conflicting primary sources appear side by side with attribution and an unresolved
  marker.
- Missing denominators prevent ratio charts.
- A chart whose data cannot be reconstructed does not ship.
- A failed figure renderer falls back to the semantic table and prose.
- A stale registry record loses featured placement until reverified.
- A private system never leaks source paths, names, test output, or capabilities through
  generated diagrams.
- A publication with a broken citation, duplicate date ID, accessibility failure, or
  overclaim finding fails closed before deployment.

## Verification Strategy

Implementation is test-driven. Required gates include:

1. registry schema and generated-consumer parity tests;
2. many-to-many capability and relationship integrity tests;
3. homepage tests proving the old snapshot sections are replaced and the living surface
   remains after hiring evidence;
4. no-script and progressive-enhancement tests;
5. figure-schema, deterministic-render, input-hash, and claim-linkage tests;
6. source-manifest, citation, date, and duplicate-publication checks;
7. automated detection of uncited quantitative claims;
8. semantic table, accessible name, keyboard, focus, contrast, non-color encoding,
   reduced-motion, print, zoom, and 320-pixel checks;
9. desktop and mobile rendered review for the homepage, catalog, one system page, the
   archive, and the newest briefing;
10. full Python and Node suites, route generation, link crawl, public-copy lint, secret
    scan, diff check, clean CI, Pages build receipt, and live HTTP/rendered verification.

## Migration Sequence

1. Reconcile and extend the canonical registry without changing public navigation.
2. Add figure and publication schemas, validators, and a fixture briefing.
3. Replace the homepage snapshot sections with the current operating surface.
4. Generate the capability catalog and relationship map.
5. Migrate mature system pages and repository links to registry ownership.
6. Publish the current frontier briefing and its figures after source review.
7. Add the date archive, feed, correction ledger, and social derivatives.
8. Remove obsolete duplicate taxonomy and stale snapshot code only after inbound routes
   and tests prove safe migration.

## Success Criteria

- The homepage remains hiring-first and shows a current operating surface rather than
  old snapshot demonstrations.
- Every mature public system has first-class depth, evidence, and a clear next action.
- Visitors can navigate by capability, problem, audience, or relationship without a
  competing platform and flagship split.
- The complete catalog is one action away from every curated homepage selection.
- Diagrams and charts use one recognizable visual identity and remain fully accessible.
- Every quantitative public figure is reconstructable from its source record.
- The daily briefing archive publishes no duplicates, filler, unverified claims, or
  unreceipted external-post assertions.
- The current Alabama/OpenAI and Redwood/METR briefing distinguishes investigation,
  first-party incident account, independent analysis, and forensic evidence.
- The deployed Pages build binds to the reviewed commit and passes live route, rendering,
  accessibility, citation, and link checks.

## Explicit Non-Goals

- Giving every system equal homepage space.
- Converting the homepage into a dashboard, feed, or engagement loop.
- Using visualizations as decoration or as evidence without source data.
- Publishing operational exploit instructions, private tools, protected history,
  credentials, client material, or restricted environment artifacts.
- Presenting an investigation or allegation as a legal finding.
- Rewriting reserved parallel projects such as Flywheel or Behavior Transform.
- Claiming certification, adoption, endorsement, deployment, or current health without
  first-party evidence.
