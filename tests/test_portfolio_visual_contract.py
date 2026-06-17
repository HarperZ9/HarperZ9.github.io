from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
STYLES = ROOT / "styles.css"
WARDEN = ROOT / "warden.html"
EMET = ROOT / "emet.html"
SAMPLE_PAGES = [
    ROOT / "proof-surface-sample.html",
    ROOT / "proof-index-sample.html",
    ROOT / "public-surface-sweeper-sample.html",
    ROOT / "emet-sample.html",
]


def page_source() -> str:
    return INDEX.read_text(encoding="utf-8") + "\n" + STYLES.read_text(encoding="utf-8")


def index_source() -> str:
    return INDEX.read_text(encoding="utf-8")


def warden_source() -> str:
    assert WARDEN.exists(), "warden.html must exist"
    return WARDEN.read_text(encoding="utf-8") + "\n" + STYLES.read_text(encoding="utf-8")


def emet_source() -> str:
    assert EMET.exists(), "emet.html must exist"
    return EMET.read_text(encoding="utf-8")


def public_html_sources() -> str:
    paths = [INDEX, WARDEN, EMET, *SAMPLE_PAGES]
    return "\n".join(path.read_text(encoding="utf-8") for path in paths)


def test_portfolio_keeps_clean_white_backdrop() -> None:
    source = page_source()

    assert "--bg-mid:#ffffff" in source
    assert "body{background:#ffffff" in source


def test_grain_and_bloom_are_visible_not_disabled() -> None:
    source = page_source()

    assert ".grain{position:fixed" in source
    assert ".bloom{position:fixed" in source
    assert not re.search(r"\.bg,\s*\.sun,\s*\.grain,\s*\.bloom\{display:none\s*!important", source)
    assert "mix-blend-mode:multiply" in source


def test_glass_containers_have_active_frosted_material() -> None:
    source = page_source()

    assert "backdrop-filter:var(--glass-blur)" in source
    assert "box-shadow:var(--glass-shadow)" in source
    assert not re.search(r"\.glass\{[^}]*backdrop-filter:none", source)
    assert not re.search(r"\.glass\{[^}]*box-shadow:none", source)


def test_work_rows_receive_glass_treatment() -> None:
    source = page_source()

    assert '<article class="wrow glass">' in source
    assert ".wrow.glass" in source


def test_live_frontend_surfaces_are_listed() -> None:
    source = page_source()

    assert "Harper Advocates" in source
    assert "Harper Compliance" in source
    assert "https://harperadvocates.com" in source
    assert "https://harpercompliance.llc" in source
    assert "Live service surfaces" in source
    assert "private GitHub repos" in source


def test_accessible_navigation_and_page_landmarks() -> None:
    source = page_source()

    assert 'class="skip-link" href="#main"' in source
    assert ".skip-link{position:fixed" in source
    assert "clip-path:inset(50%)" in source
    assert ".skip-link:focus,.skip-link:focus-visible" in source
    assert '<nav aria-label="Primary">' in source
    assert '<main id="main">' in source
    assert 'aria-label="34 public GitHub repositories verified via GitHub"' in source
    assert 'aria-label="868 documented compiler tests"' in source
    assert 'aria-label="19 EMET conformance vectors"' in source
    assert "scroll-margin-top:5rem" in source


def test_nav_brand_is_clean_and_public_copy_has_no_mojibake() -> None:
    source = public_html_sources()

    assert '<a class="brand" href="#top">Zain Dana Harper</a>' in source
    assert "Zain Dana Harper <span>portfolio</span>" not in source
    assert "Â" not in source
    assert "·" not in source
    assert "&middot;" in source


def test_portfolio_hero_accountability_framing() -> None:
    source = page_source()

    # New hero copy — accountability framing via the redesigned hero-anchor layout
    assert "I build tools that make AI-assisted work prove itself." in source
    assert "I'm Zain" in source or "I’m Zain" in source or "Hi — I'm Zain." in source or "Hi &mdash; I'm Zain." in source
    assert "check what it did" in source
    assert "starting with EMET" in source
    # Orientation panel content (unchanged)
    assert "At a glance" in source
    assert "What this site is" in source
    assert "A portfolio, consulting surface, and map of public engineering artifacts." in source
    assert "Best fit" in source
    assert "bilateral provenance" in source
    assert "live-state organs" in source
    assert "Where to go next" in source
    assert "Open EMET for the accountability spine" in source
    assert "Public work" in source
    assert "Contact" in source
    # Outreach band presence and its three CTAs
    assert "Three ways to work together" in source
    assert "outreach-band" in source
    assert "Freelance &amp; consulting" in source
    assert "Open source" in source
    assert "Research collaboration" in source


def test_portfolio_accountability_architecture_section() -> None:
    source = page_source()

    assert "Accountability architecture" in source
    assert "Seven layers the newest agentic-accountability research converges on." in source
    assert "a tool whose pitch is verifiability cannot overclaim its own stack" in source
    # Layer names
    assert "Reviewability artifacts" in source
    assert "Cryptographic attestation" in source
    assert "in-toto / SLSA / Sigstore lineage" in source
    assert "Bilateral provenance" in source
    assert "Live-state verification" in source
    assert "Evaluation as a contract" in source
    assert "Traceable memory" in source
    assert "calibrated uncertainty" in source
    assert "Identity &amp; scoped authority" in source
    assert "signed delegation" in source
    assert "Resource gates in-loop" in source
    # Status badges — all seven architecture layers are now shipped
    assert "Shipped" in source
    assert "In development" not in source  # Identity (signed delegation) shipped; no layer left in-development
    assert "delegation chain" in source  # the Identity layer cites the proof-surface delegation chain
    assert "proof-surface" in source  # shipped layers cite the proof-surface contract family
    # Why now line
    assert "NIST" in source
    assert "in-toto/SLSA/SPIFFE" in source
    assert "C2PA" in source
    assert "Auditable Agents" in source
    assert "ProvenanceGuard" in source
    assert "Green SARC" in source


def test_portfolio_consulting_lanes_present() -> None:
    source = page_source()

    assert "AI accountability and release review" in source
    assert "Turn ambitious claims into reviewable evidence." in source
    assert "Bilateral provenance layers" in source
    assert "high-stakes authorized research environments" in source
    assert "long-term red-team work, biological research, government-supervised defense or weapons-adjacent engineering" in source
    assert "Proof before public trust" in source
    assert "QuantaLang makes the ambition concrete." in source
    assert "836 tracked <code>.quanta</code> files" in source
    assert "QuantaLang is the effects-language side of the same live-state thesis" in source
    assert "Safety, transparency, and creativity should evolve on the same surface." in source
    assert "The same gap that makes AI dangerous also makes it feel limited: models infer state from assertions, memory, and context instead of sensing the world natively." in source
    assert "bilateral provenance, programmatic live-state organs, byte-level witnesses" in source
    assert "the pattern is the same: turn messy work into something inspectable" in source
    for stale_phrase in [
        "Current paid wedge",
        "behind the wedge",
        "High-leverage tools",
        "Day delivery",
        "prompt-and-pray",
        "conducting an orchestra",
        "I like ambitious systems",
        "I map what the surface claims",
        "This is Zain Dana Harper's public portfolio and consulting page. I build",
        "Operational exploit detail",
        "a lot still to learn",
        "Working systems with receipts",
        "Public claims, backed by evidence",
        "Immediate value as of June 15, 2026",
        "Code first. Claims second",
        "Start with what is built",
        "QuantaLang is the main engineering artifact.",
        "Most utilities are narrow on purpose.",
        "Who uses it:",
        "What it does not claim:",
        "What you can judge today",
        "The public surfaces are inspectable.",
        "Claims stop where the evidence stops.",
    ]:
        assert stale_phrase not in source


def test_public_lineup_table_is_present() -> None:
    source = page_source()

    assert 'id="lineup"' in source
    assert "Public lineup" in source
    assert "Developer workflow utilities" in source
    assert "Accountability and bilateral provenance" in source
    assert "Signal and anomaly kernels" in source
    assert "provenance-sensorium" in source
    assert "agent-audit" in source
    assert "release-surface-scanner" in source
    assert "signal-kernels" in source
    assert "anomaly-kernels" in source
    assert "Quanta and editor support" in source
    assert "Graphics, color, and calibration" in source
    assert "QuantaLang is the heavy repo" in source
    assert "The private core is not published." in source


def test_public_directions_are_outward_facing() -> None:
    source = page_source()

    assert 'id="directions"' in source
    assert "Where this work can be useful" in source
    assert "AI accountability and bilateral provenance" in source
    assert "Compiler and language research" in source
    assert "Confidential and government-supervised research" in source
    assert "Long-running red-team contracts, biological research programs, defense or weapons-adjacent engineering, and sensitive internal R&amp;D need a membrane that can show what scope was authorized before the work and what the model or workflow actually did afterward." in source
    assert "Signal, anomaly, and color" in source
    assert "Agent workflow and orchestration" in source
    assert "Compliance and product infrastructure" in source
    assert "The solid public path is lexer/parser/type checker/MIR to C" in source
    assert "Aspiration: live-state-aware code that can declare machine boundaries, coordinate CPU/GPU surfaces, and give models and reviewers a ground-truth receipt instead of a remembered representation." in source
    assert "Private systems are portfolio context, not inspectable products here." in source
    assert "steering models without letting their output outrun verification" in source
    for inward_facing_phrase in [
        "Splash",
        "front door next",
        "Where the work is already useful",
        "Tools for teams that need",
        "governance conversation",
        "QuantaLang is the runnable compiler surface",
        "shown safely: live surfaces",
        "landing candidate",
        "Marketable service lane",
        "deserves a page",
        "dedicated page",
        "simultaneous CPU/GPU orchestration is production-ready",
        "WARDEN-integrated CPU/GPU emission is complete",
    ]:
        assert inward_facing_phrase not in source


def test_typography_matches_refined_quanta_system() -> None:
    source = page_source()

    assert "Archivo" in source
    assert "Manrope" in source
    assert "JetBrains Mono" in source
    assert "--shell:1160px" in source
    assert "body{background:#ffffff; color:var(--ink); font-family:var(--body); font-size:1.0625rem" in source
    assert ".lead{font-size:1.22rem" in source
    assert ".btn{font-family:var(--mono); font-size:.9rem" in source
    assert "font-size:clamp" not in source
    assert "letter-spacing:-" not in source


def test_pastel_orange_depth_layer_is_present() -> None:
    source = page_source()

    assert "--orange-wash:#f0aa72" in source
    assert "--orange-mist:#ffe8d8" in source
    assert "rgba(240,170,114" in source
    assert "--olive-" not in source
    assert "rgba(201,214,163" not in source
    assert "rgba(238,243,218" not in source
    assert ".bg{display:block" in source


def test_glass_material_is_more_pronounced() -> None:
    source = page_source()

    assert "--glass-blur:saturate(170%) blur(30px)" in source
    assert "--glass-edge:" in source
    assert "--glass-depth:" in source
    assert "box-shadow:var(--glass-shadow), var(--glass-depth)" in source


def test_warden_flagship_page_exists_and_has_thesis() -> None:
    source = warden_source()

    assert "WARDEN overview" in source
    assert "A review layer for AI-assisted work." in source
    assert "WARDEN is a provenance and review system for authorized AI-assisted work." in source
    assert "It carries scope, approvals, evidence, and constraints into the workflow, then carries actions, claims, receipts, and reviewer notes back out." in source
    assert "Plain-English summary" in source
    assert "What WARDEN is" in source
    assert "A bidirectional record layer between human authorization and model-assisted work." in source
    assert "Who it helps" in source
    assert "Teams working with AI output that needs scope, evidence, approvals, exceptions, and review trails kept together." in source
    assert "What is public here" in source
    assert "Inspectable tooling leaves, sample patterns, and the accountability architecture; not the private core." in source
    assert "What the public surface is trying to make visible" in source
    assert "A way to keep capability from outrunning authorization." in source
    assert "they do not ask the reader to accept the private core on faith" in source
    for loop_step in [
        "Declare engagement scope",
        "Attach authority and constraints",
        "Sense live state",
        "Audit agent behavior",
        "Attach evidence",
        "Check provenance",
        "Gate exceptions",
        "Review anomalies",
        "Write a handoff report",
        "Keep both sides accountable",
    ]:
        assert loop_step in source
    assert "The parts another person can inspect" in source
    assert '<body class="warden-page">' in source
    assert "font-size:clamp" not in source
    assert "letter-spacing:-" not in source


def test_warden_public_private_boundary_is_explicit() -> None:
    source = warden_source()

    assert "Public surface" in source
    assert "Private core" in source
    assert (
        "The public page shows the leaves that can be inspected and the human accountability pattern behind them. It does not publish private internals, credentials, client data, operational details, or sensitive workflows."
        in source
    )
    positive_overclaim_patterns = [
        r"(?<!not )\bWARDEN is externally certified\b",
        r"(?<!not )\bWARDEN is regulator approved\b",
        r"\bWARDEN holds external certification\b",
        r"\bWARDEN has regulatory approval\b",
        r"\bregulators approved WARDEN\b",
        r"\bcustomer deployment verified for WARDEN\b",
        r"\bproduction trust status granted to WARDEN\b",
        r"\bWARDEN grants authorization\b",
        r"\bWARDEN bypasses safeguards\b",
    ]
    for pattern in positive_overclaim_patterns:
        assert not re.search(pattern, source, re.IGNORECASE)


def test_warden_names_confidential_research_scope_and_public_context() -> None:
    source = warden_source()

    assert 'id="research-membrane"' in source
    assert "Confidential research membrane" in source
    assert "long-term red-team contracts" in source
    assert "biological research" in source
    assert "government-supervised defense or weapons-adjacent engineering" in source
    assert "programmatic assertion and provenance layer" in source
    assert "WARDEN does not grant authority by itself" in source
    assert "OpenAI Frontier Governance Framework" in source
    assert "Anthropic Responsible Scaling Policy" in source
    assert "Fable 5 and Mythos 5" in source
    assert "WARDEN is the architecture this project is building toward" in source
    assert "WARDEN is my architecture" not in source
    assert "https://openai.com/index/openai-frontier-governance-framework/" in source
    assert "https://www.anthropic.com/news/responsible-scaling-policy-v3" in source
    assert "https://www.anthropic.com/news/fable-mythos-access" in source


def test_warden_connects_safety_transparency_and_creativity() -> None:
    source = warden_source()

    assert "Safety, transparency, and creativity can evolve on the same surface." in source
    assert "Many creative people are hesitant to use AI tools, and some reject them outright." in source
    assert "That hesitation belongs in the architecture." in source
    assert "The problem underneath is state" in source
    assert "A model can infer, summarize, and remember, but it usually receives claims about the world rather than native contact with the world." in source
    assert "programmatic sensory organs" in source
    assert "The same surface that makes machine creativity safer to trust is also the surface that keeps it accountable as capabilities grow." in source
    for overclaim in [
        "models now know ground truth",
        "WARDEN makes AI creativity automatically safe",
        "creatives should stop resisting AI",
    ]:
        assert overclaim not in source


def test_warden_links_public_accountability_repos() -> None:
    source = warden_source()

    for repo in [
        "https://github.com/HarperZ9/provenance-sensorium",
        "https://github.com/HarperZ9/agent-audit",
        "https://github.com/HarperZ9/release-surface-scanner",
        "https://github.com/HarperZ9/signal-kernels",
        "https://github.com/HarperZ9/anomaly-kernels",
        "https://github.com/HarperZ9/public-surface-sweeper",
        "https://github.com/HarperZ9/model-provenance-validator",
        "https://github.com/HarperZ9/repo-proof-index",
        "https://github.com/HarperZ9/gpu-trace-validator",
        "https://github.com/HarperZ9/emet",
    ]:
        assert f'href="{repo}"' in source

    # Excluded repos must not appear
    for excluded_repo in [
        "warden-reporting",
        "warden-algorithms",
        "warden-anomaly",
        "warden-sensorium",
        "warden-agent-audit",
        "warden-release-assurance",
    ]:
        assert f"HarperZ9/{excluded_repo}" not in source


def test_portfolio_links_to_emet_page() -> None:
    source = index_source()

    assert 'href="emet.html"' in source
    assert "EMET launch page" in source
    # No links to old emet-sample in nav or CTA
    assert '<a href="emet-sample.html">EMET</a>' not in source


def test_emet_page_exists_and_has_key_content() -> None:
    source = emet_source()

    assert "external byte-witness" in source
    assert "MATCH" in source
    assert "DRIFT" in source
    assert "UNVERIFIABLE" in source
    assert "by construction" in source
    assert "EMET launch" in source
    assert "An external byte-witness for agentic work." in source
    assert "There is no TRUSTED verdict, by construction." in source
    assert "Three same-author implementations" in source or "three same-author" in source.lower()
    # Honest same-author caveat must be present
    assert "same-author" in source
    assert "independent" in source


def test_emet_page_no_excluded_repos() -> None:
    source = emet_source()

    for excluded in [
        "warden-reporting",
        "ai-safety-prefire",
        "ai-safety-guardrail-manager",
        "CL4R1T4S-CR0SS0VER",
        "safe-io-lite",
        "agent-template-pack",
    ]:
        assert excluded not in source


def test_index_no_excluded_repos() -> None:
    source = index_source()

    for excluded in [
        "warden-reporting",
        "ai-safety-prefire",
        "ai-safety-guardrail-manager",
        "CL4R1T4S-CR0SS0VER",
        "safe-io-lite",
        "agent-template-pack",
    ]:
        assert excluded not in source


def test_sample_pages_explain_immediate_user_value_and_limits() -> None:
    for page in SAMPLE_PAGES:
        source = page.read_text(encoding="utf-8")

        assert "Boundary:" in source
        assert "Immediate value as of June 15, 2026" not in source
        assert "Who uses it:" not in source
        assert "What it does not claim:" not in source

    proof_surface = (ROOT / "proof-surface-sample.html").read_text(encoding="utf-8")
    assert "Use it for the moment before someone else judges the work" in proof_surface
    assert "Boundary: review packet, not certification, approval, or exploit testing." in proof_surface

    proof_index = (ROOT / "proof-index-sample.html").read_text(encoding="utf-8")
    assert "Use it when evidence is real but scattered" in proof_index
    assert "Boundary: it indexes proof artifacts; it does not decide whether the evidence is enough." in proof_index

    sweeper = (ROOT / "public-surface-sweeper-sample.html").read_text(encoding="utf-8")
    assert "Use it before a public repository asks someone to trust what it says" in sweeper
    assert "Boundary: release hygiene, not security certification or a full vulnerability scanner." in sweeper

    emet = (ROOT / "emet-sample.html").read_text(encoding="utf-8")
    assert "Use it when a source and a generated view need a witness" in emet
    assert "Boundary: it reports a comparison; it does not decide whether a system is safe or trustworthy." in emet
