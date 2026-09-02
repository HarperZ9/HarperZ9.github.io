import { useEffect, type ReactNode } from "react";
import GroundField from "./GroundField";
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
  "hire.html", "overview.html", "catalog.html", "security.html", "research.html",
  "publications.html", "writing.html", "studio.html", "gallery.html", "retro.html",
  "resume.html", "cv.html", "portfolio.html", "person.html",
]);
const HOME_ROUTE_LINKS = [
  ...PRIMARY_ROUTES,
  ...SECONDARY_GROUPS.flatMap((group) => group.routes),
];
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
  "index",
  "gather",
  "buildlang",
  "phantom",
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
      <GroundField seed={74} />
      <div className="viewport-vignette" aria-hidden="true" />
      <a className="skip-link" href="#main">Skip to content</a>
      <TopNav />
      <main id="main">
        <IdentityHero />
        <ProductSelection />
        <FeaturedFlywheel />
        <HiringRoutes />
        <EvidenceBoard />
        <CapabilityOverview />
        <CurrentResearch />
        <RetroSystemsLab />
        <SecurityBoundary />
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
          {FOOTER_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
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
        <p className="hero-line">Product studio, systems engineering, graphics, security tooling, and public research.</p>
        <p className="hero-lab">Zain Dana Harper is the builder behind Zentropy Labs.</p>
        <div className="hero-actions" aria-label="Primary actions">
          <a className="btn solid" href="#products">Explore products</a>
          <a className="btn" href="/hire.html">Hire or collaborate</a>
        </div>
      </div>
      <figure className="identity-art reveal in">
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
      </figure>
    </header>
  );
}

function ProductSelection() {
  return (
    <section id="products" className="section representative-section" aria-labelledby="products-title">
      <div className="section-heading">
        <h2 id="products-title">Products to start with</h2>
        <p className="section-lead">
          Start with products that can be tried, inspected, or evaluated. Each entry says what the product does once,
          then gives its type, state, verification date, evidence, and full product page.
        </p>
      </div>
      <div className="work-index">
        {representativeSystems.map((system) => (
          <article className="work-row" key={system.id}>
            <div>
              <h3><a href={localHref(system.href)}>{system.name}</a></h3>
              <p>{system.purpose}</p>
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
        <h2 id="flywheel-title">Featured platform: Flywheel</h2>
        <p className="section-lead">
          {FLYWHEEL.purpose}
        </p>
        <div className="action-row">
          <a className="text-link" href={localHref(FLYWHEEL.href)}>Inspect Flywheel</a>
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
              <th scope="row">Verified</th>
              <td>{release?.date ?? "unknown"}</td>
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
        <p className="boundary-note">{FLYWHEEL.limitations[0]}</p>
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
          A compact index of the public record. Values come from checked-in source data and link back to the record that produced them.
        </p>
      </div>
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
        <p className="does-not-prove">
          <strong>What this does not prove:</strong> A valid release row is not an adoption claim, safety claim, or guarantee of model correctness.
          Counts and releases stay evidence rows, not market proof.
        </p>
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
          <a href="/analytics/model-pass-at-1-comparison.html">
            <img className="research-figure-image" src="/analytics/model-pass-at-1-comparison.svg" alt="Paired 164-task pass-at-one result: base Qwen 14B passed 141 tasks and Flywheel 14B passed 136; the difference was not statistically significant." width="1120" height="334" loading="lazy" />
          </a>
          <p>Same task set and harness. This measures two model artifacts, not market superiority or general agent reliability.</p>
          <FigureFacts rows={[
            ["n", "164 code-completion tasks"],
            ["units", "pass@1 and passed tasks"],
            ["retrieved", "2026-08-28"],
            ["source", <a href="/analytics/model-pass-at-1-comparison.html">result, table, and limits</a>],
          ]} />
        </article>
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>Current cross-harness pilot</h3>
          <a href="/analytics/current-cross-harness-pilot.html">
            <img className="research-figure-image" src="/analytics/current-cross-harness-pilot.svg" alt="Four receipt-verified cross-harness attempts with zero valid comparable task outcomes." width="1120" height="480" loading="lazy" />
          </a>
          <p>4/4 receipts verified, but no valid comparable task outcome. The durations are diagnostic only.</p>
          <FigureFacts rows={[
            ["n", "4 receipt-verified attempts"],
            ["units", "attempts, outcomes, and diagnostic duration"],
            ["retrieved", "2026-08-28"],
            ["source", <a href="/analytics/current-cross-harness-pilot.html">result, table, and limits</a>],
          ]} />
        </article>
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>Recovered actions by day</h3>
          <img
            className="research-figure-image"
            src="/figures/recovered-actions-by-day.svg"
            alt="Bar chart of five recovered-action counts from July 9 through July 13, 2026: 3,779; 1,135; 7,677; 3,892; and 1,130."
            width="1280"
            height="720"
            loading="lazy"
          />
          <p>Five daily counts from Hugging Face host telemetry. Unit: recovered logged actions. The figure does not measure unique attacks, severity, intent, or harm.</p>
          <FigureFacts rows={[
            ["n", "5 daily observations"],
            ["units", "recovered logged actions"],
            ["retrieved", "2026-08-27"],
            ["source", <><a href="/figures/recovered-actions-by-day.html">figure and accessible table</a> · <a href="/figures/recovered-actions-by-day.json">dataset</a></>],
          ]} />
        </article>
        <article className="evidence-figure-card" data-evidence-figure-card>
          <h3>Reported motive labels</h3>
          <img
            className="research-figure-image"
            src="/figures/motive-sample-nonexclusive.svg"
            alt="Bar chart of non-exclusive motive labels in a 100-agent sample: scorer source or access 97, shared infrastructure or credentials 66, and task solution or private trajectories 89."
            width="1280"
            height="720"
            loading="lazy"
          />
          <p>Non-exclusive labels from the independent investigator sample. Categories overlap, so counts must not be summed into a population total.</p>
          <FigureFacts rows={[
            ["n", "100-agent peak-hour sample"],
            ["units", "agents, non-exclusive"],
            ["retrieved", "2026-08-27"],
            ["source", <><a href="/figures/motive-sample-nonexclusive.html">figure and accessible table</a> · <a href="/figures/motive-sample-nonexclusive.json">dataset</a></>],
          ]} />
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
          <a className="text-link" href="/private-practice.html">Private recipient lane</a>
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
          Run, inspect, or verify the work through three practical routes: technical support and QA, evaluation tooling and Python developer tools, and public-service or field work.
          The documents are direct, and the project evidence stays one click away.
        </p>
      </div>
      <div className="hiring-actions">
        {HIRING_ENTRY_ROUTES.map((route) => (
          <a className="btn" href={route.href} key={route.href}>
            <span>{route.label}</span>
          </a>
        ))}
        <a className="btn solid" href="/hire.html">Hiring map</a>
        <a className="btn" href="/resume.html">Technical resume</a>
        <a className="btn" href="/cv.html">CV</a>
        <a className="btn" href="/portfolio.html">Portfolio</a>
        <a className="btn" href="mailto:zaindharper@gmail.com">Email</a>
        <a className="btn" href="https://github.com/HarperZ9" rel="noopener">GitHub</a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <p>Zain Dana Harper and Zentropy Labs. Public systems, research briefings, retro rendering, security tooling, and hiring routes.</p>
      <nav className="footer-links" aria-label="Footer">
        {FOOTER_ROUTES.map((route) => <a href={`/${route.href}`} key={route.href}>{route.label}</a>)}
        <a href="https://github.com/HarperZ9" rel="noopener">GitHub</a>
      </nav>
    </footer>
  );
}

export default App;
