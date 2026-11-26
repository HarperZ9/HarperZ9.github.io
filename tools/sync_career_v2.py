#!/usr/bin/env python3
"""Sync Wave 16E-2 Multi-Domain Living Proof career-v2 (11 docs x 6 formats = 66 files)
into career/v2/ and the 9 existing live career HTML pages (exact 44-HTML budget intact).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(os.environ.get("CAREER_V2_SRC", "")) if os.environ.get("CAREER_V2_SRC") else None
DST_V2 = ROOT / "career" / "v2"


def public_repo_total() -> int:
    cat = ROOT / "assets" / "data" / "unified" / "all_public_repos_catalog.json"
    if cat.exists():
        data = json.loads(cat.read_text(encoding="utf-8"))
        return int(data.get("counts", {}).get("public_total", 158))
    return 158


def extract_main_inner(html_path: Path) -> str:
    raw = html_path.read_text(encoding="utf-8")
    m = re.search(r"<main[^>]*>([\s\S]*?)</main>", raw)
    inner = m.group(1).strip() if m else raw
    inner = inner.replace("\u2014", " - ").replace("\u2013", "-")
    return inner


def blank_pdf_docx_metadata(folder: Path) -> None:
    try:
        import fitz
        for pdf in folder.glob("*.pdf"):
            doc = fitz.open(str(pdf))
            doc.set_metadata({})
            tmp = pdf.with_suffix(".tmp.pdf")
            doc.save(str(tmp), deflate=True)
            doc.close()
            tmp.replace(pdf)
    except Exception as exc:
        print(f"warn: pdf metadata blank skipped: {exc}")
    try:
        import docx
        for dpath in folder.glob("*.docx"):
            d = docx.Document(str(dpath))
            cp = d.core_properties
            cp.author = ""
            cp.last_modified_by = ""
            cp.title = ""
            cp.subject = ""
            cp.comments = ""
            d.save(str(dpath))
    except Exception as exc:
        print(f"warn: docx metadata blank skipped: {exc}")


def download_bar(stem: str) -> str:
    base = f"/career/v2/{stem}"
    return (
        '<div class="us-controls" aria-label="Download formats">'
        f'<a class="us-btn is-primary" href="{base}_ATS.pdf" download>ATS PDF</a>'
        f'<a class="us-btn" href="{base}_Designed.pdf" download>Designed PDF</a>'
        f'<a class="us-btn" href="{base}.docx" download>DOCX</a>'
        f'<a class="us-btn" href="{base}.txt" download>Plain text (.txt)</a>'
        f'<a class="us-btn" href="{base}.md" download>Markdown (.md)</a>'
        '</div>'
    )


def _menu_dialog() -> str:
    idx = (ROOT / "index.html").read_text(encoding="utf-8", errors="replace")
    m = re.search(r'<dialog id="o-menu"[\s\S]*?</dialog>', idx)
    return m.group(0) if m else ""


def build_career_shell_page(rel: str, title: str, desc: str, body_inner: str) -> str:
    url = f"https://harperz9.github.io/{rel}"
    menu = _menu_dialog()
    return f"""<!doctype html>
<html lang="en" data-type="stock">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<title>{title} | Zain Dana Harper</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="{title} | Zain Dana Harper">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://harperz9.github.io/img/og/p/home.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} | Zain Dana Harper">
<meta name="twitter:description" content="{desc}">
<link rel="preload" href="/world/ui/shell/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/world/ui/shell/shell.css">
<link rel="stylesheet" href="/studies/studies.css">
<link rel="stylesheet" href="/world/site/depth.css">
<link rel="stylesheet" href="/assets/unified-surface.css">
<script type="module" src="/world/ui/shell/shell.js"></script>
<script type="module" src="/world/site/hand-scroll.js"></script>
<script type="module" src="/assets/unified-surface.js"></script>
<style>
.cv-sheet{{background:var(--us-surface);border:1px solid var(--us-border);border-radius:10px;padding:clamp(1.25rem,3vw,2.5rem);box-shadow:var(--us-shadow)}}
.cv-sheet header{{border-bottom:2px solid var(--us-accent);padding-bottom:0.85rem;margin-bottom:1.15rem}}
.cv-sheet h1{{margin:0 0 0.3rem;font-size:clamp(1.65rem,3vw,2.25rem)}}
.cv-sheet .headline{{margin:0 0 0.5rem;font-weight:600;color:var(--us-accent)}}
.cv-sheet .contact{{display:flex;flex-wrap:wrap;gap:0.35rem 1rem;font-size:0.9rem;margin:0}}
.cv-sheet .metrics,.cv-sheet .proof-strip{{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:0.65rem;margin:1rem 0 1.25rem}}
.cv-sheet .metric,.cv-sheet .proof-item{{background:var(--us-chip-bg);border-left:3px solid var(--us-accent);padding:0.55rem 0.75rem;border-radius:4px}}
.cv-sheet .metric strong,.cv-sheet .proof-item strong{{display:block;font-family:"Conso",ui-monospace,monospace;font-size:0.94rem}}
.cv-sheet .metric span,.cv-sheet .proof-item span{{font-size:0.82rem;color:var(--us-muted)}}
.cv-sheet h2{{margin:1.25rem 0 0.55rem;font-size:0.95rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--us-accent);border-bottom:1px solid var(--us-border);padding-bottom:0.25rem}}
.cv-sheet .entry-head{{display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.25rem 0.75rem;font-weight:700}}
.cv-sheet .entry-meta{{font-family:"Conso",ui-monospace,monospace;font-size:0.82rem;color:var(--us-muted);font-weight:400}}
.cv-sheet ul{{margin:0.35rem 0 0.85rem;padding-left:1.2rem}}
.cv-sheet li{{margin:0.28rem 0;line-height:1.52}}
@media print{{.o-hand,.gw-backdrop,.us-controls{{display:none!important}}.cv-sheet{{border:none;box-shadow:none;padding:0}}}}
</style>
</head>
<body class="reading">
<header class="o-hand o-said" aria-label="Site">
  <a class="skip" href="#main">Skip to the page</a>
  <a class="o-home" href="/">Zain Dana Harper</a>
  <a data-o="band" href="/world/"><span class="o-name">Map</span></a>
  <button type="button" data-o="fold" aria-controls="o-menu" aria-keyshortcuts="m" aria-expanded="false" hidden><span class="o-name">Places</span><i></i><i></i><i></i></button>
  <button type="button" data-o="lamp" data-theme-toggle aria-pressed="true"><span class="o-name">Day</span></button>
  <span class="o-cell"><button type="button" data-o="peel" data-plain-toggle aria-pressed="false"><span class="o-name">Plain</span></button><span class="o-under" aria-hidden="true">Plain</span></span>
</header>
{menu}
<main id="main" tabindex="-1">
<article class="us-wrap">
{body_inner}
</article>
</main>
</body>
</html>
"""


def main() -> int:
    if DST_V2.exists():
        shutil.rmtree(DST_V2)
    DST_V2.mkdir(parents=True, exist_ok=True)
    copied = 0
    for f in sorted(SRC.iterdir()):
        if f.is_file() and f.suffix.lower() in (".pdf", ".docx", ".md", ".txt"):
            shutil.copy2(f, DST_V2 / f.name)
            copied += 1
    blank_pdf_docx_metadata(DST_V2)
    repo_total = public_repo_total()

    shutil.copy2(SRC / "Zain-Dana-Harper-CV.md", ROOT / "cv.md")
    shutil.copy2(SRC / "Zain-Dana-Harper-Resume-Systems-Director.md", ROOT / "resume.md")

    # Map all 6 Multi-Domain Living Proof 1-page resumes cleanly onto our 6 existing resume routes
    resume_map = [
        ("resume-public-operations.html", "Zain-Dana-Harper-Resume-Government-Policy", "Government & Policy Resume", "One-page civil-service and policy resume covering public accountability, urban forestry literacy, research verification, and civic tooling."),
        ("resume-grounds.html", "Zain-Dana-Harper-Resume-Forestry-Trades-Lead", "Urban Forestry & Crew Lead Resume", "One-page resume leading with 11 years of commercial tree-crew leadership, high-hazard rigging, client education, and tree biomechanics."),
        ("resume-evaluation-tooling.html", "Zain-Dana-Harper-Resume-AI-Eval-Research", "AI Evaluation & Research Resume", "One-page resume focused on AI evaluation, Flywheel receipts, 30 empirical studies with 12 honest nulls, and Arm C verification."),
        ("resume.html", "Zain-Dana-Harper-Resume-Systems-Director", "Systems & AI Director Resume", "One-page resume for Zain Dana Harper framing systems architecture, verification specs, and five shipped open-source platforms."),
        ("resume-graphics-developer-tools.html", "Zain-Dana-Harper-Resume-Graphics-Creative-Tech", "Graphics & Creative Tech Resume", "One-page resume covering RAW DX12 Wave 72, Elder ENB (1M+ downloads), Superframe rendering, spectral optics, and interactive media."),
        ("resume-support-operations.html", "Zain-Dana-Harper-Resume-Academic-Fellowship", "Academic & Fellowship Resume", "One-page academic admission and research fellowship resume covering 13 Zenodo DOIs, 30 empirical studies, and cross-domain synthesis."),
    ]
    nav_pills = (
        '<div class="us-pills" style="margin-bottom:1rem">'
        '<a class="us-btn" href="/hire.html">Career Hub</a>'
        '<a class="us-btn" href="/cv.html">Living Proof CV</a>'
        '<a class="us-btn" href="/cover-letter.html">4 Cover Letters</a>'
        '<a class="us-btn" href="/resume-public-operations.html">Government &amp; Policy</a>'
        '<a class="us-btn" href="/resume-grounds.html">Urban Forestry &amp; Trades</a>'
        '<a class="us-btn" href="/resume-evaluation-tooling.html">AI Eval &amp; Research</a>'
        '<a class="us-btn" href="/resume.html">Systems Director</a>'
        '<a class="us-btn" href="/resume-graphics-developer-tools.html">Graphics &amp; Creative</a>'
        '<a class="us-btn" href="/resume-support-operations.html">University &amp; Fellowship</a>'
        '</div>'
    )

    for rel, stem, title, desc in resume_map:
        inner = extract_main_inner(SRC / f"{stem}.html")
        body = f'{nav_pills}{download_bar(stem)}<div class="cv-sheet">{inner}</div>'
        (ROOT / rel).write_text(build_career_shell_page(rel, title, desc, body), encoding="utf-8")

    # Full Multi-Domain Living Proof CV
    cv_inner = extract_main_inner(SRC / "Zain-Dana-Harper-CV.html")
    cv_body = f'{nav_pills}{download_bar("Zain-Dana-Harper-CV")}<div class="cv-sheet">{cv_inner}</div>'
    (ROOT / "cv.html").write_text(
        build_career_shell_page(
            "cv.html",
            "Living Proof Curriculum Vitae",
            "Multi-domain Living Proof CV for Zain Dana Harper spanning urban forestry leadership, public accountability, empirical research, graphics, and systems architecture.",
            cv_body,
        ),
        encoding="utf-8",
    )

    # 4 Tailored 1-Page Cover Letters on ONE tabbed page
    letters = [
        ("government-policy", "Government & Policy", "Zain-Dana-Harper-Cover-Letter-Government-Policy"),
        ("forestry-trades", "Urban Forestry & Trades", "Zain-Dana-Harper-Cover-Letter-Forestry-Trades-Lead"),
        ("ai-eval-systems", "AI Eval & Systems", "Zain-Dana-Harper-Cover-Letter-AI-Eval-Systems-Direction"),
        ("academic-fellowship", "University & Fellowship", "Zain-Dana-Harper-Cover-Letter-Academic-Fellowship"),
    ]
    cl_tabs = "\n".join(
        f'<button type="button" class="us-tab" role="tab" data-tab="{tid}" aria-selected="{"true" if i == 0 else "false"}">{label}</button>'
        for i, (tid, label, _) in enumerate(letters)
    )
    cl_panels = "\n".join(
        f'<section class="us-panel" id="{tid}" role="tabpanel" data-panel="{tid}"{"" if i == 0 else " hidden"}>'
        f'{download_bar(stem)}<div class="cv-sheet">{extract_main_inner(SRC / f"{stem}.html")}</div></section>'
        for i, (tid, _, stem) in enumerate(letters)
    )
    cl_body = (
        f'{nav_pills}<section class="us-hero"><p class="us-kicker">Work-Sample-First Cover Letters | 4 Tracks, All 6 Formats</p>'
        '<h1>Cover Letters</h1><p class="us-lede">Four direct, work-sample-first cover letters tailored for City/County/State Government &amp; Policy, Urban Forestry &amp; Trades Leadership, AI Evaluation &amp; Systems Direction, and University / Fellowship applications.</p></section>'
        f'<section data-us-tabs><div class="us-tabs" role="tablist">{cl_tabs}</div>{cl_panels}</section>'
    )
    (ROOT / "cover-letter.html").write_text(
        build_career_shell_page(
            "cover-letter.html",
            "Cover Letters",
            "Four tailored work-sample-first cover letters for Government, Urban Forestry, AI Evaluation & Systems, and University Fellowship tracks.",
            cl_body,
        ),
        encoding="utf-8",
    )

    # Multi-Domain Career Hub (hire.html)
    cards = []
    for rel, stem, title, desc in resume_map:
        cards.append(
            f'<article class="us-card"><div class="us-card-meta"><span>1-Page Resume</span><span>6 Formats</span></div>'
            f'<h3>{title}</h3><p>{desc}</p>'
            f'<div class="us-card-actions"><a class="us-card-btn" href="/{rel}">Read online</a>'
            f'<a class="us-btn" href="/career/v2/{stem}_ATS.pdf" download>ATS PDF</a>'
            f'<a class="us-btn" href="/career/v2/{stem}_Designed.pdf" download>Designed PDF</a>'
            f'<a class="us-btn" href="/career/v2/{stem}.docx" download>DOCX</a></div></article>'
        )
    hire_body = f"""<section class="us-hero">
  <p class="us-kicker">Work-Sample-First Living Proof | Multi-Domain Career Hub</p>
  <h1>Work With Zain Dana Harper</h1>
  <p class="us-lede">Open to City, County, State, and Government roles; Urban Forestry, Arboriculture, and Crew Leadership; AI Evaluation, Accountability, and Research Direction; Real-Time Graphics and Creative Technology; and University / Research Fellowships. Pick the lens that matches your team below and judge the work directly in 30 seconds.</p>
  <div class="us-banner-frame"><img src="/media/overhaul/banners/banner-research-career.webp" alt="Career, research, and verified systems overview banner" loading="lazy"></div>
  <ul class="us-stats">
    <li>11 Years Commercial Tree-Crew Leadership &amp; Client Education</li>
    <li>5 Unified Open-Source Flagships across {repo_total} Public Repos</li>
    <li>30 Empirical Studies (12 Published Nulls) &amp; 13 Zenodo DOIs</li>
    <li>41 Merged Upstream PRs across 34 External Projects</li>
    <li>1,004,693 Elder ENB Downloads (179,218 Unique Accounts)</li>
  </ul>
  <div class="us-pills" style="margin-top:1rem">
    <a class="us-btn is-primary" href="/cv.html">Read Living Proof CV</a>
    <a class="us-btn" href="/career/v2/Zain-Dana-Harper-CV_ATS.pdf" download>CV ATS PDF</a>
    <a class="us-btn" href="/career/v2/Zain-Dana-Harper-CV_Designed.pdf" download>CV Designed PDF (BuildTeX)</a>
    <a class="us-btn" href="/cover-letter.html">4 Tailored Cover Letters</a>
    <a class="us-btn" href="/portfolio.html">41 Merged PRs</a>
    <a class="us-btn" href="mailto:zaindharper@gmail.com">zaindharper@gmail.com</a>
  </div>
</section>
<h2 style="margin:1.5rem 0 0.75rem">Six Targeted One-Page Resumes (Choose Your Lens)</h2>
<div class="us-grid">{''.join(cards)}</div>
<section class="us-hero" style="margin-top:1.75rem">
  <h2>Direct Work Samples &amp; Executive Briefs</h2>
  <p class="us-lede">Skip abstract quizzes and inspect live work directly: <a href="/person.html">Documented History</a>, <a href="/architecture.html">Platform Architecture</a>, <a href="/models.html">Local Frontier Model Lab</a>, <a href="/media/">1080p Video Explainers</a>, <a href="/tools.html">All {repo_total} Public Repositories</a>, and <a href="/dossier.html">Evidence Dossier</a>.</p>
  <div class="us-pills">
    <a class="us-btn" href="/career/Zain-Dana-Harper-Portfolio-Brief.pdf" download>Portfolio Brief (PDF)</a>
    <a class="us-btn" href="/career/Zain-Dana-Harper-Portfolio-Brief.docx" download>Portfolio Brief (DOCX)</a>
    <a class="us-btn" href="/career/Flywheel-Platform-Brief.pdf" download>Flywheel Brief (PDF)</a>
    <a class="us-btn" href="/career/Flywheel-Platform-Brief.docx" download>Flywheel Brief (DOCX)</a>
  </div>
</section>"""
    (ROOT / "hire.html").write_text(
        build_career_shell_page(
            "hire.html",
            "Hire & Career Pack",
            "Six targeted one-page resumes, multi-domain Living Proof CV, four cover letters, and live verified work samples for Zain Dana Harper.",
            hire_body,
        ),
        encoding="utf-8",
    )

    print(f"SYNCED_CAREER_V2_MULTIDOMAIN: {copied} downloadable files copied to career/v2/ and 9 live career HTML pages updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
