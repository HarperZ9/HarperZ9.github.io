import { useEffect, type ReactNode } from "react";
import LiveBoard from "./LiveBoard";
import { EXTERNAL_ACTIONS, NEWEST_WRITING, PRIMARY_ROUTES, SECONDARY_GROUPS, routeFamily } from "./site-routes";
import { CAPABILITY_DOMAINS, EVIDENCE_STREAM, SYSTEMS, systemById, type SystemRecord } from "./system-registry";
import evidenceProjectionSource from "../site/evidence-stream.json?raw";
import "./App.css";
import { Idents } from "./Idents";
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

const FLYWHEEL_CURRENT = {
  label: "Flywheel 1.9.0",
  href: "https://github.com/HarperZ9/flywheel/releases/tag/v1.9.0",
  pypiHref: "https://pypi.org/project/flywheel-verify/1.9.0/",
  date: "2026-10-15",
};

const RESEARCH_SUPPORT_ROUTES = [
  {
    label: "Evaluator pilot",
    href: "/test-run-request.html",
    summary: "Bring one claim that matters to a decision and the evidence behind it. You leave with a check you can run again.",
  },
  {
    label: "Frontier lab or research review",
    href: "/publications.html",
    summary: "Read the figures, release records and essays, then send a correction or a challenge.",
  },
  {
    label: "Support or fund the work",
    href: "/hire.html#technical-operations-path",
    summary: "Evaluation tooling, Python developer tools, release infrastructure and research-engineering support.",
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
        <Flagships />
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
      <a className="brand" href="#identity" aria-label="Zain Dana Harper home">
        <span className="brand-name">Zain Dana Harper</span>
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
      <h1 className="hero-title">Zain Dana Harper</h1>
      <div className="hero-copy reveal in">
        <p className="hero-line">Flywheel and open-source tools for testing AI systems.</p>
        <p className="hero-lab">
          Zain Dana Harper builds Flywheel, which runs AI tasks with the model you choose and checks each answer, along with
          tools for writing, research intake and agent work. Install Flywheel and run a check on your own machine, or read the
          newest investigation below.
        </p>
        <p className="hero-audience">For evaluators, research teams and developers who test AI systems.</p>
        <div className="hero-actions" aria-label="Primary actions">
          <a className="btn solid" href="/flywheel.html">Inspect Flywheel</a>
          <a className="btn" href="#evidence">Review evidence</a>
          <a className="btn" href="#research-pilot-support">Pilot or support</a>
        </div>
        <p className="hero-start"><a href="/start-here.html">New here? Start with a plain guide to the site.</a></p>
        <nav className="edition-links" aria-label="Mission routes">
          <a href="/career/Flywheel-Platform-Brief.pdf">The Flywheel platform brief</a>
          <a href="/catalog.html">Public tool catalog</a>
          <a href="/publications.html">Writing</a>
          <a href="/checking-the-machines.html">Open letter: checking the machines</a>
          <a href="/night-school.html">Night School: how AI works, in short films and labs</a>
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

type Flagship = {
  id: string;
  name: string;
  headline: string;
  body: string;
  proof?: { text: string; href: string; label: string };
  visual:
    | { kind: "image"; srcLight: string; srcDark?: string; width: number; height: number; alt: string; caption: string; href?: string }
    | { kind: "terminal"; command: string; output: string; caption: string };
  install?: string;
  links: Array<{ label: string; href: string }>;
};

const ARTICULATE_OUTPUT = `[articulate] notes.md [technical-docs/explain]: 1 high, 3 medium (blocked)
  L1 [HIGH filler-intensifier] genuinely / really / truly / actually
  L1 [MEDIUM throat-clearing] throat-clearing opener
  L1 [MEDIUM hedge-stack] stacked hedge
  L1 [MEDIUM throat-clearing] worth-noting preamble`;

const BUILDLANG_OUTPUT = `Lexing... OK (12 tokens)
Parsing... OK (1 items)
Type errors found:
  1:1: [BL0402] function \`load_config\` performs effect \`FileSystem\` but does not declare it
  help: add \`FileSystem\` to the function's effect row
  note: capability \`FileSystem\` was triggered by ambient call(s): read_file`;

const FLAGSHIPS: Flagship[] = [
  {
    id: "flywheel",
    name: "Flywheel",
    headline: "Catch a wrong answer before your team acts on it.",
    body: "Flywheel runs AI tasks with the model you choose and checks each answer against the record it came from. In the demo, a summary says 42 tests passed; the record says 41, and Flywheel flags the difference.",
    proof: {
      text: "In release 1.9.0, its behavior check flagged 20 of 20 planted behavior changes and 0 of 50 unchanged pairs.",
      href: "https://github.com/HarperZ9/flywheel/releases/tag/v1.9.0",
      label: "Release notes",
    },
    visual: {
      kind: "image",
      srcLight: "/media/flywheel-output-check-20260905/poster.png",
      width: 1080,
      height: 1920,
      alt: "Flywheel demo card. The summary says 42 tests passed. The record says 41. Flywheel checks the answer against the record before it reaches your team.",
      caption: "A frame from the 36-second demo.",
      href: "/media/flywheel-output-check-20260905/short.mp4",
    },
    install: "pip install flywheel-verify",
    links: [
      { label: "Watch the demo", href: "/media/flywheel-output-check-20260905/short.mp4" },
      { label: "Flywheel 1.9.0", href: "https://github.com/HarperZ9/flywheel/releases/tag/v1.9.0" },
      { label: "How it works", href: "/flywheel.html" },
    ],
  },
  {
    id: "daylight-commons",
    name: "CMMNS",
    headline: "See who is behind a reply before you believe it.",
    body: "Rest the pointer on a reply on X, YouTube, Reddit, Facebook, Instagram, Bluesky, Threads, TikTok or Mastodon, and a window opens with where the account is based, how it posts, signs of coordination and who owns the outlets it links, each with its source. It works in Chrome, Edge, Brave and Firefox with no account, and it is open source (AGPL-3.0).",
    visual: {
      kind: "image",
      srcLight: "/media/daylight-commons/finding-sources.png",
      width: 600,
      height: 690,
      alt: "CMMNS on a synthetic demo thread. A window beside a reply that links rt.com says the outlet is state-owned by Russia, cites Wikidata for RT America, and links the Wikidata entry.",
      caption: "A synthetic demo thread: the window names the owner of a linked outlet and links its Wikidata source.",
    },
    links: [
      { label: "Install it", href: "https://harperz9.github.io/cmmns/install.html" },
      { label: "Daylight Commons 3.2.2", href: "https://github.com/HarperZ9/cmmns/releases/tag/v3.2.2" },
      { label: "Source", href: "https://github.com/HarperZ9/cmmns" },
    ],
  },
  {
    id: "articulate",
    name: "Articulate",
    headline: "Find the filler in your writing, line by line.",
    body: "Articulate names each writing pattern it finds and the line it is on: in the terminal, in your editor through its language server, or as SARIF in code review. Its optional editor rewrites a flagged passage with the model you choose.",
    visual: {
      kind: "terminal",
      command: "articulate check notes.md --mode technical-docs/explain",
      output: ARTICULATE_OUTPUT,
      caption: "Articulate 0.15.1 on one sentence: “It is important to note that this release really represents a significant step forward. Arguably, the new cache could potentially make builds faster in many cases.” Quoted text trimmed from each line.",
    },
    install: "pip install articulate-writing",
    links: [
      { label: "Try Articulate", href: "/articulate.html" },
      { label: "Articulate 0.15.1", href: "https://github.com/HarperZ9/articulate/releases/tag/v0.15.1" },
      { label: "PyPI", href: "https://pypi.org/project/articulate-writing/" },
    ],
  },
  {
    id: "buildlang",
    name: "BuildLang",
    headline: "Know what a program can touch before it runs.",
    body: "In BuildLang a function declares the effects it uses, such as file access. The compiler rejects code that reaches further than its signature says, and names the call that did it.",
    visual: {
      kind: "terminal",
      command: "buildc check missing_effect.bld",
      output: BUILDLANG_OUTPUT,
      caption: "buildc 1.8.0 on fn load_config() { read_file(\"ops.toml\"); }. The handler suggestion in the full output is cut for length.",
    },
    install: "cargo install buildlang",
    links: [
      { label: "See more examples", href: "/buildlang.html" },
      { label: "BuildLang 1.8.0 on crates.io", href: "https://crates.io/crates/buildlang/1.8.0" },
      { label: "Source", href: "https://github.com/HarperZ9/buildlang" },
    ],
  },
  {
    id: "raw-native",
    name: "raw-native",
    headline: "One renderer, the same frame on the CPU, D3D12 and the web.",
    body: "raw-native is a C++ renderer with a CPU reference and D3D12 and WebGPU backends. The RAW page runs it live in your browser.",
    proof: {
      text: "In release 0.8.0, default renders came out byte-identical across the Windows, D3D12, Linux and WebAssembly builds, and 60 of 60 tests passed with MSVC and GCC.",
      href: "https://github.com/HarperZ9/raw-native/releases/tag/v0.8.0",
      label: "Release notes",
    },
    visual: {
      kind: "image",
      srcLight: "/media/raw-native/high-frame.png",
      width: 512,
      height: 512,
      alt: "A red cube on a pale ground plane with soft ambient-occlusion shadow, rendered by the RAW CPU renderer.",
      caption: "A frame from the RAW CPU reference renderer.",
      href: "/raw.html",
    },
    links: [
      { label: "Render it live", href: "/raw.html" },
      { label: "raw-native 0.8.0", href: "https://github.com/HarperZ9/raw-native/releases/tag/v0.8.0" },
      { label: "Source", href: "https://github.com/HarperZ9/raw-native" },
    ],
  },
];

function FlagshipVisual({ item }: { item: Flagship }) {
  const visual = item.visual;
  if (visual.kind === "terminal") {
    return (
      <figure className="flagship-visual flagship-terminal data-plate">
        <pre><code><span className="flagship-prompt">$ {visual.command}</span>{"\n"}{visual.output}</code></pre>
        <figcaption>{visual.caption}</figcaption>
      </figure>
    );
  }
  const img = (
    <img src={visual.srcLight} width={visual.width} height={visual.height} alt={visual.alt} loading="lazy" decoding="async" />
  );
  return (
    <figure className={`flagship-visual flagship-image flagship-image-${item.id}`}>
      {visual.href ? <a href={visual.href}>{img}</a> : img}
      <figcaption>{visual.caption}</figcaption>
    </figure>
  );
}

function Flagships() {
  return (
    <section id="flagships" className="section flagships-section" aria-labelledby="flagships-title">
      <div className="section-heading">
        <h2 id="flagships-title">Flagship tools</h2>
        <p className="section-lead">Five tools you can try in a few minutes. Each one shows its work.</p>
      </div>
      <div className="flagship-list">
        {FLAGSHIPS.map((item) => (
          <article className="flagship" id={`flagship-${item.id}`} key={item.id} aria-labelledby={`flagship-${item.id}-name`}>
            <div className="flagship-copy">
              <p className="flagship-name" id={`flagship-${item.id}-name`}>{item.name}</p>
              <h3>{item.headline}</h3>
              <p>{item.body}</p>
              {item.proof ? (
                <p className="flagship-proof">{item.proof.text} <a href={item.proof.href} rel="noopener">{item.proof.label}</a></p>
              ) : null}
              {item.install ? <p className="flagship-install"><code><Idents text={item.install} /></code></p> : null}
              <p className="flagship-links">
                {item.links.map((link, index) => (
                  <a className={index === 0 ? "btn solid" : "text-link"} href={link.href} key={link.href} rel={link.href.startsWith("http") ? "noopener" : undefined}>{link.label}</a>
                ))}
              </p>
            </div>
            <FlagshipVisual item={item} />
          </article>
        ))}
      </div>
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
    title: "An open letter on checking the machines",
    meta: "Letter, 19 September 2026, revised 20 September 2026.",
    text: "A signed letter to the people who build AI systems. It argues that a person should be able to question a machine's answer without first winning an argument with its owner.",
    href: "/checking-the-machines.html",
    action: "Read the letter",
    cover: "cover-checking-the-machines",
    alt: "A grid of small square drawings, each a set of nested squares, with one square lit.",
  },
  {
    title: "Frontier Safety briefing",
    meta: "Recurring briefing, current edition.",
    text: "A dated record of safety news from the UK AI Security Institute, Anthropic, OpenAI and others, with each item linked to its source.",
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

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

function humanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

// The three newest pieces across every Writing section. Generated into site-routes.ts
// from publications/data/index.json by scripts/render-route-registry.mjs.
function NewestWriting() {
  return (
    <section className="newest-writing" aria-labelledby="newest-writing-title">
      <div className="newest-writing-head">
        <h3 id="newest-writing-title">Newest writing</h3>
        <a className="text-link" href="/publications.html">All writing</a>
      </div>
      <ol className="newest-writing-list">
        {NEWEST_WRITING.map((item) => (
          <li key={item.href}>
            <p className="recent-meta">{item.kind} · <time dateTime={item.publishedAt}>{humanDate(item.publishedAt)}</time></p>
            <h4><a href={item.href}>{item.title}</a></h4>
            <p>{item.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RecentWork() {
  return (
    <section id="recent-work" className="section recent-section" aria-labelledby="recent-title">
      <div className="section-heading">
        <h2 id="recent-title">Recent work</h2>
        <p className="section-lead">Writing and releases from the past month.</p>
      </div>
      <article className="data-plate recent-feature">
        <div className="recent-feature-copy">
          <h3><a href="/who-knew-first.html">Who Knew First</a></h3>
          <p className="recent-meta">Investigation and op-ed. Record published 23 September 2026, op-ed added 25 September 2026.</p>
          <p>By the record's account, the organization that ran the model held the decisive facts in each of nine AI agent incidents from 2026. In six of them, someone else told the public first.</p>
          <p><a className="text-link" href="/who-knew-first.html">Read the investigation</a></p>
          <p className="recent-series">Part of a series: <a href="/who-knew-first-series.html">Who Knew First, and what it opened</a></p>
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
      <NewestWriting />
      <div className="recent-grid">
        {RECENT_WORK.map((item) => (
          <article className="recent-card" key={item.href}>
            {item.cover ? (
              <figure className="art recent-cover">
                <img className="art-light" src={`/art/aperture/${item.cover}-light.svg`} width="1600" height="800" alt={item.alt} loading="lazy" decoding="async" />
                <img className="art-dark" src={`/art/aperture/${item.cover}-dark.svg`} width="1600" height="800" alt={item.alt} loading="lazy" decoding="async" />
              </figure>
            ) : null}
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
          Tools you can install and run. Each entry says what the tool does once and links to its page, release and source.
        </p>
      </div>
      <div className="work-index">
        {representativeSystems.map((system) => (
          <article className="work-row" key={system.id}>
            <div>
              <h3><a href={localHref(system.href)}>{system.name}</a></h3>
              <p><Idents text={system.purpose} /></p>
              <p className="product-status"><Idents text={system.releaseState} /> / {system.maturity}</p>
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
          <dd><Idents text={system.releaseState} /></dd>
        </div>
        <div>
          <dt>Verified</dt>
          <dd><time dateTime={system.lastVerified}>{system.lastVerified}</time></dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd><a href={evidenceHref(system)}><Idents text={system.evidence[0]?.label ?? system.maturity} /></a></dd>
        </div>
      </dl>
    </details>
  );
}

function FeaturedFlywheel() {
  return (
    <section
      id="flywheel"
      className="section split-section"
      aria-labelledby="flywheel-title"
    >
      <div>
        <h2 id="flywheel-title">Flagship platform: Flywheel</h2>
        <p className="section-lead">
          <Idents text={FLYWHEEL.purpose} />
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
              <th scope="row">Release</th>
              <td><a href={FLYWHEEL_CURRENT.href}>{FLYWHEEL_CURRENT.label}</a>, <time dateTime={FLYWHEEL_CURRENT.date}>{FLYWHEEL_CURRENT.date}</time>; <a href={FLYWHEEL_CURRENT.pypiHref}>PyPI</a></td>
            </tr>
            <tr>
              <th scope="row">Install</th>
              <td><code><Idents text={FLYWHEEL.entryCommand} /></code></td>
            </tr>
            <tr>
              <th scope="row">Check</th>
              <td><code><Idents text={FLYWHEEL.verificationCommand} /></code></td>
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
          Release records and dated evidence from the tool registry, each linked to its source.
        </p>
      </div>
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
                  <td><Idents text={row.label} /></td>
                  <td><Idents text={row.source} /></td>
                  <td><Idents text={row.note} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <section className="evidence-current" aria-labelledby="current-evidence-title">
            <h3 id="current-evidence-title">Recent registry evidence, newest first</h3>
            <ol>
              {CURRENT_EVIDENCE.map((evidence) => (
                <li key={`${evidence.systemId}:${evidence.id}`}>
                  <time dateTime={evidence.date}>{evidence.date}</time>
                  <a href={evidence.href} rel="noopener"><Idents text={evidence.label} /></a>
                  <span><Idents text={evidence.summary} /></span>
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
          Three ways to work together.
        </p>
      </div>
      <div className="route-ladder">
        {RESEARCH_SUPPORT_ROUTES.map((route) => (
          <a className="route-step" href={route.href} key={route.href}>
            <span>{route.label}</span>
            <small><Idents text={route.summary} /></small>
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
          Measured results, each with its data table.
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
          <p>Same task set and harness for both models.</p>
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
          <li><a href="/figures/recovered-actions-by-day.html">Recovered actions by day</a> (<a href="/figures/recovered-actions-by-day.svg">figure</a>, <a href="/figures/recovered-actions-by-day.json">dataset</a>): 5 daily observations from Hugging Face host telemetry. Unit: recovered logged actions.</li>
          <li><a href="/figures/motive-sample-nonexclusive.html">Reported motive labels</a> (<a href="/figures/motive-sample-nonexclusive.svg">figure</a>, <a href="/figures/motive-sample-nonexclusive.json">dataset</a>): a 100-agent peak-hour sample with non-exclusive labels. Categories overlap, so the counts must not be summed.</li>
        </ul>
      </details>
      <div className="family-browser">
        <h3>Browse the work by primary subject</h3>
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
          Renderers, Skyrim graphics mods and runtime tools, shader suites, colour tools and software preservation. Each entry links to its source and releases.
        </p>
      </div>
      <div className="retro-flow">
        {graphicsSystems.map((system) => (
          <article className="retro-step" key={system.id}>
            <span className="retro-verb">{system.accessMode}</span>
            <h3><a href={localHref(system.href)}>{system.name}</a></h3>
            <p><Idents text={system.purpose} /></p>
            <dl className="product-meta">
              <div><dt>Type</dt><dd>{productTypeLabel(system)}</dd></div>
              <div><dt>State</dt><dd><Idents text={system.releaseState} /></dd></div>
              <div><dt>Evidence</dt><dd><a href={evidenceHref(system)}><Idents text={system.evidence[0]?.label ?? system.maturity} /></a></dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function SecurityBoundary() {
  return (
    <section id="security-boundary" className="section security-section" aria-labelledby="security-title">
      <div className="section-heading">
        <h2 id="security-title">Security platforms</h2>
        <p className="section-lead">
          Public security tools link to their releases. Private systems have a short page each and are used only under a written engagement.
        </p>
      </div>
      <div className="security-layout">
        <article className="data-plate boundary-card">
          <h3>Private systems</h3>
          <p>
            Private systems are used only with written authorization and a defined scope. Their source, methods and findings are not published.
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
          Three routes: technical support and QA, evaluation tooling and Python developer tools, and public-service or field work.
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
              <small><Idents text={route.summary} /></small>
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
      <p>Zain Dana Harper. Flywheel, AI testing tools, graphics, security tooling and writing.</p>
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
