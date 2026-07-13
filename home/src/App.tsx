import { useEffect, type CSSProperties } from "react";
import EmetWitness from "./EmetWitness";
import GateDemo from "./GateDemo";
import ProofPacket from "./ProofPacket";
import WitnessedIndependence from "./WitnessedIndependence";
import Picker from "./Picker";
import LogoField from "./LogoField";
import GroundField from "./GroundField";
import Emphasis from "./Emphasis";
import "./App.css";

type Engine = {
  name: string; role: string; verdict: string; shipped?: boolean;
  desc: string; href: string; src: string; srcLabel: string;
};

type RecordedWorkflow = {
  name: string;
  version: string;
  duration: string;
  outcome: string;
  facts: string[];
  href: string;
  poster: string;
  alt: string;
};

// Primary `href` routes to the engine's page on this site; `src` is the
// package or repository link. The visitor stays in the workshop first.
const ENGINES: Engine[] = [
  { name: "flywheel", role: "route & verify any model", verdict: "public · GitHub · FSL-1.1", shipped: true,
    desc: "A companion for every model. Routes to any model, local or hosted, online or offline, answers what it can verify, escalates only the hard part, and hands back a receipt you can re-run yourself. It does what every router does, plus the one thing none of them do: it checks the work.",
    href: "/flywheel.html", src: "https://github.com/HarperZ9/flywheel", srcLabel: "GitHub" },
  { name: "telos", role: "perceive & make", verdict: "Telos 0.1.0 · public workbench",
    desc: "The shared workbench. Durable session state, native control of the workstation, sensory organs for screens and files, and a discovery forge, so a person and a model work the same surface at the same time.",
    href: "/studio.html", src: "https://github.com/HarperZ9/telos", srcLabel: "GitHub" },
  { name: "index", role: "map workspaces", verdict: "index-graph 2.9.0 · PyPI", shipped: true,
    desc: "Maps your whole multi-repo workspace in seconds: nine language ecosystems, dependency and symbol graphs, fully offline, zero dependencies. Then certifies the map against the architecture you meant.",
    href: "/index-graph.html", src: "https://pypi.org/project/index-graph/", srcLabel: "PyPI" },
  { name: "gather", role: "intake & capture", verdict: "gather-engine 1.6.1 · PyPI", shipped: true,
    desc: "Research intake that reaches the hard places: gated APIs, paywalls, JS-walled pages, scanned PDFs. DOM extraction, structured capture, and change tracking built in. Provenance rides along free.",
    href: "/gather.html", src: "https://pypi.org/project/gather-engine/", srcLabel: "PyPI" },
  { name: "forum", role: "orchestrate", verdict: "Forum 1.13.0 · fair-source",
    desc: "Runs fleets of agents with routing, quality gates, and prose contracts, then hands you a causal ledger of who did what and why that replays step by step. Multi-agent work stops being an opaque box.",
    href: "/forum.html", src: "https://github.com/HarperZ9/forum", srcLabel: "GitHub" },
  { name: "crucible", role: "judge", verdict: "Crucible 1.2.0 · release candidate",
    desc: "A judgment engine. Registers a thesis, steelmans each claim, measures it against a substrate, and refines the weakest axis until the result is useful. Full paper trail included.",
    href: "/crucible.html", src: "https://github.com/HarperZ9/crucible", srcLabel: "GitHub" },
  { name: "emet", role: "byte integrity", verdict: "EMET 1.1.0 · four languages · PyPI",
    desc: "Byte-integrity tooling. Re-derives a file's bytes from scratch in four independent implementations. Point it at anything; it alters nothing.",
    href: "/emet.html", src: "https://github.com/HarperZ9/emet", srcLabel: "GitHub" },
  { name: "buildlang", role: "author", verdict: "BuildLang 1.2.0 · public release", shipped: true,
    desc: "A real systems language: typed capability effects, sum and linear types, C FFI, native binaries. What a function may do is part of its type, checked at compile time, lowered through a verified C path.",
    href: "/buildlang.html", src: "https://github.com/HarperZ9/buildlang", srcLabel: "GitHub" },
  { name: "learn", role: "learning aid + course engine", verdict: "Learn 1.6.0 · zero-dep Node", shipped: true,
    desc: "Turns your own material into a runnable course: spaced repetition, retrieval practice, self-explanation graded by crucible, zero dependencies. Graded steps leave records, not vibes.",
    href: "/learn.html", src: "https://github.com/HarperZ9/learn", srcLabel: "GitHub" },
  { name: "relay", role: "code with any model", verdict: "Relay 0.1.0 · public source", shipped: true,
    desc: "A zero-dependency coding agent for any endpoint: local weights, a subscription CLI, or an API. Failover across providers, a gated tool loop, and a witnessed ledger of every step.",
    href: "https://github.com/HarperZ9/relay", src: "https://github.com/HarperZ9/relay", srcLabel: "GitHub" },
  { name: "plexus", role: "wire tools together", verdict: "Plexus 0.1.0 · public source", shipped: true,
    desc: "Capability discovery and auto-wiring for agent toolchains. It reads what each tool emits and consumes, then connects them into a working pipeline you can inspect.",
    href: "https://github.com/HarperZ9/plexus", src: "https://github.com/HarperZ9/plexus", srcLabel: "GitHub" },
  { name: "mneme", role: "agent memory", verdict: "Mneme 0.1.0 · public source", shipped: true,
    desc: "Accountable memory for agents: layered stores and hybrid retrieval where every memory carries its provenance, so recall traces back to its source.",
    href: "https://github.com/HarperZ9/mneme", src: "https://github.com/HarperZ9/mneme", srcLabel: "GitHub" },
  { name: "studio-engine", role: "generate worlds", verdict: "Studio Engine 0.2.0 · public source", shipped: true,
    desc: "Generates replayable creative worlds: shaders, sound, and motion timelines drawn from a seed and carried with a receipt, so the same inputs redraw the same world.",
    href: "https://github.com/HarperZ9/studio-engine", src: "https://github.com/HarperZ9/studio-engine", srcLabel: "GitHub" },
  { name: "build color", role: "measure color", verdict: "Build Color 1.0.2 · PyPI · beta", shipped: true,
    desc: "A color-science workbench with perceptual spaces, color-difference metrics, chromatic adaptation, HDR tone mapping, gamut tools, and ICC profile generation. It measures digital color behavior; it is not a physical display instrument.",
    href: "/build-color.html", src: "https://pypi.org/project/build-color/", srcLabel: "PyPI" },
];

const RECORDED_WORKFLOWS: RecordedWorkflow[] = [
  {
    name: "Index",
    version: "Index 2.9.0",
    duration: "30-second cut + 118-second run",
    outcome: "Map a sanitized three-repository workspace, verify three evidenced edges, fit the relevant system into a bounded context, and render an offline atlas.",
    facts: ["3 repositories", "3 evidenced edges", "bounded context", "offline atlas"],
    href: "/demo-index.html",
    poster: "/media/demos/index/index-demo-poster.png",
    alt: "Index workbench showing a three-repository map and verified dependency edges",
  },
  {
    name: "Gather",
    version: "Gather 1.6.1",
    duration: "29-second cut + full run",
    outcome: "Extract seven source blocks, store two useful records, verify both against their provenance, and expose the changed-receipt path.",
    facts: ["7 blocks extracted", "2 records stored", "2 of 2 match", "tamper caught"],
    href: "/demo-gather.html",
    poster: "/media/demos/gather/gather-workflow-short-poster.png",
    alt: "Gather workflow showing extracted source blocks, stored records, and a provenance match",
  },
  {
    name: "Forum",
    version: "Forum 1.13.0",
    duration: "27-second cut + full run",
    outcome: "Route one cross-domain request through three dependent task waves, validate every result, preserve checkpoints, and re-check the causal ledger.",
    facts: ["3 dependency waves", "3 validator passes", "3 checkpoints", "19 ledger entries"],
    href: "/demo-forum.html",
    poster: "/media/demos/forum/forum-demo-short-poster.png",
    alt: "Forum workflow showing a routed request, three execution waves, checkpoints, and ledger verification",
  },
  {
    name: "Crucible",
    version: "Crucible 1.2.0",
    duration: "30-second cut + 94-second run",
    outcome: "Hold a three-claim thesis fixed while the artifact moves from one match and two drifts to three matches and zero drift.",
    facts: ["1 match / 2 drift", "3 match / 0 drift", "2 reviews pass", "re-derived from disk"],
    href: "/demo-crucible.html",
    poster: "/media/demos/crucible/crucible-workflow-short-poster.png",
    alt: "Crucible workflow comparing a draft with two drifts against a refined artifact with three matches",
  },
];

type Paper = { tag: "SYSTEMS" | "PREPRINT" | "NOTE"; title: string; line: string; doi: string; pdf: string };

const PAPERS: Paper[] = [
  { tag: "SYSTEMS", doi: "10.5281/zenodo.21230267", pdf: "/papers/emet-integrity-witness.pdf",
    title: "EMET: An Authority-Incapable Byte-Level Integrity Witness",
    line: "A byte-integrity artifact with four independent implementations checked against one conformance corpus." },
  { tag: "SYSTEMS", doi: "10.5281/zenodo.21231253", pdf: "/papers/buildlang-capability-effects.pdf",
    title: "BuildLang: Accountable Compute via Typed Capability Effects",
    line: "The capabilities a function may exercise appear in its type, then lower through a constrained systems-language path." },
  { tag: "PREPRINT", doi: "10.5281/zenodo.21232206", pdf: "/papers/witnessed-independence.pdf",
    title: "Witnessed Independence: Recording Whether a Verifier Graded Its Own Work",
    line: "Turns a criterion it did not author from an assumption into a recorded, three-valued field of the verdict." },
  { tag: "PREPRINT", doi: "10.5281/zenodo.21231406", pdf: "/papers/proof-packets.pdf",
    title: "Proof Packets: A Derive-Don't-Trust Envelope for Accountable Agent Actions",
    line: "The verdict for one agent action is derived from checks, never read from the packet." },
  { tag: "NOTE", doi: "10.5281/zenodo.21234475", pdf: "/papers/personhood-gate-handoff.pdf",
    title: "The Personhood-Gate Handoff: Drawing the Automation Boundary at the False-Signal Line",
    line: "Hand off to the operator exactly when a step would transmit a false human-present signal to a third party." },
  { tag: "NOTE", doi: "10.5281/zenodo.21231311", pdf: "/papers/re-perceived-effects.pdf",
    title: "Re-Perceived Effects: A Well-Formedness Contract for Accountable Actuation",
    line: "Replaces an actuator's self-report with a re-perceived effect, admitted before the fact by a capability gate." },
];

export default function App() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
    // Failsafe: nothing stays un-revealed forever if the observer misses.
    const settle = window.setTimeout(() => els.forEach((e) => e.classList.add("in")), 4000);
    return () => { io.disconnect(); window.clearTimeout(settle); };
  }, []);

  // The brand aperture as a cursor aura that trails the pointer (public/system module, native
  // import so Vite leaves it in /public). It self-skips touch pointers and reduced motion.
  useEffect(() => {
    const nativeImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
    let handle: { destroy(): void } | null = null;
    nativeImport("/system/cursor-field.js")
      .then((mod) => { handle = mod.mountCursorField(); })
      .catch(() => {});
    return () => { if (handle) handle.destroy(); };
  }, []);

  return (
    <>
      <GroundField />
      <div className="viewport-vignette" aria-hidden="true" />
      {/* turbulence displacement so straight CSS borders ripple into organic liquid edges */}
      <svg className="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="organic-edge" x="-60%" y="-150%" width="220%" height="400%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <a className="skip-link" href="#main">Skip to content</a>

      <nav className="topnav" aria-label="Primary">
        <a className="brand" href="#top" aria-label="Home, Project Telos">
          <span className="brand-field"><LogoField /></span>
          <span className="brand-word mono">TELOS</span>
        </a>
        <div className="topnav-links">
          <a href="#engines">Engines</a>
          <a href="#recorded">Recorded</a>
          <a href="#demonstrate">Live checks</a>
          <a href="#research">Research</a>
          <a href="#range">Range</a>
          <a href="/security.html">Security</a>
          <a href="#work">Work with me</a>
          <a className="mono ghost" href="https://github.com/HarperZ9" rel="noopener">GitHub ↗</a>
        </div>
      </nav>

      <main id="main">
        <header id="top" className="hero">
          <div className="hero-veil" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-masthead">
              <h1 className="hero-title reveal in d1">
                Work you can <Emphasis kind="mark">walk away</Emphasis> from.
              </h1>
              <p className="lead reveal in d2">
                <Emphasis kind="pill">Zain Dana Harper</Emphasis> builds tools across AI, code, graphics, and research that run anywhere and earn your <Emphasis kind="mark">trust</Emphasis>, not your attention. Each one shows its work, and gives you your <Emphasis kind="mark">time back</Emphasis>.
              </p>
              <div className="cta reveal in d3">
                <a className="btn solid" href="#recorded">Watch the workflows <span aria-hidden="true">→</span></a>
                <a className="btn" href="#engines">The engines <span aria-hidden="true">→</span></a>
                <a className="btn" href="#work">Work with me <span aria-hidden="true">→</span></a>
              </div>
              <p className="hero-availability reveal in d3">
                <a href="#work">Available for paid work, contract builds, and technical collaboration.</a>
              </p>
            </div>
          </div>
          {/* a cropping onto the live field, not a frame around it: the caption marks the
              aperture, the field expands past it into the page */}
          <figure className="hero-crop mono" aria-hidden="true">
            <span className="crop-t">Aperture</span>
            <span className="crop-d">seed 58 · a live GPU field</span>
          </figure>
          <p className="scroll-cue mono" aria-hidden="true">scroll ↓</p>
        </header>

        <section id="engines" className="band">
          <div className="shell">
            <div className="sec-head reveal">
              <h2>Fourteen engines,<br /><span className="spectrum-word">many doors.</span></h2>
              <p className="measure lead-2">
                The Flywheel thesis is simple: each engine stands on its own, then its verified
                outputs become reusable inputs for the next. The roster spans routing, intake,
                mapping, orchestration, judgment, byte integrity, typed effects, learning, color,
                memory, interoperability, and shared human/model creation.
              </p>
            </div>

            <ol className="engines" aria-label="Flagship engines">
              {ENGINES.map((e, i) => (
                <li className="engine reveal" style={{ "--i": String(i) } as CSSProperties} key={e.name}>
                  <div className="eng-index mono"><span className="eng-band" aria-hidden="true" />{String(i + 1).padStart(2, "0")}</div>
                  <div className="eng-id">
                    <h3 className="eng-name">{e.name}</h3>
                    <span className="eng-role">{e.role}</span>
                    <span className={"eng-verdict mono" + (e.shipped ? " shipped" : "")}>{e.verdict}</span>
                  </div>
                  <p className="eng-desc">{e.desc}</p>
                  <div className="eng-go">
                    <a className="eng-open" href={e.href}>open <span aria-hidden="true">→</span></a>
                    <a className="eng-src mono" href={e.src} rel="noopener">{e.srcLabel} ↗</a>
                  </div>
                </li>
              ))}
            </ol>
            <p className="measure lead-2 reveal">
              The full lineup, with private-line slices and utilities, lives on{" "}
              <a href="/overview.html">the engine room page</a>.
            </p>

            <Picker />
          </div>
        </section>

        <section id="recorded" className="band band-alt">
          <div className="shell">
            <div className="sec-head reveal">
              <h2>Recorded workflows</h2>
              <p className="measure lead-2">
                Each evidence package contains a short cut, full run, transcript, and reproduction notes.
                Browse the <a href="/demonstrations.html">complete recorded workflow library</a>.
              </p>
            </div>
            <ol className="recorded-list" aria-label="Current recorded workflows">
              {RECORDED_WORKFLOWS.map((workflow, i) => (
                <li className="recorded-item" key={workflow.name}>
                  <article className="recorded-shot">
                    <figure className="recorded-figure">
                      <img
                        src={workflow.poster}
                        alt={workflow.alt}
                        width="1920"
                        height="1080"
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                      <figcaption><span>{workflow.version}</span> · {workflow.duration}</figcaption>
                    </figure>
                    <div className="recorded-copy">
                      <h3>{workflow.name}</h3>
                      <p className="recorded-outcome">{workflow.outcome}</p>
                      <ul className="recorded-facts" aria-label={`${workflow.name} recording facts`}>
                        {workflow.facts.map((fact) => <li key={fact}>{fact}</li>)}
                      </ul>
                      <a className="recorded-action" href={workflow.href}>
                        Watch the workflow <span className="recorded-arrow" aria-hidden="true">→</span>
                      </a>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="demonstrate" className="band">
          <div className="shell">
            <div className="sec-head reveal">
              <h2>Try four browser-native checks</h2>
              <p className="measure lead-2">
                These small interactive witnesses run on your bytes in the browser. They are distinct from
                the complete recorded workflows above.
              </p>
            </div>
            <div className="demos">
              <div className="reveal d1"><EmetWitness /></div>
              <div className="reveal d2"><GateDemo /></div>
              <div className="reveal d1"><ProofPacket /></div>
              <div className="reveal d2"><WitnessedIndependence /></div>
            </div>
          </div>
        </section>

        <section id="cases" className="band band-alt">
          <div className="shell">
            <div className="sec-head reveal">
              <h2>Many lanes,<br />one workshop.</h2>
              <p className="measure lead-2">
                A few routes through the workshop. Illustrations, not deployments; everything that
                actually runs is linked above, so try it against your own workflow.
              </p>
            </div>
            <ul className="cases" aria-label="Scenarios">
              <li className="case reveal"><span className="case-name">Model workflows</span><p>Local endpoints, harnesses, context maps, and agent loops move from one-off sessions into repeatable workflows.</p></li>
              <li className="case reveal d1"><span className="case-name">Research intake</span><p>Gather reaches gated APIs, JS-walled pages, scans, audio, and papers, then records enough context to make the intake useful later.</p></li>
              <li className="case reveal d2"><span className="case-name">Workspace maps</span><p>Index turns a repo or many-repo workspace into an atlas so onboarding starts from a map, not from memory.</p></li>
              <li className="case reveal"><span className="case-name">Generated media</span><p>The site material is generated by its own engines: flow fields, specimens, seeds, captures, and visual systems.</p></li>
              <li className="case reveal d1"><span className="case-name">Graphics systems</span><p>D3D11, HLSL, color spaces, calibration, and render-pipeline work sit beside the model tooling rather than under it.</p></li>
              <li className="case reveal d2"><span className="case-name">Work threads</span><p>A concrete artifact - repo, workflow, paper, demo, site, benchmark, or prototype - is the best starting point.</p></li>
            </ul>
          </div>
        </section>

        <section id="research" className="band">
          <div className="shell">
            <div className="sec-head reveal">
              <h2>Six papers,<br /><span className="spectrum-word">on the record.</span></h2>
              <p className="measure lead-2">
                The publications are one research lane inside the wider workshop: byte integrity, typed
                effects, automation boundaries, action envelopes, and made-mind philosophy. Six papers
                are archived on Zenodo with permanent DOIs, and hosted here as direct PDFs.
              </p>
            </div>

            <ol className="papers" aria-label="Publications">
              {PAPERS.map((p, i) => (
                <li className="paper reveal" style={{ "--i": String(i) } as CSSProperties} key={p.doi}>
                  <span className={"paper-tag mono tag-" + p.tag.toLowerCase()}>{p.tag}</span>
                  <div className="paper-body">
                    <h3 className="paper-title">{p.title}</h3>
                    <p className="paper-line">{p.line}</p>
                  </div>
                  <span className="paper-doi mono">
                    <a href={p.pdf}>PDF</a> · <a href={"https://doi.org/" + p.doi} rel="noopener">{p.doi} ↗</a>
                  </span>
                </li>
              ))}
            </ol>
            <p className="paper-close reveal">
              A paper that claims more than its evidence is a liability. These are titled at their real size
              on purpose. ORCID{" "}
              <a className="mono" href="https://orcid.org/0009-0001-7175-5393" rel="noopener">0009-0001-7175-5393</a>.
              The full index, with abstracts, lives on <a href="/publications.html">the publications page</a>.
            </p>
          </div>
        </section>

        <section id="range" className="band band-alt">
          <div className="shell">
            <div className="sec-head reveal">
              <h2>One engineer,<br />an unusual span.</h2>
              <p className="measure lead-2">
                The public range is wider than any single research lane: local models, graphics, reverse
                engineering, color systems, generated media, and web surfaces all sit in the same workshop.
              </p>
            </div>
            <div className="range-grid">
              <article className="range-card reveal">
                <h3>graphics &amp; reverse engineering</h3>
                <p className="range-meta mono">D3D11 · HLSL · native · proxy-DLL interception</p>
                <p>From-scratch D3D11/HLSL frameworks that take ownership of a game's render pipeline, and the primary vehicle for hands-on reverse engineering: binary analysis, runtime instrumentation, live game-state extraction.</p>
                <p className="range-proof">Elder ENB, a lighting preset shipped across roughly 280 releases, has earned <b>900,000+ downloads</b> on NexusMods. Public, so you can <a href="https://www.nexusmods.com/skyrimspecialedition/mods/117327" rel="noopener">check it</a>.</p>
              </article>
              <article className="range-card reveal d1">
                <h3>color science &amp; rendering</h3>
                <p className="range-meta mono">ICC · 3D-LUT · CIEDE2000 · Oklab · CAT16 · HDR</p>
                <p>Build Color spans perceptual spaces, color-difference metrics, tone mapping, gamut work, color-vision-deficiency simulation, and ICC generation. Perception made measurable in software.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="work" className="band">
          <div className="shell work-wrap">
            <div className="work-head reveal">
              <p className="pull">Bring the knot,<br />make it tangible.</p>
            </div>
            <div className="work-body reveal d1">
              <p>
                Self-taught systems engineer, open across roles, industries, and work modes. No CS degree; the
                public releases are the credential. The strongest fit is any environment that needs someone who
                can enter ambiguity, learn the domain fast, build a reliable artifact, and explain it to anyone.
              </p>
              <p className="floor-line">
                This is the fit: unusual technical scope, fast learning, and practical artifacts across systems,
                models, graphics, research, and web surfaces. Bring a concrete problem; I will turn it into a
                scoped run with visible outputs.
              </p>
              <div className="cta">
                <a className="btn solid" href="https://github.com/HarperZ9" rel="noopener">GitHub <span aria-hidden="true">→</span></a>
                <a className="btn" href="/resume.html">Resume <span aria-hidden="true">→</span></a>
                <a className="btn" href="/publications.html">Papers <span aria-hidden="true">→</span></a>
                <a className="btn" href="/demonstrations.html">Recorded workflows <span aria-hidden="true">→</span></a>
                <a className="btn" href="mailto:zaindharper@gmail.com">Email <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-foot">
        <div className="shell">
          <p className="foot-big reveal">Open the workshop,<br />then follow the working surface.</p>
          <nav className="foot-links reveal d1" aria-label="Deep pages">
            <a href="/guide.html">Guide</a>
            <a href="/catalog.html">Catalog</a>
            <a href="/research.html">Research</a>
            <a href="/publications.html">Publications</a>
            <a href="/writing.html">Writing</a>
            <a href="/studio.html">Studio</a>
            <a href="/typeface.html">Typeface</a>
            <a href="/resume.html">Resume</a>
            <a href="/person.html">The person</a>
          </nav>
          <p className="foot-note mono reveal d1">
            Project Telos · built by Zain Dana Harper in Seattle · engines, demos, papers, graphics,
            generated media, and work routes.
          </p>
        </div>
      </footer>
    </>
  );
}
