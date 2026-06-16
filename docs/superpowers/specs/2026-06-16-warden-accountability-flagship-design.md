# WARDEN Accountability Flagship Design

## Status

Approved direction: one flagship WARDEN page.

WARDEN is the underlying body of work. Accountability is the theme.

## Objective

Create a public-facing `warden.html` splash page for WARDEN that matches the caliber of the existing portfolio and QuantaLang pages while keeping private internals protected.

The page should make WARDEN legible as a larger accountability system behind the public repos: evidence, provenance, reporting, anomaly review, witness behavior, and agent-assisted workflow ownership.

## Thesis

Primary line:

> Claims should leave a trail.

Supporting line:

> WARDEN is an accountability engine for agent-assisted work: evidence, provenance, reporting, anomaly review, and human ownership held in one system.

Closing line:

> Accountability is the product.

## Audience

- Hiring managers and technical leaders evaluating engineering range.
- Investors or partners evaluating platform potential.
- Freelance/consulting prospects who need public-surface review, proof packets, or release-readiness work.
- AI-safety and governance readers evaluating the accountability pattern.

## Content Model

The page has five sections:

1. Hero: WARDEN as the accountability engine.
2. Accountability loop: claim captured, evidence attached, provenance checked, anomaly reviewed, report handed off.
3. Public proof lanes: evidence, provenance, reporting, anomaly review, agent workflow.
4. Public/private boundary: what is visible, what remains protected.
5. Repository surface: public links to WARDEN and adjacent proof tools.

## Public Links

Primary WARDEN public packages:

- `warden-reporting`
- `warden-algorithms`
- `warden-anomaly`

Adjacent accountability tools:

- `public-surface-sweeper`
- `model-provenance-validator`
- `repo-proof-index`
- `gpu-trace-validator`
- `EMET`

## Visual Direction

Use a higher-caliber version of the current portfolio system, not a generic duplicate page.

Design qualities:

- Formal enough to feel serious.
- Energetic enough to feel alive.
- Evidence-shaped rather than sales-shaped.
- Stronger first viewport than the rough mockup.
- Public/private boundary is visible, not hidden in small print.

Signature element:

- An accountability-loop panel in the hero.
- It should read like an operational ledger, not a decorative timeline.
- The loop is: claim -> evidence -> provenance -> anomaly -> report -> human.

Material system:

- White/paper base.
- Frosted glass panels consistent with the portfolio.
- Slightly sharper institutional contrast than the portfolio.
- Warm signal accent for accountability markers.
- Blue/steel or sage undertones for trust and review.

Typography:

- Keep the existing portfolio font stack unless implementation finds a strong reason to change:
  - Display: Archivo
  - Body: Manrope
  - Utility/data: JetBrains Mono
- No negative letter spacing.
- No viewport-scaled font sizes.

## Tone

Short, direct, and substantial.

Use:

- "claims"
- "evidence"
- "provenance"
- "reporting"
- "anomaly review"
- "human ownership"
- "public surface"
- "private core"

Avoid:

- certification claims
- trust laundering
- exploit/offensive detail
- secretive theatrics
- long clinical descriptions
- overexplaining implementation internals

## Public/Private Boundary

The page may say:

- WARDEN has a larger private body of work.
- The public surface shows reporting, algorithms, anomaly primitives, witness behavior, and proof tooling.
- Private internals, credentials, client data, operational details, and sensitive workflows are not exposed.

The page must not imply public certification, customer deployment, regulatory approval, or external trust status unless directly supported by public evidence.

## Navigation

Add entry points from the existing portfolio:

- Hero CTA or current-state section may link to `warden.html`.
- Directions row for "Evidence systems" should link to the WARDEN page.
- WARDEN public packages row should include the WARDEN page as the higher-level explanation.

The page should link back to the portfolio and to GitHub.

## Accessibility And Responsive Behavior

- Static HTML/CSS page.
- Works without JavaScript.
- Visible focus states.
- Sticky nav should not obscure anchored sections.
- Mobile first viewport should not be dominated by a code wall or oversized ledger.
- Text must not overflow buttons, cards, tables, or stat tiles.
- Reduced motion respected if animation is added.

## Verification

Required before commit:

- Existing portfolio tests pass.
- New or updated tests assert the WARDEN page exists, has the core thesis, links to the public repos, and states the public/private boundary.
- `git diff --check`.
- Staged secret-shape scan.
- Browser or Playwright viewport check on desktop and mobile.

## Out Of Scope

- Building separate Evidence Systems and WARDEN pages in this pass.
- Publishing private internals.
- Adding authentication, backend services, dashboards, forms, or dynamic data.
- Making certification, compliance, or customer claims not present in public artifacts.

## Self-Review

- No open blanks remain.
- Scope is one static flagship page plus portfolio links and tests.
- The theme is accountability, with WARDEN as the underlying body of work.
- The design explicitly protects private internals while making the public surface marketable.
