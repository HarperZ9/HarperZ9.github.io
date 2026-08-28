import { useEffect } from "react";
import systemsRegistryRaw from "../../system/systems.json";
import feedRaw from "../../feed.json";
import retroManifestRaw from "../../media/retro-systems-lab/evidence-manifest.json";
import "./App.css";

type EvidenceRecord = {
  id: string;
  type: string;
  label: string;
  href: string;
  date: string;
  status: string;
  summary: string;
};

type SystemRecord = {
  id: string;
  name: string;
  purpose: string;
  href: string;
  sourceHref: string | null;
  domains: string[];
  primaryDomain: string;
  productType: string;
  architectureRole: string;
  maturity: string;
  releaseState: string;
  placement: string;
  accessMode: string;
  entryCommand: string | null;
  verificationCommand: string | null;
  evidence: EvidenceRecord[];
  limitations: string[];
  boundary: string;
};

type DomainRecord = {
  id: string;
  label: string;
  summary: string;
};

type RelationRecord = {
  source: string;
  target: string;
  relation: string;
  status: string;
  evidenceIds: string[];
  claimScope: string;
};

type Registry = {
  schema: string;
  domains: DomainRecord[];
  relations: RelationRecord[];
  systems: SystemRecord[];
};

type FeedItem = {
  id: string;
  url: string;
  title: string;
  content_text: string;
  date_published: string;
  date_modified: string;
};

type Feed = {
  title: string;
  items: FeedItem[];
};

type RetroManifest = {
  recordedAt: string;
  relationships: {
    boundary: string;
  };
  projects: {
    retroEngine: string;
    engineRevival: string;
    brenderArchival: string;
  };
  engineRevival: {
    release: {
      tag: string;
      href: string;
      commitSha: string;
    };
    localMaterializer: {
      targetCount: number;
    };
    doesNotProve: string;
  };
  brenderArchival: {
    release: {
      tag: string;
      href: string;
      commitSha: string;
    };
    nativeCTestTargets: string;
    doesNotProve: string;
  };
  retroEngine: {
    role: string;
    boundary: string;
  };
};

const registry = systemsRegistryRaw as Registry;
const feed = feedRaw as Feed;
const retroManifest = retroManifestRaw as RetroManifest;

const systems = registry.systems;
const domains = registry.domains;
const systemById = new Map(systems.map((system) => [system.id, system]));
const domainById = new Map(domains.map((domain) => [domain.id, domain]));
const primaryPlatforms = systems.filter((system) => system.architectureRole === "primary-platform");
const featuredPlatform = primaryPlatforms[0] ?? systems[0];
const verifiedEvidence = systems.flatMap((system) => system.evidence ?? []).filter((record) => record.status === "verified");
const currentBriefing = feed.items[0];

const CAPABILITY_FAMILY_IDS = [
  "agent-systems",
  "evaluation-verification",
  "security-privacy",
  "developer-infrastructure",
  "graphics-media",
  "research-education",
];

const REPRESENTATIVE_IDS = [
  "flywheel",
  "index",
  "gather",
  "buildlang",
  "retro-engine",
  "brender-archival",
  "phantom",
  "accountable-surface",
];

const SECURITY_IDS = [
  "phantom",
  "behavior-transform",
  "array",
  "seed",
  "sofer",
  "isomorph",
  "bounds",
  "kun",
  "orca",
  "gate",
  "accountable-surface",
  "public-surface-sweeper",
  "model-provenance-validator",
];

function requireSystem(id: string) {
  const system = systemById.get(id);
  if (!system) throw new Error(`Missing system record: ${id}`);
  return system;
}

function localHref(href: string) {
  if (href.startsWith("http") || href.startsWith("/")) return href;
  return `/${href}`;
}

function evidenceHref(system: SystemRecord) {
  return system.evidence[0]?.href ?? system.sourceHref ?? localHref(system.href);
}

function isoDate(value: string) {
  return value.slice(0, 10);
}

const representativeSystems = REPRESENTATIVE_IDS.map(requireSystem);
const securitySystems = SECURITY_IDS.map(requireSystem);
const graphicsSystems = [
  "raw",
  "skyrimbridge",
  "truth-enb",
  "elder-enb",
  "enb-runtime-core",
  "studio-engine",
  "retro-engine",
  "engine-revival",
  "brender-archival",
].map(requireSystem);

const evidenceRows = [
  {
    measure: String(systems.length),
    label: "public system records",
    source: registry.schema,
    href: "/catalog.html",
    note: "purpose, boundary, maturity, and evidence fields",
  },
  {
    measure: String(systems.filter((system) => system.placement === "featured").length),
    label: "featured records",
    source: "system/systems.json",
    href: "/overview.html",
    note: "systems promoted to the public front of the catalog",
  },
  {
    measure: String(verifiedEvidence.length),
    label: "verified evidence rows",
    source: "system/systems.json",
    href: "/catalog.html",
    note: "release, source, or public-boundary records with dates",
  },
  {
    measure: String(primaryPlatforms.length),
    label: "primary platform",
    source: "architectureRole",
    href: localHref(featuredPlatform.href),
    note: "Flywheel is the platform layer inside the wider body of work",
  },
  {
    measure: retroManifest.brenderArchival.nativeCTestTargets,
    label: "BRender CTest record",
    source: "retro manifest",
    href: retroManifest.brenderArchival.release.href,
    note: "specific BRender Archival evidence, not generic retro media",
  },
  {
    measure: isoDate(currentBriefing.date_modified),
    label: "current briefing update",
    source: feed.title,
    href: currentBriefing.url,
    note: currentBriefing.title,
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
        <FeaturedFlywheel />
        <EvidenceBoard />
        <CapabilityOverview />
        <RepresentativeWork />
        <CurrentResearch />
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
        <a href="/hire.html">Hire / work</a>
        <a href="/overview.html">Systems</a>
        <a href="/research.html">Research</a>
        <a href="/studio.html">The Studio</a>
        <a href="/gallery.html">Gallery</a>
        <a href="/retro.html">Retro Engine</a>
        <a href="https://github.com/HarperZ9" rel="noopener">GitHub</a>
      </div>
      <details className="home-menu">
        <summary>Menu</summary>
        <div className="home-menu-list" aria-label="Primary menu">
          <a href="/hire.html">Hire / work</a>
          <a href="/overview.html">Systems</a>
          <a href="/research.html">Research</a>
          <a href="/studio.html">The Studio</a>
          <a href="/gallery.html">Gallery</a>
          <a href="/retro.html">Retro Engine</a>
          <a href="https://github.com/HarperZ9" rel="noopener">GitHub</a>
        </div>
      </details>
    </nav>
  );
}

function IdentityHero() {
  return (
    <header id="identity" className="hero">
      <div className="hero-copy reveal in">
        <h1 className="hero-title">Zain Dana Harper</h1>
        <p className="hero-line">Systems engineering, security tooling, graphics, and public research.</p>
        <p className="hero-lab">Zentropy Labs is the workshop behind Flywheel and the wider body of work.</p>
        <div className="hero-actions" aria-label="Primary actions">
          <a className="btn solid" href="#evidence-figures">Explore the work</a>
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

function FeaturedFlywheel() {
  const release = featuredPlatform.evidence[0];
  return (
    <section id="flywheel" className="section split-section">
      <div>
        <h2>Featured platform: Flywheel</h2>
        <p className="section-lead">
          Flywheel is the operating platform inside the work: a model-neutral route for agent tasks, tool use,
          verification receipts, and repeatable local or hosted workflows.
        </p>
        <div className="action-row">
          <a className="text-link" href={localHref(featuredPlatform.href)}>Inspect Flywheel</a>
          {featuredPlatform.sourceHref ? <a className="text-link" href={featuredPlatform.sourceHref} rel="noopener">Source</a> : null}
        </div>
      </div>
      <div className="data-plate platform-record">
        <table className="command-table">
          <caption>Current Flywheel route</caption>
          <tbody>
            <tr>
              <th scope="row">Release</th>
              <td><a href={release.href}>{release.label}</a></td>
            </tr>
            <tr>
              <th scope="row">Verified</th>
              <td>{release.date}</td>
            </tr>
            <tr>
              <th scope="row">Install</th>
              <td><code>{featuredPlatform.entryCommand}</code></td>
            </tr>
            <tr>
              <th scope="row">Check</th>
              <td><code>{featuredPlatform.verificationCommand}</code></td>
            </tr>
          </tbody>
        </table>
        <p className="boundary-note">{featuredPlatform.limitations[0]}</p>
      </div>
    </section>
  );
}

function EvidenceBoard() {
  return (
    <section id="evidence" className="section">
      <div className="section-heading">
        <h2>Evidence board</h2>
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
              <tr key={row.label}>
                <th scope="row"><a href={row.href}>{row.measure}</a></th>
                <td>{row.label}</td>
                <td>{row.source}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="does-not-prove">
          <strong>What this does not prove:</strong> counts and releases are evidence rows, not adoption claims, safety claims,
          or guarantees of model correctness. The board uses labels, shape, and line weight, so there are no color-only distinctions.
        </p>
      </div>
    </section>
  );
}

function CapabilityOverview() {
  return (
    <>
    <span id="make" hidden aria-hidden="true" />
    <section id="evidence-figures" className="section evidence-figures-section">
      <div className="section-heading">
        <h2>Measured evidence</h2>
        <p className="section-lead">
          These figures use source-attributed incident data and executed benchmark artifacts. Each includes its denominator, units,
          source hash or record, method, and limits. Decorative capability charts are not used as evidence.
        </p>
      </div>
      <div className="evidence-figure-grid">
        <article className="evidence-figure-card">
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
          <p><a href="/figures/recovered-actions-by-day.json">Read the dataset and provenance</a></p>
        </article>
        <article className="evidence-figure-card">
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
          <p><a href="/figures/motive-sample-nonexclusive.json">Read the dataset and provenance</a></p>
        </article>
        <article className="evidence-figure-card">
          <h3>Current cross-harness integration-failure profile</h3>
          <img
            className="research-figure-image"
            src="/analytics/current-cross-harness-pilot.svg"
            alt="Integration-failure profile for four cross-harness attempts on August 28, 2026. All four receipts verified, but zero attempts produced a valid comparable task outcome. Durations are diagnostic only."
            width="1120"
            height="480"
            loading="lazy"
          />
          <p>Byte-identical prompt and context parity produced 4/4 verified receipts and 0 valid comparable task outcomes. This is an integration-failure profile, not market performance or a quality ranking.</p>
          <p><a href="/analytics/current-cross-harness-pilot.html">Read exact outcomes, artifact hashes, null observations, and limits</a></p>
        </article>
      </div>
      <p className="boundary-note">
        <strong>Historical benchmark archive:</strong> <a href="/analytics/exploratory-stack-comparison.html">seven-case stack comparison</a>
        {" "}and <a href="/analytics/model-pass-at-1-comparison.html">164-task model comparison</a>. These older scoped results remain available,
        but they are not current headline evidence. <a href="/analytics/benchmark-evidence-status.html">Benchmark evidence status</a> retains the
        named baseline plan; a named target is not a result, and missing runs remain NOT_MEASURED.
      </p>
      <div className="family-browser">
        <h3>Browse the work by primary subject</h3>
        <p>These are navigation labels only. Every catalog record retains its own purpose, product type, maturity, source, and limitations.</p>
        <div className="family-index">
          {CAPABILITY_FAMILY_IDS.map((familyId) => {
            const domain = domainById.get(familyId);
            const familySystems = systems.filter((system) => system.primaryDomain === familyId);
            return (
              <article className="family-row" key={familyId}>
                <h3>{domain?.label ?? familyId}</h3>
                <p>{domain?.summary}</p>
                <a href={`/catalog.html#domain-${familyId}`}>{familySystems.length} primary records</a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
    </>
  );
}

function RepresentativeWork() {
  return (
    <section id="representative" className="section representative-section">
      <div className="section-heading">
        <h2>Representative work</h2>
        <p className="section-lead">
          A selected cross-section by role and proof. The catalog holds the full registry; this section shows the strongest public routes first.
        </p>
      </div>
      <div className="work-index">
        {representativeSystems.map((system) => (
          <article className="work-row" key={system.id}>
            <div>
              <h3><a href={localHref(system.href)}>{system.name}</a></h3>
              <p>{system.purpose}</p>
            </div>
            <dl>
              <div>
                <dt>Role</dt>
                <dd>{system.productType}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd><a href={evidenceHref(system)}>{system.evidence[0]?.label ?? system.maturity}</a></dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function CurrentResearch() {
  return (
    <section id="research" className="section split-section">
      <div>
        <h2>Current research</h2>
        <p className="section-lead">
          The publication surface is becoming a daily evidence archive: briefings, figures, source ledgers, and implementation notes for frontier
          safety, evaluation, infrastructure, and engineering shifts.
        </p>
        <div className="action-row">
          <a className="text-link" href="/publications.html">Publication index</a>
          <a className="text-link" href="/figures/recovered-actions-by-day.html">Measured figures</a>
        </div>
      </div>
      <article className="data-plate briefing-card">
        <h3><a href={currentBriefing.url}>{currentBriefing.title}</a></h3>
        <p>{currentBriefing.content_text}</p>
        <dl className="briefing-meta">
          <div>
            <dt>Published</dt>
            <dd>{isoDate(currentBriefing.date_published)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{isoDate(currentBriefing.date_modified)}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}

function RetroSystemsLab() {
  return (
    <section id="retro-systems-lab" className="section retro-section">
      <div className="section-heading">
        <h2>Graphics, engines, and preservation</h2>
        <p className="section-lead">
          Rendering platforms, Skyrim runtime integration, shader suites, browser graphics, procedural media, and software preservation are shown
          as separate products. Source state, releases, tests, and limitations remain attached to each project.
        </p>
      </div>
      <div className="retro-flow">
        {graphicsSystems.map((system) => (
          <article className="retro-step" key={system.id}>
            <span className="retro-verb">{system.productType}</span>
            <h3><a href={localHref(system.href)}>{system.name}</a></h3>
            <p>{system.purpose}</p>
            <a href={evidenceHref(system)}>{system.evidence[0]?.label ?? system.releaseState}</a>
          </article>
        ))}
      </div>
      <p className="boundary-note">Shared subject matter does not imply one parent product, a runtime dependency, or inherited evidence.</p>
    </section>
  );
}

function SecurityBoundary() {
  return (
    <section id="security-boundary" className="section security-section">
      <div className="section-heading">
        <h2>Security boundary</h2>
        <p className="section-lead">
          The security line includes public privacy and verification products plus distinct private systems for controlled offensive campaigns,
          native assessment, orchestration, model refusal and jailbreak testing, trust verification, operator execution, and release authority.
        </p>
      </div>
      <div className="security-layout">
        <article className="data-plate boundary-card">
          <h3>Distinct private operational systems</h3>
          <p>
            Array, Seed, Sofer, Isomorph, Bounds, ORCA, and Gate perform different jobs across an authorized engagement. Their public descriptions name
            those jobs. Targets, credentials, live payloads, client data, and engagement-specific findings stay in the approved private channel.
          </p>
          <a className="text-link" href="/security.html">Explore the security systems</a>
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
    <section id="hiring-collaboration" className="section hiring-section">
      <div>
        <h2>Hiring and collaboration</h2>
        <p className="section-lead">
          Three practical routes: engineering and evaluation, technical operations, and public-service or field work. The documents are direct,
          and the project evidence stays one click away.
        </p>
      </div>
      <div className="hiring-actions">
        <a className="btn solid" href="/hire.html">Hiring map</a>
        <a className="btn" href="/resume.html">Resume</a>
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
    </footer>
  );
}

export default App;
