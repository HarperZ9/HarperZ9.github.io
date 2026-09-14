import { useEffect, type ReactNode } from "react";
import LiveBoard from "./LiveBoard";
import { EXTERNAL_ACTIONS, PRIMARY_ROUTES, SECONDARY_GROUPS, routeFamily } from "./site-routes";
import { CAPABILITY_DOMAINS, EVIDENCE_STREAM, SYSTEMS, systemById, type SystemRecord } from "./system-registry";
import evidenceProjectionSource from "../site/evidence-stream.json?raw";
import "./App.css";

type PublishedBriefing = {
  id: string;
  title: string;
  href: string;
  publishedAt: string;
  sourceCount: number;
  primaryFigureHref: string;
  limitations: string[];
};

type HomeEvidenceProjection = {
  schema: "harperz9-home-evidence/v1";
  derivedFrom: "harperz9-systems/v4";
  records: Array<{ id: string; systemId: string }>;
  latestPublishedBriefing: PublishedBriefing | null;
};

const FOOTER_ROUTE_HREFS = new Set([
  "overview.html", "catalog.html", "research.html", "publications.html", "hire.html",
]);
const HOME_ROUTE_LINKS = [
  ...PRIMARY_ROUTES,
  ...SECONDARY_GROUPS.flatMap((group) => group.routes),
];
const MENU_ROUTES = [{ label: "Site index", href: "site-index.html", family: "Systems", primary: false }];
const FOOTER_ROUTES = HOME_ROUTE_LINKS.filter(
  (route) => FOOTER_ROUTE_HREFS.has(route.href) && routeFamily(route.href),
);

const HOME_EVIDENCE_PROJECTION = JSON.parse(evidenceProjectionSource) as HomeEvidenceProjection;
const CURRENT_EVIDENCE = HOME_EVIDENCE_PROJECTION.records
  .map((projected) => EVIDENCE_STREAM.find(
    (evidence) => evidence.id === projected.id && evidence.systemId === projected.systemId,
  ))
  .filter((evidence): evidence is (typeof EVIDENCE_STREAM)[number] => Boolean(evidence));
const LATEST_PUBLISHED_BRIEFING = HOME_EVIDENCE_PROJECTION.latestPublishedBriefing;

function requireSystem(id: string) {
  const system = systemById(id);
  if (!system) throw new Error(`Missing system record: ${id}`);
  return system;
}

const systems = SYSTEMS;
const domains = CAPABILITY_DOMAINS;
const domainById = new Map(domains.map((domain) => [domain.id, domain]));
const requiredFlywheel = systemById("flywheel");
if (!requiredFlywheel) throw new Error("Missing system record: flywheel");
const FLYWHEEL: SystemRecord = requiredFlywheel;

const verifiedEvidence = EVIDENCE_STREAM.filter((record) => record.status === "verified");

const CAPABILITY_FAMILY_IDS = [
  "agent-systems",
  "evaluation-verification",
  "security-privacy",
  "developer-infrastructure",
  "graphics-media",
  "research-education",
] as const;

const REPRESENTATIVE_IDS = [
  "gather",
  "crucible",
  "index",
  "forum",
  "emet",
  "relay",
  "mneme",
  "plexus",
  "proof-surface",
  "accountable-surface",
];

const GRAPHICS_IDS = [
  "raw",
  "skyrimbridge",
  "truth-enb",
  "elder-enb",
  "enb-runtime-core",
  "studio-engine",
  "retro-engine",
  "engine-revival",
  "brender-archival",
].filter((id) => systems.some((system) => system.id === id));

const HIRING_ENTRY_ROUTES = [
  {
    label: "Technical support, developer operations, and QA",
    href: "/hire.html#engineering-path",
    summary: "Technical support engineering, developer operations, implementation, release support, and software QA.",
  },
  {
    label: "Evaluation tooling and Python developer tools",
    href: "/hire.html#technical-operations-path",
    summary: "Evaluation tooling, Python developer tools, test infrastructure, and research-engineering support.",
  },
  {
    label: "Public service, safety, and field operations",
    href: "/hire.html#public-service-field-path",
    summary: "Benefits-rich public routes where systems judgment and field reliability matter.",
  },
];

const FLYWHEEL_SOURCE_CANDIDATE = {
  label: "1.0.0 source candidate 48d98af",
  href: "https://github.com/HarperZ9/flywheel/commit/48d98af715bb2d6464361e98f43c94657fc78e0b",
  ciHref: "https://github.com/HarperZ9/flywheel/actions/runs/34891965952",
  observed: "2026-09-14",
  boundary: "CI success at the source commit; public release and installed acceptance are separate.",
};

const RESEARCH_SUPPORT_ROUTES = [
  {
    label: "Evaluator pilot",
    href: "/test-run-request.html",
    summary: "Bring one decision, a claim, an evidence boundary, and a false-success control. The useful result is a rerunnable verdict or a named unverifiable remainder.",
  },
  {
    label: "Frontier lab or research review",
    href: "/publications.html",
    summary: "Start from public figures, release records, and essays, then challenge the evidence, the check, or the correction path.",
  },
  {
    label: "Support or fund the work",
    href: "/hire.html#technical-operations-path",
    summary: "Use the technical operations route for evaluation tooling, Python developer tools, release infrastructure, and research-engineering support.",
  },
];

function localHref(href: string) {
  if (href.startsWith("http") || href.startsWith("/")) return href;
  return `/${href}`;
}

function evidenceHref(system: SystemRecord) {
  return system.evidence[0]?.href ?? system.sourceHref ?? localHref(system.href);
}

function productTypeLabel(system: SystemRecord) {
  return system.productType;
}

function isoDate(value: string) {
  return value.slice(0, 10);
}

const representativeSystems = REPRESENTATIVE_IDS.map(requireSystem);
const securitySystems = systems.filter((system) => system.domains.includes("security-privacy"));
const graphicsSystems = GRAPHICS_IDS.map(requireSystem);

const evidenceRows = [
  {
    measure: String(systems.length),
    label: "system records",
    source: "site/systems.json",
    href: "/catalog.html",
    note: "purpose, boundary, maturity, and evidence fields",
  },
  {
    measure: String(systems.filter((system) => system.placement === "featured").length),
    label: "featured records",
    source: "placement",
    href: "/overview.html",
    note: "systems promoted to the public front of the catalog",
  },
  {
    measure: String(verifiedEvidence.length),
    label: "verified evidence rows",
    source: "evidence status",
    href: "/catalog.html",
    note: "release, source, paper, demo, or public-boundary records with dates",
  },
  {
    measure: FLYWHEEL.evidence[0]?.date ?? "unknown",
    label: "Flywheel release record",
    source: "site/systems.json",
    href: evidenceHref(FLYWHEEL),
    note: "release label, source link, date, and limitations",
  },
  {
    measure: LATEST_PUBLISHED_BRIEFING?.publishedAt ?? "not published",
    label: "current briefing",
    source: "site/publications.json",
    href: LATEST_PUBLISHED_BRIEFING?.href ?? "/publications.html",
    note: LATEST_PUBLISHED_BRIEFING?.title ?? "No verified briefing is published yet.",
  },
];

function App() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    const settle = window.setTimeout(() => elements.forEach((element) => element.classList.add("in")), 3000);
    return () => {
      observer.disconnect();
      window.clearTimeout(settle);
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <TopNav />
      <main id="main">
        <IdentityHero />
        <MissionFrame />
        <FeaturedFlywheel />
        <ProductSelection />
        <EvidenceBoard />
        <ResearchPilotRoutes />
        <CapabilityOverview />
        <CurrentResearch />
        <LiveBoard />
        <RetroSystemsLab />
        <SecurityBoundary />
        <HiringRoutes />
      </main>
      <Footer />
    </>
  );
}

function TopNav() {
  return (
    <nav className="topnav" aria-label="Primary">
      <a className="brand" href="#identity" aria-label="Zain Dana Harper and Zentropy Labs home">
        <span className="brand-name">Zain Dana Harper</span>
        <span className="brand-lab">Zentropy Labs</span>
      </a>
      <div className="topnav-links">
        {PRIMARY_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
        {EXTERNAL_ACTIONS.map((action) => <a href={action.href} rel="noopener" key={action.href}>{action.label}</a>)}
      </div>
      <details className="home-menu">
        <summary>Menu</summary>
        <div className="home-menu-list" aria-label="Primary menu">
          {PRIMARY_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
          {MENU_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
          {EXTERNAL_ACTIONS.map((action) => <a href={action.href} rel="noopener" key={action.href}>{action.label}</a>)}
        </div>
      </details>
    </nav>
  );
}

function IdentityHero() {
  return (
    <header id="identity" className="hero">
      <div className="hero-copy reveal in">
        <h1 className="hero-title">Zentropy Labs</h1>
        <p className="hero-line">Flywheel and public tools for re-derivable AI evaluation.</p>
        <p className="hero-lab">Built by Zain Dana Harper. Intended for evaluators, research teams, and institutions that need claims a skeptic can rerun.</p>
        <div className="hero-actions" aria-label="Primary actions">
          <a className="btn solid" href="/flywheel.html">Inspect Flywheel</a>
          <a className="btn" href="#evidence">Review evidence</a>
          <a className="btn" href="#research-pilot-support">Pilot or support</a>
        </div>
        <nav className="edition-links" aria-label="Mission routes">
          <a href="/career/Flywheel-Platform-Brief.pdf">The Flywheel platform brief</a>
          <a href="/catalog.html">Public tool catalog</a>
          <a href="/publications.html">Essays and publications</a>
        </nav>
      </div>
      <figure className="identity-art mission-apparatus reveal in" aria-labelledby="mission-apparatus-title">
        <picture>
          <source
            type="image/webp"
            srcSet="/brand/zentropy-logo-640.webp 640w, /brand/zentropy-logo-960.webp 960w, /brand/zentropy-logo-1280.webp 1280w, /brand/zentropy-logo-1600.webp 1600w"
            sizes="(max-width: 900px) 92vw, 42vw"
          />
          <img
            src="/brand/zentropy-logo.png"
            alt="Zentropy Labs aperture mark with cyan light and oxblood shadow"
            width="1600"
            height="900"
            fetchPriority="high"
          />
        </picture>
        <figcaption className="mission-apparatus-copy">
          <strong id="mission-apparatus-title">Programmatic neutrality</strong>
          <span>Same specified check, evidence, and execution assumptions. Same verdict when the implementation is correct.</span>
        </figcaption>
        <ol className="mission-apparatus-steps" aria-label="Verification path">
          <li><span>Claim</span><strong>declared</strong></li>
          <li><span>Evidence</span><strong>bounded</strong></li>
          <li><span>Check</span><strong>versioned</strong></li>
          <li><span>Verdict</span><strong>rerun</strong></li>
        </ol>
      </figure>
    </header>
  );
}

function MissionFrame() {
  return (
    <section id="mission" className="section mission-section" aria-labelledby="mission-title">
      <div className="section-heading">
        <h2 id="mission-title">Mission: re-derivable verification</h2>
        <p className="section-lead">
          A consequential AI claim needs a check another reviewer can inspect and rerun.
        </p>
      </div>
      <div className="mission-grid">
        <article className="mission-card">
          <h3>Mechanism</h3>
          <p>Specify the claim, boundary, evidence, source version, execution assumptions, and false-success controls. Run the check. Preserve receipts so another authorized reviewer can rerun or challenge it.</p>
        </article>
        <article className="mission-card">
          <h3>Built</h3>
          <p>Flywheel is the flagship platform. Gather, Index, Forum, EMET, Crucible, Relay, Mneme, Plexus, Proof Surface, and Accountable Surface cover capture, routing, witnessing, memory, tool discovery, claims, and action boundaries.</p>
        </article>
        <article className="mission-card">
          <h3>Proposed reviewer pilot</h3>
          <p>Start with one consequential claim, equal evidence controls, expected reviewer effort, missed-error cases, and honest nulls. The output is a rerunnable verdict plus the exact remainder that still needs human judgment.</p>
        </article>
      </div>
      <p className="does-not-prove">
        <strong>Programmatic neutrality:</strong> given the same specified check, evidence, and execution assumptions, a correct implementation should return the same verdict regardless of actor, company, lab, or nation.
      </p>
    </section>
  );
}

function ProductSelection() {
  return (
    <section id="products" className="section representative-section" aria-labelledby="products-title">
      <div className="section-heading">
        <h2 id="products-title">Built tooling ecosystem</h2>
        <p className="section-lead">
          These are public systems that can be tried, inspected, or evaluated. Each entry says what the tool does once,
          then gives its type, state, verification date, evidence, and full product page.
        </p>
      </div>
      <div className="work-index">
        {representativeSystems.map((system) => (
          <article className="work-row" key={system.id}>
            <div>
              <h3><a href={localHref(system.href)}>{system.name}</a></h3>
              <p>{system.purpose}</p>
              <p className="product-status">{system.releaseState} / {system.maturity}</p>
            </div>
            <ProductDefinition system={system} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductDefinition({ system }: { system: SystemRecord }) {
  return (
    <details className="product-definition">
      <summary>Evidence and status</summary>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{productTypeLabel(system)}</dd>
        </div>
        <div>
          <dt>State</dt>
          <dd>{system.releaseState}</dd>
        </div>
        <div>
          <dt>Verified</dt>
          <dd><time dateTime={system.lastVerified}>{system.lastVerified}</time></dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd><a href={evidenceHref(system)}>{system.evidence[0]?.label ?? system.maturity}</a></dd>
        </div>
      </dl>
    </details>
  );
}

function FeaturedFlywheel() {
  const release = FLYWHEEL.evidence[0];
  return (
    <section
      id="flywheel"
      className="section split-section"
      aria-labelledby="flywheel-title"
    >
      <div>
        <h2 id="flywheel-title">Flagship platform: Flywheel</h2>
        <p className="section-lead">
          {FLYWHEEL.purpose} It is the place where evaluation work runs, records what happened, and exposes the difference between a public release, source candidate, installed acceptance, and external use.
        </p>
        <div className="action-row">
          <a className="text-link" href={localHref(FLYWHEEL.href)}>Inspect Flywheel</a>
          <a className="text-link" href="/career/Flywheel-Platform-Brief.pdf">Read the platform brief</a>
          {FLYWHEEL.sourceHref ? <a className="text-link" href={FLYWHEEL.sourceHref} rel="noopener">Source</a> : null}
        </div>
      </div>
      <div className="data-plate platform-record">
        <table className="command-table">
          <caption>Current Flywheel route</caption>
          <tbody>
            <tr>
              <th scope="row">Type</th>
              <td>{productTypeLabel(FLYWHEEL)}</td>
            </tr>
            <tr>
              <th scope="row">State</th>
              <td>{FLYWHEEL.releaseState}</td>
            </tr>
            <tr>
              <th scope="row">Release</th>
              <td>{release ? <a href={release.href}>{release.label}</a> : "No release record"}</td>
            </tr>
            <tr>
              <th scope="row">Source candidate</th>
              <td><a href={FLYWHEEL_SOURCE_CANDIDATE.href}>{FLYWHEEL_SOURCE_CANDIDATE.label}</a></td>
            </tr>
            <tr>
              <th scope="row">Source CI</th>
              <td><a href={FLYWHEEL_SOURCE_CANDIDATE.ciHref}>GitHub Actions run 34891965952</a></td>
            </tr>
            <tr>
              <th scope="row">Verified</th>
              <td>{release?.date ?? "unknown"} release; {FLYWHEEL_SOURCE_CANDIDATE.observed} source CI</td>
            </tr>
            <tr>
              <th scope="row">Install</th>
              <td><code>{FLYWHEEL.entryCommand}</code></td>
            </tr>
            <tr>
              <th scope="row">Check</th>
              <td><code>{FLYWHEEL.verificationCommand}</code></td>
            </tr>
          </tbody>
        </table>
        <p className="boundary-note">{FLYWHEEL.limitations[0]} {FLYWHEEL_SOURCE_CANDIDATE.boundary}</p>
      </div>
    </section>
  );
}

function EvidenceBoard() {
  return (
    <section id="evidence" className="section" aria-labelledby="evidence-title">
      <div className="section-heading">
        <h2 id="evidence-title">Evidence board</h2>
        <p className="section-lead">
          A compact index of the public record. Values come from checked-in source data and link back to the public record that produced them.
        </p>
      </div>
      <p className="does-not-prove">
        <strong>What this does not prove:</strong> A valid release row is not an adoption claim, safety claim, regulatory approval, or guarantee of model correctness.
        Counts, hashes, and release links stay evidence rows, not market proof.
      </p>
      <details className="evidence-disclosure">
        <summary>Open source metrics and newest evidence</summary>
        <div className="data-plate evidence-board">
          <table className="evidence-table">
            <caption>Public evidence, current source snapshot</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Record</th>
                <th scope="col">Source</th>
                <th scope="col">Boundary</th>
              </tr>
            </thead>
            <tbody>
              {evidenceRows.map((row) => (
                <tr data-evidence-row key={row.label}>
                  <th scope="row"><a href={row.href}>{row.measure}</a></th>
                  <td>{row.label}</td>
                  <td>{row.source}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section className="evidence-current" aria-labelledby="current-evidence-title">
            <h3 id="current-evidence-title">Newest registry evidence</h3>
            <ol>
              {CURRENT_EVIDENCE.map((evidence) => (
                <li key={`${evidence.systemId}:${evidence.id}`}>
                  <time dateTime={evidence.date}>{evidence.date}</time>
                  <a href={evidence.href} rel="noopener">{evidence.label}</a>
                  <span>{evidence.summary}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </details>
    </section>
  );
}

function ResearchPilotRoutes() {
  return (
    <section id="research-pilot-support" className="section pilot-section" aria-labelledby="pilot-title">
      <div className="section-heading">
        <h2 id="pilot-title">Research, pilot, and support routes</h2>
        <p className="section-lead">
          The useful next step is a bounded test or support route that improves a decision. The route should name the claim, evidence boundary, check, correction path, and what a passing result would still leave unresolved.
        </p>
      </div>
      <div className="route-ladder">
        {RESEARCH_SUPPORT_ROUTES.map((route) => (
          <a className="route-step" href={route.href} key={route.href}>
            <span>{route.label}</span>
            <small>{route.summary}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

function CapabilityOverview() {
  return (
    <section id="evidence-figures" className="section evidence-figures-section" aria-labelledby="figures-title">
      <div className="section-heading">
        <h2 id="figures-title">Measured evidence</h2>
        <p className="section-lead">
          Source-attributed figures publish units, denominators, dates, provenance, and limits.
          Capability families remain navigation labels, not diagrams or product hierarchies.
        </p>
      </div>
      <div className="evidence-figure-grid">
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>164-task model pass@1 comparison</h3>
          <a href="/analytics/model-pass-at-1-comparison.html" aria-label="Open model pass@1 comparison chart and data table">
            <img className="research-figure-image" src="/analytics/model-pass-at-1-comparison.svg" alt="Paired 164-task pass-at-one result: base Qwen 14B passed 141 tasks and Flywheel 14B passed 136; the difference was not statistically significant." width="1120" height="334" loading="lazy" />
          </a>
          <p>Same task set and harness. This measures two model artifacts, not market superiority or general agent reliability.</p>
          <p><a className="text-link" href="/analytics/model-pass-at-1-comparison.html" aria-label="Open model pass@1 comparison chart and data table">Open chart and data table</a></p>
          <details className="figure-detail">
            <summary>Dataset facts</summary>
            <FigureFacts rows={[
              ["n", "164 code-completion tasks"],
              ["units", "pass@1 and passed tasks"],
              ["retrieved", "2026-08-28"],
              ["source", <a href="/analytics/model-pass-at-1-comparison.html">result, table, and limits</a>],
            ]} />
          </details>
        </article>
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>Current cross-harness run</h3>
          <a href="/analytics/current-cross-harness-pilot.html" aria-label="Open current cross-harness run chart and data table">
            <img className="research-figure-image" src="/analytics/current-cross-harness-pilot.svg" alt="Horizontal bars for five harness roles on the same seven tasks: of seven attempts each, codex_harness and flywheel_harness reached a grader four times, claude_code twice, local_32b once, and local_14b none; three, two, one, zero, and zero passed." width="1120" height="610" loading="lazy" />
          </a>
          <p>35 attempts across five harness roles on seven tasks, all 35 receipts verified. 11 reached a grader and 6 passed; why the rest did not is named per role.</p>
          <p><a className="text-link" href="/analytics/current-cross-harness-pilot.html" aria-label="Open current cross-harness run chart and data table">Open chart and data table</a></p>
          <details className="figure-detail">
            <summary>Dataset facts</summary>
            <FigureFacts rows={[
              ["n", "35 receipt-verified attempts"],
              ["units", "attempts, passes, latency, and USD cost"],
              ["retrieved", "2026-09-04"],
              ["source", <a href="/analytics/current-cross-harness-pilot.html">result, table, and limits</a>],
            ]} />
          </details>
        </article>
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>Recovered actions by day</h3>
          <a href="/figures/recovered-actions-by-day.html" aria-label="Open recovered actions by day chart and data table">
            <img
              className="research-figure-image"
              src="/figures/recovered-actions-by-day.svg"
              alt="Bar chart of five recovered-action counts from July 9 through July 13, 2026: 3,779; 1,135; 7,677; 3,892; and 1,130."
              width="1280"
              height="720"
              loading="lazy"
            />
          </a>
          <p>Five daily counts from Hugging Face host telemetry. Unit: recovered logged actions. The figure does not measure unique attacks, severity, intent, or harm.</p>
          <p><a className="text-link" href="/figures/recovered-actions-by-day.html" aria-label="Open recovered actions by day chart and data table">Open chart and data table</a></p>
          <details className="figure-detail">
            <summary>Dataset facts</summary>
            <FigureFacts rows={[
              ["n", "5 daily observations"],
              ["units", "recovered logged actions"],
              ["retrieved", "2026-08-27"],
              ["source", <><a href="/figures/recovered-actions-by-day.html">figure and accessible table</a> · <a href="/figures/recovered-actions-by-day.json">dataset</a></>],
            ]} />
          </details>
        </article>
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>Reported motive labels</h3>
          <a href="/figures/motive-sample-nonexclusive.html" aria-label="Open reported motive labels chart and data table">
            <img
              className="research-figure-image"
              src="/figures/motive-sample-nonexclusive.svg"
              alt="Bar chart of non-exclusive motive labels in a 100-agent sample: scorer source or access 97, shared infrastructure or credentials 66, and task solution or private trajectories 89."
              width="1280"
              height="720"
              loading="lazy"
            />
          </a>
          <p>Non-exclusive labels from the independent investigator sample. Categories overlap, so counts must not be summed into a population total.</p>
          <p><a className="text-link" href="/figures/motive-sample-nonexclusive.html" aria-label="Open reported motive labels chart and data table">Open chart and data table</a></p>
          <details className="figure-detail">
            <summary>Dataset facts</summary>
            <FigureFacts rows={[
              ["n", "100-agent peak-hour sample"],
              ["units", "agents, non-exclusive"],
              ["retrieved", "2026-08-27"],
              ["source", <><a href="/figures/motive-sample-nonexclusive.html">figure and accessible table</a> · <a href="/figures/motive-sample-nonexclusive.json">dataset</a></>],
            ]} />
          </details>
        </article>
      </div>
      <div className="family-browser">
        <h3>Browse the work by primary subject</h3>
        <p>These are navigation labels only. Every catalog record retains its own purpose, product type, maturity, source, and limitations.</p>
        <div className="family-index">
          {CAPABILITY_FAMILY_IDS.map((familyId) => {
            const domain = domainById.get(familyId);
            const familySystems = systems.filter((system) => system.domains.includes(familyId));
            return (
              <article className="family-row" data-family-row key={familyId}>
                <h3>{domain?.label ?? familyId}</h3>
                <p>{domain?.summary}</p>
                <a href={`/catalog.html#domain-${familyId}`}>{familySystems.length} related records</a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FigureFacts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="figure-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CurrentResearch() {
  return (
    <section id="research" className="section split-section" aria-labelledby="research-title">
      <div>
        <h2 id="research-title">Current research</h2>
        <p className="section-lead">
          The publication surface carries current briefings, figures, source records, limitations, and related reproducible artifacts for public review.
          Model failures are framed as products of incentives, deployment conditions, and engineering choices; internal signals are treated as untrusted readouts checked against behavior.
        </p>
        <div className="action-row">
          <a className="text-link" href="/publications.html">Publication index</a>
          <a className="text-link" href="/figures/recovered-actions-by-day.html">Measured figures</a>
        </div>
      </div>
      {LATEST_PUBLISHED_BRIEFING ? (
        <article className="data-plate briefing-card">
          <h3><a href={LATEST_PUBLISHED_BRIEFING.href} data-current-briefing-title>{LATEST_PUBLISHED_BRIEFING.title}</a></h3>
          <p>{LATEST_PUBLISHED_BRIEFING.sourceCount} public sources. Limitations remain attached to the record.</p>
          <dl className="briefing-meta">
            <div>
              <dt>Published</dt>
              <dd>{isoDate(LATEST_PUBLISHED_BRIEFING.publishedAt)}</dd>
            </div>
            <div>
              <dt>Primary figure</dt>
              <dd><a href={LATEST_PUBLISHED_BRIEFING.primaryFigureHref}>Open figure</a></dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}

function RetroSystemsLab() {
  return (
    <section id="retro-systems-lab" className="section retro-section" aria-labelledby="retro-title">
      <div className="section-heading">
        <h2 id="retro-title">Graphics, engines, and preservation</h2>
        <p className="section-lead">
          Rendering platforms, Skyrim runtime integration, shader suites, browser graphics, procedural media, and software preservation are shown
          as separate products. Source state, releases, tests, and limitations remain attached to each project.
        </p>
      </div>
      <div className="retro-flow">
        {graphicsSystems.map((system) => (
          <article className="retro-step" key={system.id}>
            <span className="retro-verb">{system.accessMode}</span>
            <h3><a href={localHref(system.href)}>{system.name}</a></h3>
            <p>{system.purpose}</p>
            <dl className="product-meta">
              <div><dt>Type</dt><dd>{productTypeLabel(system)}</dd></div>
              <div><dt>State</dt><dd>{system.releaseState}</dd></div>
              <div><dt>Evidence</dt><dd><a href={evidenceHref(system)}>{system.evidence[0]?.label ?? system.maturity}</a></dd></div>
            </dl>
          </article>
        ))}
      </div>
      <p className="boundary-note">Shared subject matter does not imply one parent product, a runtime dependency, or inherited evidence.</p>
    </section>
  );
}

function SecurityBoundary() {
  return (
    <section id="security-boundary" className="section security-section" aria-labelledby="security-title">
      <div className="section-heading">
        <h2 id="security-title">Security platforms</h2>
        <p className="section-lead">
          Every registered security platform has a public-safe route. Shipped and inspectable tools link to their evidence; controlled-private systems expose purpose and boundary, then direct qualified work to a reviewed intake.
        </p>
      </div>
      <div className="security-layout">
        <article className="data-plate boundary-card">
          <h3>Public route, private authority</h3>
          <p>
            No private repository, operational method, target detail, client fact, or engagement result is published.
            Written authorization, defined scope, secure intake, and review are required before private capability is discussed or used.
          </p>
          <p className="inline-links"><a className="text-link" href="/security.html">Security overview</a> <a className="text-link" href="/private-practice.html">Private recipient lane</a></p>
        </article>
        <ol className="security-list">
          {securitySystems.map((system) => (
            <li key={system.id}>
              <a href={localHref(system.href)}>{system.name}</a>
              <span>{system.accessMode} / {system.maturity}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HiringRoutes() {
  return (
    <section id="hiring-collaboration" className="section hiring-section" aria-labelledby="hiring-title">
      <div>
        <h2 id="hiring-title">Hiring, contracting, and collaboration</h2>
        <p className="section-lead">
          For conventional hiring or contracting, use three practical routes: technical support and QA, evaluation tooling and Python developer tools, and public-service or field work.
          The documents are direct, and the project evidence stays one click away.
        </p>
      </div>
      <div className="hiring-actions">
        <a className="btn solid" href="/hire.html">Hire or collaborate</a>
        <a className="btn" href="/resume.html">Technical resume</a>
        <a className="btn" href="mailto:zaindharper@gmail.com">Email</a>
        <a className="btn" href="https://github.com/HarperZ9" rel="noopener">GitHub</a>
      </div>
      <details className="hiring-details">
        <summary>Role-specific routes</summary>
        <div className="hiring-route-list">
          {HIRING_ENTRY_ROUTES.map((route) => (
            <a className="text-link" href={route.href} key={route.href}>
              <span>{route.label}</span>
              <small>{route.summary}</small>
            </a>
          ))}
          <a className="text-link" href="/cv.html">CV</a>
          <a className="text-link" href="/portfolio.html">Portfolio</a>
        </div>
      </details>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <p>Zain Dana Harper and Zentropy Labs. Flywheel, re-derivable evaluation tools, public evidence records, retro rendering, security tooling, and hiring routes.</p>
      <nav className="footer-links" aria-label="Footer">
        {FOOTER_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
        <a href="https://github.com/HarperZ9" rel="noopener">GitHub</a>
      </nav>
      <details className="footer-more">
        <summary>More routes</summary>
        <nav className="footer-secondary-links" aria-label="More footer routes">
          {MENU_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
          <a href="/cv.html">CV</a>
          <a href="/portfolio.html">Portfolio</a>
        </nav>
      </details>
    </footer>
  );
}

export default App;
