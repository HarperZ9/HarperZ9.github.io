# Hiring-First Public Presence Design

Status: approved direction, specification review

The capability taxonomy, homepage operating surface, visualization system, and daily
publication pipeline are extended and, where terminology conflicts, superseded by
`2026-08-26-capability-first-publication-visual-system-design.md`.

## Objective

Rebuild the public HarperZ9 presence around a hiring-first entrance while preserving
Project Telos as one coherent public workshop. The site and GitHub profile should help a
qualified reviewer choose a work route, inspect current evidence, download the right
document, and contact Zain. Security and offensive-tool surfaces should demonstrate
serious engineering without disclosing private capability, overstating maturity, or
using sensational framing.

This design covers HarperZ9.github.io, the HarperZ9 GitHub profile README, flagship
repository presentation, security-tool artwork, and the cross-links that connect those
surfaces. It does not authorize publication of private repositories, private runtime
material, credentials, protected history, customer data, or operational offensive
capability.

## Verified Current-State Problems

1. `hire.html` uses the résumé-oriented `doc-rail` template. At the 62-rem rail
   breakpoint, a slightly wider viewport makes each work-path column narrower and much
   taller. The primary conversion page therefore becomes harder to scan on common
   laptop widths.
2. The React homepage and static pages use different top-level navigation taxonomies.
   The visitor's mental model changes after entering a detail page.
3. Career pages form one local family but map to several global active-state groups.
4. Career actions use footnote-scale treatments even though downloading a résumé or
   starting a conversation is the page's primary purpose.
5. The public security corpus mixes shipped products, alpha tools, private-contract
   summaries, and archived work without one maturity hierarchy.
6. GitHub profile copy contains version drift, and a pinned archived repository occupies
   space that should point to current flagship work.
7. The Pages repository and the documented `telos-v2` canonical source have drifted.
   Build ownership must be reconciled before broad edits continue.
8. The written design canon contains older palette and font guidance that conflicts with
   the later two-family, verdict-only workspace canon and the current implementation.

## Chosen Architecture

### One hiring-first public spine

The public surface remains an entrance map rather than a single linear sales funnel, but
the map has a clear first destination: work with Zain. A visitor may continue into the
systems, security, research, or studio lanes without losing the career context.

The stable top-level taxonomy is:

1. **Work**: hiring routes, résumé variants, portfolio, CV, contributions, and contact.
2. **Systems**: mature systems, developer tools, demonstrations, and the full catalog.
3. **Security**: shipped security products, the security-engineering toolkit, and
   bounded public-contract pages for selected private work.
4. **Research**: publications, Frontier Safety, research notes, and writing.
5. **Studio**: generative media, gallery, demos, graphics, and recorded work.

GitHub remains a persistent external action, not a sixth content category. Home and
static pages render this taxonomy from one data module. Interior pages may add a local
sub-navigation without changing their top-level family.

### Route data as the shared interface

A small static route registry owns labels, hrefs, active-family mapping, maturity labels,
and external-link state. Both the React homepage and `system/nav.js` consume generated
output from this registry. A parity test fails when the two surfaces drift.

The registry is public configuration, not runtime telemetry. It contains no private
paths, account state, unpublished names, or sensitive metadata.

## Homepage

### First viewport

The homepage opens with a task-oriented thesis: **Work with Zain Dana Harper.** The
supporting line names the strongest technical lane and the broader operational range in
plain language. The first actions are:

- choose a work path;
- download the technical résumé;
- inspect selected evidence;
- start a specific conversation.

The existing generative identity remains as one contained signature field. Text stays on
a calm ground and loads visibly before any canvas or motion. The homepage does not lead
with a metric wall or a grid of equal cards.

### Three work routes

The three approved routes are:

- **Engineering and evaluation**: AI evaluation, agent infrastructure, developer tools,
  systems programming, CI, compilers, and upstream engineering.
- **Technical operations**: troubleshooting, documentation, issue triage, release work,
  implementation support, customer communication, and developer operations.
- **Public service, safety, and field operations**: fire-department and
  emergency-support opportunities, public-facing service, records, coordination, safety
  judgment, parks, public works, utilities, facilities, arboriculture, grounds work, and
  other physically active operations.

Engineering receives the largest evidence area because it has the deepest public
artifact corpus. The other two remain full routes with dedicated documents and examples,
not footnotes beneath the technical route. The public-service route makes clear that Zain
is open to both physical and non-physical work. Fire-service interest is presented as a
career direction, not as a claim of firefighter, EMT, paramedic, academy, or incident-
command credentials.

### Evidence sequence

The homepage follows this order:

1. hiring thesis and actions;
2. three work routes;
3. selected flagship evidence;
4. current contributions and release evidence;
5. research, studio, and field-range entrances;
6. contact and complete site map.

## Hiring Surface

`hire.html` becomes a dedicated conversion template and no longer uses `doc-rail`. The
page keeps the shared site navigation and career-local navigation but reduces the local
primary sequence to **Hire, Résumé, Portfolio, CV**. Cover letter, dossier, and specialized
documents live in a secondary disclosure.

The page structure is:

1. task-oriented H1 and one-sentence fit statement;
2. availability, location, contact, and primary résumé action;
3. three ruled route bands with route-specific evidence and downloads;
4. a compact evidence ledger with dates and provenance;
5. selected work matched to each route;
6. contact action repeated after the route decision and at the end;
7. factual evidence note.

The route bands are not identical cards. Engineering may span more width or rows, while
the other paths remain visually explicit. The layout uses three, two, and one-column
states chosen by available route width. A wider viewport must never shrink a decision
surface.

Primary résumé, portfolio, email, and route actions have a minimum 44-pixel target. Text
links inside prose remain ordinary links.

## Security and Offensive-Tool Presentation

### Public maturity hierarchy

The public security lane uses four levels:

1. **Shipped public systems**: EMET and Phantom. These receive full product pages, reproducible
   flagship artwork, current releases, runnable entry points, current CI evidence, and
   explicit limitations.
2. **Release candidate**: Accountable Surface receives a standalone system page only after a
   tagged release and reverified public readiness. Until then it appears as alpha.
3. **Security Engineering Toolkit**: Public Surface Sweeper, Secret Redact IO, Model
   Provenance Validator, Agent Hook Pack, and Repo Proof Index share one grouped page.
   Each item keeps its individual repository link, version, purpose, entry command,
   tests, and non-claim.
4. **Authorized private practice**: Seed, Array, Sofer, Bounds, ORCA, and related private
   systems receive public-contract pages only when their claims and current CI state are
   reverified. Detailed public-safe write-ups may explain what each tool is for, the
   problem it solves, system components, bounded workflow, intended users, test strategy,
   deployment model at a non-sensitive level, limitations, and how an authorized
   engagement works. Pages do not link private source, expose client material or sensitive
   deployment details, or distribute actionable operational capability.

Archived predecessors remain history or redirects. They do not receive new flagship
positioning.

### Claim rules

- EMET references release `v1.2.0` only after the release and current checks are reread
  from first-party GitHub state.
- Phantom references `v1.1.0` and preserves its Layer-2-only, unsigned-installer, and
  unsigned/nonfunctional-driver caveats until first-party evidence changes.
- Historical test counts carry their date and are never labeled as current green state.
- A private repository's local test result does not become a public claim without a
  scrubbed, reproducible public receipt.
- No page implies endorsement, adoption, certification, or deployment that the evidence
  does not establish.

### Artwork

Every promoted security repository uses the canonical flagship-card system:

- ceramic card on dark mat for repository/social artwork;
- one iris accent;
- project role, feature-first headline, pipeline, ghost wordmark, and one library glyph;
- generated from `img/og/_card.html` and `img/og/cards-data.js`;
- the same deterministic PNG used by the site and repository README;
- rendering receipt recorded under `docs/brand/README.md` in the repository.

Pages may use route-seeded line, aperture, facet, scanline, halftone, crystalline, or
glitch material from the site engine. UI text, links, and controls remain verdict-only.
No repository receives bespoke hacker imagery or a generic cyber-security template.

## Repository Presentation Standard

Each promoted repository README uses this order:

1. canonical hero artwork with real-text name and feature statement below it;
2. current maturity, version, license, platform, and CI/release badges;
3. one concrete use case and a minimal working command;
4. installation and getting started;
5. core concepts and architecture;
6. examples or demonstrations;
7. verification commands and expected outcomes;
8. security model, authorization boundary, and non-claims;
9. troubleshooting and known limitations;
10. contribution, support, release, and site links;
11. artwork provenance and authorship.

Commands must be executed against a fresh checkout before publication. Badges must point
to live workflows or releases. Private repositories do not receive public source links.

## GitHub Profile

The `HarperZ9/HarperZ9` root README becomes the GitHub counterpart of the homepage:

- hiring-first introduction and the three work routes;
- direct résumé, portfolio, site, email, and LinkedIn actions;
- a small table of representative featured systems grouped by capability;
- current versions and maturity labels generated or checked from first-party state;
- explicit separation between public repositories and authorized private work;
- current contribution highlights and a dated evidence note.

The profile removes stale duplicate version claims. Pinned repositories prioritize active
flagships; archived repositories are not pinned. Any pin change is executed only after a
fresh profile and repository-state readback.

## Design System

The controlling screen system is:

- two text families: Hanken Grotesk and Conso; the Zentropy wordmark remains a mark rather
  than a third text role;
- near-black ground, ice ink, cyan verified/action signal, rust drift signal, and muted
  ink for secondary information;
- verdict-only UI color and at most one hot mark per view;
- angular ruled structures, apertures, facets, and line work rather than default pills or
  repeated cards;
- readable 65-to-75-character prose, balanced headings, visible focus, and reduced motion;
- generative artwork contained to a hero, plate, or artifact where it is the subject.

`DESIGN-RULES.md`, `BRAND.md`, `BRAND-NARRATIVE.md`, and the workspace design canon are
reconciled so they no longer prescribe conflicting font or palette behavior.

## Source and Deployment Ownership

Before implementation, fetch both `HarperZ9/telos-v2` and
`HarperZ9/HarperZ9.github.io`, compare their current remote default branches, and document
the source-to-output mapping. New source work is made in the canonical source repository
and generated into the Pages repository. A narrowly scoped Pages-only repair is allowed
only when no canonical source exists, and its ownership is documented.

The site remains static. No analytics, tracking, server dependency, account system, or
client-side application framework is added for this redesign.

## Error and Boundary Behavior

- Essential navigation and career routes have noscript fallbacks.
- Missing optional artwork never hides text or actions.
- A stale or unverifiable release, CI, download, or test claim renders as an honest null
  or is omitted; it is never filled from memory.
- External links identify their destination and use safe relationship attributes.
- Private or missing repository routes resolve to a public boundary explanation, not a
  broken or guessed link.
- Archived pages retain redirects or historical labels where inbound links exist.

## Verification Strategy

Implementation is test-driven. Required gates are:

1. unit tests for the shared route registry and active-family mapping;
2. parity tests proving React and static navigation use the same taxonomy;
3. career conversion contracts for headings, route-specific documents, contact actions,
   evidence notes, and no `doc-rail` regression;
4. rendered breakpoint assertions at 320, 390, 760, 980, 1000, and 1440 CSS pixels;
5. minimum decision-surface width and 44-pixel primary target checks;
6. keyboard, focus, semantic landmark, skip-link, color/contrast, and reduced-motion
   checks;
7. repository version, release, badge, link, artwork, and public/private-boundary checks;
8. deterministic card-rendering parity for every new artwork entry;
9. full Python and Node suites, internal link crawl, diff check, secret scan, and public
   copy checks;
10. desktop and mobile visual review of home, hire, security, grouped toolkit, EMET,
    Phantom, profile README, and at least one document page;
11. clean CI on the pull request and first-party GitHub Pages build receipt for the exact
    merge commit;
12. live HTTP and rendered checks for every new route and downloadable career artifact.

## Planned File Boundaries

Exact paths are finalized in the implementation plan after source-of-truth
reconciliation. The intended responsibilities are:

- `PRODUCT.md`: strategic users, purpose, personality, principles, and accessibility.
- shared route registry: one taxonomy for home and static pages.
- `home/src/App.tsx` and home styles: hiring-first homepage composition.
- `system/nav.js` and `system/nav.css`: static navigation rendering and behavior.
- `hire.html` plus a focused career-conversion stylesheet: dedicated hiring page.
- `security.html` and a grouped toolkit page: security index and verified public tools.
- `img/og/cards-data.js` plus deterministic card assets: canonical artwork.
- `tests/`: navigation, conversion, claims, artwork, accessibility, and breakpoint gates.
- `sitemap.xml`, page metadata, and README: discovery and build documentation.
- `HarperZ9/HarperZ9 README.md`: GitHub profile funnel.
- selected repository READMEs and `docs/brand/`: standardized presentation and receipts.

## Success Criteria

- The first homepage viewport names Zain, leads to the three hiring paths, and exposes a
  clear résumé and contact action.
- Home and interior navigation use one tested five-family taxonomy.
- `hire.html` no longer uses the document rail and does not shrink route surfaces when
  crossing the previous breakpoint.
- Every career route has a dedicated current document and evidence path.
- EMET and Phantom present current first-party versions and explicit limitations.
- Smaller verified security tools have one coherent grouped surface and remain first-class
  catalog records.
- Private offensive work is represented only through reviewed public-contract language.
- Public-contract pages give a detailed, useful account of what each selected tool is
  for while preserving the private-source and operational-safety boundary.
- Promoted repositories use reproducible canonical artwork and the documented README
  structure.
- The GitHub profile is hiring-first, version-consistent, and free of archived pins.
- All verification gates pass, the Pages build binds to the merged commit, and the live
  routes return and render correctly.

## Explicit Non-Goals

- Publishing private repositories, source, exploit chains, client material, protected
  histories, credentials, or restricted environment artifacts.
- Adding engagement analytics, tracking pixels, behavioral targeting, or a contact
  database.
- Giving every repository equal homepage space or claiming maturity without evidence.
- Rewriting reserved parallel projects such as Flywheel or Behavior Transform.
- Claiming security certification, adoption, endorsement, current CI, or release maturity
  without first-party evidence.
