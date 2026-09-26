import { useEffect, type ReactNode } from "react";
import LiveBoard from "./LiveBoard";
import { EXTERNAL_ACTIONS, PRIMARY_ROUTES, SECONDARY_GROUPS, routeFamily } from "./site-routes";
import { CAPABILITY_DOMAINS, EVIDENCE_STREAM, SYSTEMS, systemById, type SystemRecord } from "./system-registry";
import evidenceProjectionSource from "../site/evidence-stream.json?raw";
import "./App.css";
import "./plate-home.css";

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
  "start-here.html", "glossary.html",
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

const FLYWHEEL_ACCEPTED_SOURCE = {
  label: "the 1.0.4 release commit",
  href: "https://github.com/HarperZ9/flywheel/commit/5d8b89d5f51e7ee3c096a1921dd4e601c8c75dd7",
  ciHref: "https://github.com/HarperZ9/flywheel/actions/runs/36208231392",
  desktopCiHref: "https://github.com/HarperZ9/flywheel/actions/runs/36208246188",
  observed: "2026-09-25",
  boundary: "Main CI and installed acceptance passed on the release commit; clean-machine installation is not claimed.",
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
        <RecentWork />
        <FeaturedFlywheel />
        <ProductSelection />
        <EvidenceBoard />
        <ResearchPilotRoutes />
        <CapabilityOverview />
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
      <h1 className="hero-title">Zentropy Labs</h1>
      <div className="hero-copy reveal in">
        <p className="hero-line">Flywheel and public tools for re-derivable AI evaluation.</p>
        <p className="hero-lab">
          Zentropy Labs builds Flywheel and a set of public tools for checking AI results. Each check leaves a record that
          someone else can rerun on their own computer to see whether the result holds. Read the newest investigation below,
          or install Flywheel and try a check yourself.
        </p>
        <p className="hero-audience">Built by Zain Dana Harper for evaluators, research teams and institutions that need claims a skeptic can rerun.</p>
        <div className="hero-actions" aria-label="Primary actions">
          <a className="btn solid" href="/flywheel.html">Inspect Flywheel</a>
          <a className="btn" href="#evidence">Review evidence</a>
          <a className="btn" href="#research-pilot-support">Pilot or support</a>
        </div>
        <p className="hero-start"><a href="/start-here.html">New here? Start with a plain guide to the site.</a></p>
        <nav className="edition-links" aria-label="Mission routes">
          <a href="/career/Flywheel-Platform-Brief.pdf">The Flywheel platform brief</a>
          <a href="/catalog.html">Public tool catalog</a>
          <a href="/publications.html">Essays and publications</a>
          <a href="/checking-the-machines.html">Open letter: checking the machines</a>
        </nav>
      </div>
      <figure className="identity-art art art-hero reveal in">
        <img
          className="art-light"
          src="/art/aperture/home-hero-light.svg"
          width="1200"
          height="1200"
          alt="A sun drawn in fine lines sits on the horizon over a perspective grid. Two thin towers stand in the haze, and the sun's reflection breaks into short bars on the grid below."
          fetchPriority="high"
        />
        <img
          className="art-dark"
          src="/art/aperture/home-hero-dark.svg"
          width="1200"
          height="1200"
          alt="A sun drawn in fine lines sits on the horizon over a perspective grid. Two thin towers stand in the haze, and the sun's reflection breaks into short bars on the grid below."
          fetchPriority="high"
        />
      </figure>
    </header>
  );
}

function MissionFrame() {
  return (
    <section id="mission" className="section mission-section" aria-labelledby="mission-title">
      <div className="section-heading">
        <h2 id="mission-title">Mission: <span className="nowrap">re-derivable</span> verification</h2>
        <p className="section-lead">
          Re-derivable means another person can rerun the same check on the same evidence and reach the same verdict.
        </p>
      </div>
      <div className="mission-grid mission-grid-two">
        <article className="mission-card">
          <h3>What a check records</h3>
          <p>A check writes down the claim, the evidence, the exact version of the test and what a passing result would still leave open. Anyone who holds that record can rerun it and compare verdicts.</p>
        </article>
        <article className="mission-card">
          <h3>A proposed pilot for evaluators</h3>
          <p>A pilot starts with one claim that matters to a decision. The check gives every side the same evidence controls. The result is a verdict anyone can rerun, the errors the check missed and the part that still needs a person to judge.</p>
        </article>
      </div>
      <p className="does-not-prove">
        <strong>Programmatic neutrality:</strong> given the same specified check, evidence, and execution assumptions, a correct implementation should return the same verdict regardless of actor, company, lab, or nation.
      </p>
    </section>
  );
}

const WKF_CASES: Array<{ label: string; first: "outsider" | "operator" | "same-day" }> = [
  { label: "OpenAI agents at Hugging Face", first: "outsider" },
  { label: "The RubyGems flood (attribution alleged)", first: "outsider" },
  { label: "OpenAI agents on the Austrian wiki", first: "outsider" },
  { label: "A Meta model in an Irregular environment", first: "outsider" },
  { label: "A Google model in an Irregular environment", first: "outsider" },
  { label: "An OpenAI agent on the Medicare portal (developing)", first: "outsider" },
  { label: "Claude models in Irregular environments", first: "operator" },
  { label: "The Claude Mythos Preview escape", first: "operator" },
  { label: "The UK AISI cyber ranges", first: "same-day" },
];

const RECENT_WORK = [
  {
    title: "Flywheel 1.0",
    meta: "Release, 19 September 2026.",
    text: "Flywheel runs a task with any model, then hands the result to a checker that anyone can rerun offline.",
    href: "/flywheel.html",
    action: "See what Flywheel does",
    cover: "pillar-flywheel",
    alt: "Fine lines sweep around a bright ring, like a wheel drawn by a plotter pen.",
  },
  {
    title: "An open letter on checking the machines",
    meta: "Letter, 19 September 2026, revised 20 September 2026.",
    text: "A signed letter to the people who build AI systems. It argues that a person should be able to question a machine's answer without first winning an argument with its owner.",
    href: "/checking-the-machines.html",
    action: "Read the letter",
    cover: "cover-checking-the-machines",
    alt: "A grid of small square drawings, each a set of nested squares, with one square lit.",
  },
  {
    title: "Articulate",
    meta: "Release, 24 September 2026.",
    text: "Articulate is the writing checker used on this site's pages. It flags hedging, filler and stock phrasing, and its checks run on your own computer with no network connection.",
    href: "/articulate.html",
    action: "Try Articulate",
    cover: "cover-articulate",
    alt: "Rows of short dashes, like lines of text, bend around a bright circle. One run of dashes lifts out of its line.",
  },
  {
    title: "Frontier Safety briefing",
    meta: "Recurring briefing, current edition.",
    text: "A dated record of safety news from the UK AI Security Institute, Anthropic, OpenAI and others. Each edition says what changed, which source says so and what that source cannot show.",
    href: "/frontier-safety.html",
    action: "Read the current edition",
    cover: "cover-frontier-safety",
    alt: "A bright core ringed by fifty-two fine tick marks, one of them drawn long past the outer rings.",
  },
];

function WkfSquare({ first }: { first: "outsider" | "operator" | "same-day" }) {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
      {first === "outsider" ? <rect x="2" y="2" width="36" height="36" className="sq-fill" /> : null}
      {first === "same-day" ? <path d="M2 2 H20 V38 H2 Z" className="sq-fill" /> : null}
      <rect x="2" y="2" width="36" height="36" className="sq-edge" />
    </svg>
  );
}

function RecentWork() {
  return (
    <section id="recent-work" className="section recent-section" aria-labelledby="recent-title">
      <div className="section-heading">
        <h2 id="recent-title">Recent work</h2>
        <p className="section-lead">Writing and releases from the past month. Each item links to the full piece and its sources.</p>
      </div>
      <article className="data-plate recent-feature">
        <div className="recent-feature-copy">
          <h3><a href="/who-knew-first.html">Who Knew First</a></h3>
          <p className="recent-meta">Investigation and op-ed. Record published 23 September 2026, op-ed added 25 September 2026.</p>
          <p>By the record's account, the organization that ran the model held the decisive facts in each of nine AI agent incidents from 2026. In six of them, someone else told the public first.</p>
          <p><a className="text-link" href="/who-knew-first.html">Read the investigation</a></p>
        </div>
        <figure className="nine-square" aria-labelledby="wkf-chart-title">
          <figcaption>
            <strong id="wkf-chart-title">Who told the public first</strong>
            <span className="chart-takeaway">In six of the nine incidents, someone outside the organization that ran the model told the public first.</span>
          </figcaption>
          <div className="nine-square-row" role="img" aria-labelledby="wkf-chart-title wkf-chart-summary">
            {WKF_CASES.map((c) => (
              <div className={`nine-cell nine-${c.first}`} key={c.label}>
                <WkfSquare first={c.first} />
                <span aria-hidden="true">{c.label}</span>
              </div>
            ))}
          </div>
          <p id="wkf-chart-summary" className="visually-hidden">
            Six incidents where an outsider told the public first, two where the organization that ran the model did, and one where both spoke on the same day.
          </p>
          <p className="chart-how">
            <strong>How to read this:</strong> each square is one incident. A filled square means an outsider spoke first. An outlined square means the organization that ran the model spoke first. A half-filled square means both spoke on the same day and the order is unknown.
          </p>
        </figure>
      </article>
      <div className="recent-grid">
        {RECENT_WORK.map((item) => (
          <article className="recent-card" key={item.href}>
            <figure className="art recent-cover">
              <img className="art-light" src={`/art/aperture/${item.cover}-light.svg`} width="1600" height="800" alt={item.alt} loading="lazy" decoding="async" />
              <img className="art-dark" src={`/art/aperture/${item.cover}-dark.svg`} width="1600" height="800" alt={item.alt} loading="lazy" decoding="async" />
            </figure>
            <h3><a href={item.href}>{item.title}</a></h3>
            <p className="recent-meta">{item.meta}</p>
            <p>{item.text}</p>
            <p><a className="text-link" href={item.href}>{item.action}</a></p>
          </article>
        ))}
      </div>
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
          {FLYWHEEL.purpose} The public record stays honest about maturity, separating a shipped release from accepted source, installed acceptance, and external use.
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
              <th scope="row">Accepted source</th>
              <td><a href={FLYWHEEL_ACCEPTED_SOURCE.href}>{FLYWHEEL_ACCEPTED_SOURCE.label}</a></td>
            </tr>
            <tr>
              <th scope="row">Source CI</th>
              <td><a href={FLYWHEEL_ACCEPTED_SOURCE.ciHref}>Main CI passed</a>; <a href={FLYWHEEL_ACCEPTED_SOURCE.desktopCiHref}>installed acceptance passed</a></td>
            </tr>
            <tr>
              <th scope="row">Verified</th>
              <td>{release?.date ?? "unknown"} release; {FLYWHEEL_ACCEPTED_SOURCE.observed} source CI observed</td>
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
        <p className="boundary-note">{FLYWHEEL.limitations[0]} {FLYWHEEL_ACCEPTED_SOURCE.boundary}</p>
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
          Capability families are navigation labels.
        </p>
      </div>
      <div className="evidence-figure-grid">
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>164-task model pass@1 comparison</h3>
          <a href="/analytics/model-pass-at-1-comparison.html" aria-label="Open model pass@1 comparison chart and data table">
            <img className="research-figure-image" src="/analytics/model-pass-at-1-comparison.svg" alt="Paired 164-task pass-at-one result: base Qwen 14B passed 141 tasks and Flywheel 14B passed 136; the difference was not statistically significant." width="400" height="521" loading="lazy" />
          </a>
          <p className="chart-takeaway-home"><strong>Takeaway:</strong> base Qwen 14B passed 141 of the 164 tasks and Flywheel 14B passed 136. The difference is not statistically significant.</p>
          <p><strong>How to read this:</strong> each bar is the share of the 164 tasks a model passed on its first try, on a scale that starts at zero.</p>
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
      </div>
      <details className="figure-detail how-we-know">
        <summary>How we know: three more measured figures</summary>
        <ul>
          <li><a href="/analytics/current-cross-harness-pilot.html">Current cross-harness run</a>: 35 receipt-verified attempts across five harness roles on seven tasks, all 35 receipts verified; 11 reached a grader and 6 passed. Units: attempts, passes, latency and USD cost.</li>
          <li><a href="/figures/recovered-actions-by-day.html">Recovered actions by day</a> (<a href="/figures/recovered-actions-by-day.svg">figure</a>, <a href="/figures/recovered-actions-by-day.json">dataset</a>): 5 daily observations from Hugging Face host telemetry. Unit: recovered logged actions. It does not measure unique attacks, severity, intent or harm.</li>
          <li><a href="/figures/motive-sample-nonexclusive.html">Reported motive labels</a> (<a href="/figures/motive-sample-nonexclusive.svg">figure</a>, <a href="/figures/motive-sample-nonexclusive.json">dataset</a>): a 100-agent peak-hour sample with non-exclusive labels. Categories overlap, so the counts must not be summed.</li>
        </ul>
      </details>
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
