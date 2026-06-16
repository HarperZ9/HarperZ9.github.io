from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
STYLES = ROOT / "styles.css"
WARDEN = ROOT / "warden.html"
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


def public_html_sources() -> str:
    paths = [INDEX, WARDEN, *SAMPLE_PAGES]
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
    assert "Live frontend surfaces" in source
    assert "private GitHub repos" in source


def test_accessible_navigation_and_page_landmarks() -> None:
    source = page_source()

    assert 'class="skip-link" href="#main"' in source
    assert ".skip-link{position:fixed" in source
    assert "clip-path:inset(50%)" in source
    assert ".skip-link:focus,.skip-link:focus-visible" in source
    assert '<nav aria-label="Primary">' in source
    assert '<main id="main">' in source
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


def test_portfolio_explains_what_and_how_plainly() -> None:
    source = page_source()

    assert "Code first. Claims second" in source
    assert "The strongest public evidence is a Rust compiler with a C execution path" in source
    assert "WARDEN Sensorium for live-state and provenance receipts" in source
    assert "this page starts with what can be opened, built, and checked" in source
    assert "Public release review means checking whether a repo, page, demo, or tool makes claims it can support." in source
    assert "inspect a public surface, check source and provenance, collect evidence, write a report, and preserve a review trail" in source
    assert "Start with what is built" in source
    assert "QuantaLang is the main engineering artifact." in source
    assert "836 tracked <code>.quanta</code> files" in source
    assert "Most utilities are narrow on purpose." in source
    assert "Their value is reviewability, not size." in source
    for lane in [
        "compiler work",
        "proof and review tools",
        "color systems",
        "agent utilities",
        "private platforms",
    ]:
        assert lane in source
    for stale_phrase in [
        "Current paid wedge",
        "behind the wedge",
        "High-leverage tools",
        "Day delivery",
        "prompt-and-pray",
        "conducting an orchestra",
        "I like ambitious systems",
        "I map what the surface claims",
        "Operational exploit detail",
        "a lot still to learn",
        "Working systems with receipts",
        "Public claims, backed by evidence",
        "Immediate value as of June 15, 2026",
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
    assert "Proof, provenance, and AI safety" in source
    assert "warden-sensorium" in source
    assert "Quanta and editor support" in source
    assert "Graphics, color, and calibration" in source
    assert "WARDEN public packages" in source
    assert "QuantaLang is the heavy repo" in source
    assert "The private core is not published." in source


def test_public_directions_are_outward_facing() -> None:
    source = page_source()

    assert 'id="directions"' in source
    assert "Where the work points" in source
    assert "Evidence systems" in source
    assert "The tools check live state, claims, provenance, witness state, proof packets, and handoff reports." in source
    assert "Quanta research" in source
    assert "Graphics and color" in source
    assert "Agent workflow" in source
    assert "Private platforms" in source
    assert "The solid public path is lexer/parser/type checker/MIR to C" in source
    assert "Private systems are portfolio context, not inspectable products here." in source
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

    assert "A review layer for AI-assisted work" in source
    assert "WARDEN is the private accountability system behind the public proof and review tools." in source
    assert "The inspectable surface is narrower: Sensorium live-state receipts, C++ reporting, anomaly scoring, analytics primitives, provenance/release CLIs, proof indexing, and EMET witness checks." in source
    assert "What the public surface shows" in source
    assert "Public leaves, private core, one theme." in source
    assert "they do not ask the reader to accept the private core on faith" in source
    for loop_step in [
        "Sense live state",
        "State the claim",
        "Attach evidence",
        "Check provenance",
        "Review anomalies",
        "Write a handoff report",
        "Keep human ownership visible",
    ]:
        assert loop_step in source
    assert "The public parts of the system" in source
    assert '<body class="warden-page">' in source
    assert "font-size:clamp" not in source
    assert "letter-spacing:-" not in source


def test_warden_public_private_boundary_is_explicit() -> None:
    source = warden_source()

    assert "Public surface" in source
    assert "Private core" in source
    assert (
        "The public page shows the leaves that can be inspected. It does not publish private internals, credentials, client data, operational details, or sensitive workflows."
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
    ]
    for pattern in positive_overclaim_patterns:
        assert not re.search(pattern, source, re.IGNORECASE)


def test_warden_links_public_accountability_repos() -> None:
    source = warden_source()

    for repo in [
        "https://github.com/HarperZ9/warden-sensorium",
        "https://github.com/HarperZ9/warden-reporting",
        "https://github.com/HarperZ9/warden-algorithms",
        "https://github.com/HarperZ9/warden-anomaly",
        "https://github.com/HarperZ9/public-surface-sweeper",
        "https://github.com/HarperZ9/model-provenance-validator",
        "https://github.com/HarperZ9/repo-proof-index",
        "https://github.com/HarperZ9/gpu-trace-validator",
        "https://github.com/HarperZ9/emet",
    ]:
        assert f'href="{repo}"' in source


def test_portfolio_links_to_warden_flagship() -> None:
    source = index_source()

    assert 'href="warden.html"' in source
    assert "WARDEN overview" in source
    assert "WARDEN page" in source


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
