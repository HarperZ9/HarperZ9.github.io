import argparse
import html
import sys
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile

TOKENS = {
    "paper": "#f4f3ef",
    "paper2": "#eceae4",
    "ink": "#0b0c0e",
    "soft": "#2f3238",
    "muted": "#585c64",
    "line": "rgba(11,12,14,.14)",
    "iris": "#4636e8",
}
PORTFOLIO = Path(r"C:\dev\public\portfolio-site")
FONT_ARCHIVES = [
    Path(r"C:\Users\Zain\Downloads\Kilon-Bold-Display-Font.zip"),
    Path(r"C:\Users\Zain\Downloads\Conso-Font-Family.zip"),
]
WEB_FONTS = [
    PORTFOLIO / "system" / "fonts" / "kilon.woff2",
    PORTFOLIO / "system" / "fonts" / "conso-regular.woff2",
    PORTFOLIO / "system" / "fonts" / "conso-semibold.woff2",
    PORTFOLIO / "system" / "fonts" / "conso-bold.woff2",
]


@dataclass(frozen=True)
class RepoIdentity:
    key: str
    root: Path
    package_name: str
    role: str
    promise: str
    market_position: str
    status_labels: tuple[str, ...]
    demo_path: Path
    install_command: str
    run_command: str
    description: str


IDENTITIES = {
    "gather": RepoIdentity(
        key="gather",
        root=Path(r"C:\dev\public\gather"),
        package_name="gather-engine",
        role="accountable research intake",
        promise="Bring difficult sources in, and keep how they arrived on the record.",
        market_position="Research work loses trust when source trails disappear. Gather makes provenance feel like leverage: every source has a method, every digest can be checked, and every derived claim keeps its ancestry.",
        status_labels=("SOURCE", "RECEIPT", "DIGEST", "TAMPER CAUGHT"),
        demo_path=Path("examples/gather-demo.html"),
        install_command="pip install gather-engine",
        run_command="python examples/demo.py",
        description="Accountable research intake for difficult sources, with provenance receipts and witnessed digests.",
    ),
    "crucible": RepoIdentity(
        key="crucible",
        root=Path(r"C:\dev\public\crucible"),
        package_name="crucible-bench",
        role="measurement-backed claim evaluation",
        promise="Turn claims into verdicts grounded in measurement.",
        market_position="Decision work gets expensive when plausible claims outrun measurement. crucible gives teams a calmer surface: register the thesis, measure the claim, and fund the verdict with evidence.",
        status_labels=("THESIS", "MEASURE", "MATCH", "UNVERIFIABLE"),
        demo_path=Path("examples/crucible-demo.html"),
        install_command="pip install crucible-bench",
        run_command="python examples/demo.py",
        description="Measurement-backed thesis evaluation with clean verifier packets and re-checkable verdicts.",
    ),
    "index": RepoIdentity(
        key="index",
        root=Path(r"C:\dev\public\index"),
        package_name="index-graph",
        role="workspace atlas",
        promise="Map a workspace from evidence, not memory.",
        market_position="Large workspaces decay when their shape lives in memory. index turns code and docs into a navigable atlas, so onboarding, diligence, and agent routing start from evidence.",
        status_labels=("REPO", "DOC", "EDGE", "ATLAS"),
        demo_path=Path("examples/index-demo.html"),
        install_command="pip install index-graph",
        run_command="python examples/atlas_demo.py",
        description="Evidence-built repo and documentation atlas for multi-repo workspaces.",
    ),
    "forum": RepoIdentity(
        key="forum",
        root=Path(r"C:\dev\public\forum"),
        package_name="forum-engine",
        role="witnessed agent orchestration",
        promise="Route agent work through a ledger you can replay and verify.",
        market_position="Agent work becomes operational only when the route is visible. Forum makes multi-agent execution feel accountable: plan, ledger, replay, and deep verification before trust.",
        status_labels=("ROUTE", "PLAN", "LEDGER", "DEEP VERIFY"),
        demo_path=Path("examples/forum-demo.html"),
        install_command="pip install forum-engine",
        run_command="python examples/demo.py",
        description="Model-agnostic agent orchestration with a replayable, verifiable causal ledger.",
    ),
    "telos": RepoIdentity(
        key="telos",
        root=Path(r"C:\dev\public\telos"),
        package_name="telos",
        role="verified contact with state and range",
        promise="Give a stateless model durable, verified contact with state and range.",
        market_position="Serious AI work needs a floor beneath confidence. Project Telos gives the model shared state, witnessed perception, and a certificate loop a person can re-check.",
        status_labels=("PERCEIVE", "CHECK", "CERTIFIED", "UNVERIFIABLE"),
        demo_path=Path("demo/index.html"),
        install_command="Node 18 or newer",
        run_command="node demo/run.mjs",
        description="The Project Telos membrane demo: perceive, check, and re-derive a certificate.",
    ),
}
def esc(value: str) -> str:
    return html.escape(value, quote=True)


def wrap_words(value: str, limit: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > limit:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def svg_tspans(value: str, x: int, y: int, line_height: int, limit: int) -> tuple[str, int]:
    lines = wrap_words(value, limit)
    spans = []
    for index, line in enumerate(lines):
        dy = 0 if index == 0 else line_height
        spans.append(f'<tspan x="{x}" dy="{dy}">{esc(line)}</tspan>')
    return "\n    ".join(spans), y + line_height * max(0, len(lines) - 1)


def check_fonts() -> None:
    missing = [str(path) for path in FONT_ARCHIVES + WEB_FONTS if not path.exists()]
    if missing:
        raise SystemExit("missing font assets:\n" + "\n".join(missing))
    for archive in FONT_ARCHIVES:
        with ZipFile(archive) as zip_file:
            names = set(zip_file.namelist())
        if archive.name.startswith("Kilon") and "Web Fonts/kilon-webfont.woff2" not in names:
            raise SystemExit("Kilon archive missing kilon webfont")
        if archive.name.startswith("Conso") and "Web Fonts/conso-regular-webfont.woff2" not in names:
            raise SystemExit("Conso archive missing regular webfont")


def mark_paths(key: str) -> str:
    if key == "telos":
        return '<path d="M115 60 C180 10 292 10 365 86 C438 162 434 278 352 348 C270 418 151 394 96 306 C42 218 50 114 115 60 Z" fill="none" stroke="#0b0c0e" stroke-width="14"/><path d="M142 296 C202 188 272 123 354 88" fill="none" stroke="#4636e8" stroke-width="18" stroke-linecap="round"/>'
    if key == "gather":
        return '<path d="M80 82 H400 L302 210 V330 L178 360 V210 Z" fill="none" stroke="#0b0c0e" stroke-width="14" stroke-linejoin="round"/><path d="M132 238 H348 M154 282 H326 M182 326 H298" stroke="#4636e8" stroke-width="10" stroke-linecap="round"/>'
    if key == "index":
        return '<circle cx="126" cy="138" r="34" fill="none" stroke="#0b0c0e" stroke-width="12"/><circle cx="342" cy="122" r="34" fill="none" stroke="#0b0c0e" stroke-width="12"/><circle cx="242" cy="320" r="38" fill="none" stroke="#4636e8" stroke-width="12"/><path d="M160 138 L308 122 M144 168 L216 292 M322 154 L264 290" stroke="#0b0c0e" stroke-width="10" stroke-linecap="round"/>'
    if key == "forum":
        return '<path d="M82 112 C146 70 206 70 270 112 C334 154 394 154 456 112" fill="none" stroke="#0b0c0e" stroke-width="12" stroke-linecap="round"/><path d="M82 214 C146 172 206 172 270 214 C334 256 394 256 456 214" fill="none" stroke="#0b0c0e" stroke-width="12" stroke-linecap="round"/><path d="M118 326 H404" stroke="#4636e8" stroke-width="14" stroke-linecap="round"/><circle cx="178" cy="326" r="18" fill="#f4f3ef" stroke="#0b0c0e" stroke-width="10"/><circle cx="278" cy="326" r="18" fill="#f4f3ef" stroke="#0b0c0e" stroke-width="10"/><circle cx="378" cy="326" r="18" fill="#f4f3ef" stroke="#0b0c0e" stroke-width="10"/>'
    if key == "crucible":
        return '<path d="M94 350 H386 M150 350 L214 98 H306 L370 350" fill="none" stroke="#0b0c0e" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M164 232 H356" stroke="#4636e8" stroke-width="14" stroke-linecap="round"/><circle cx="260" cy="232" r="42" fill="none" stroke="#0b0c0e" stroke-width="12"/>'
    raise KeyError(key)


def render_mark(identity: RepoIdentity) -> str:
    title = f"{identity.key} mark"
    desc = f"Project Telos mark for {identity.key}, {identity.role}."
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 440" role="img" aria-label="{esc(desc)}">
  <title>{esc(title)}</title>
  <desc>{esc(desc)}</desc>
  <rect width="520" height="440" rx="44" fill="{TOKENS["paper"]}"/>
  {mark_paths(identity.key)}
</svg>
'''


def render_hero(identity: RepoIdentity) -> str:
    labels = " / ".join(identity.status_labels)
    title = identity.key
    desc = f"{identity.key} README hero for Project Telos."
    promise_lines, promise_bottom = svg_tspans(identity.promise, 84, 188, 48, 36)
    status_y = promise_bottom + 54
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 520" role="img" aria-label="{esc(desc)} {esc(identity.promise)}">
  <title>{esc(title)} Project Telos hero</title>
  <desc>{esc(desc)} {esc(identity.promise)}</desc>
  <rect width="1280" height="520" rx="34" fill="{TOKENS["paper"]}"/>
  <path d="M80 96 H1200 M80 424 H1200" stroke="#0b0c0e" stroke-opacity=".14"/>
  <text x="80" y="86" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="20" letter-spacing="6" fill="{TOKENS["muted"]}">PROJECT TELOS / {esc(identity.role.upper())}</text>
  <text x="76" y="334" font-family="Arial Black, Impact, system-ui, sans-serif" font-size="182" letter-spacing="-8" fill="#0b0c0e" fill-opacity=".08">{esc(identity.key.upper())}</text>
  <text font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="{TOKENS["ink"]}">
    {promise_lines}
  </text>
  <text x="86" y="{status_y}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="22" fill="{TOKENS["soft"]}">{esc(labels)}</text>
  <g transform="translate(878 78) scale(.70)">{mark_paths(identity.key)}</g>
</svg>
'''


def demo_rows(identity: RepoIdentity) -> str:
    rows = {
        "gather": [
            ("source", "video metadata, transcript, comment"),
            ("receipt", "method, ref, timestamp, sha256"),
            ("digest", "sealed run record for downstream organs"),
            ("tamper", "altered receipt fails verification"),
        ],
        "crucible": [
            ("thesis", "claim plus falsification condition"),
            ("measure", "substrate oracle records deviation"),
            ("verdict", "MATCH, DRIFT, or UNVERIFIABLE"),
            ("review", "verifier receives spec and artifact only"),
        ],
        "index": [
            ("scan", "repos and docs enter the atlas"),
            ("edge", "dependencies carry file and line evidence"),
            ("read", "markdown appears beside the graph"),
            ("focus", "search and neighborhood views reduce noise"),
        ],
        "forum": [
            ("route", "request receives a witnessed lane"),
            ("plan", "DAG runs in bounded waves"),
            ("ledger", "each result is chained and replayable"),
            ("verify", "deep verification catches body tampering"),
        ],
        "telos": [
            ("perceive", "rendered state is read through two channels"),
            ("check", "criterion lives outside the perceiver"),
            ("certify", "honest render rechecks true"),
            ("refuse", "broken render returns UNVERIFIABLE"),
        ],
    }[identity.key]
    return "\n".join(
        f'<div class="row"><span>{esc(label)}</span><p>{esc(text)}</p></div>'
        for label, text in rows
    )


def render_demo(identity: RepoIdentity) -> str:
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(identity.key)} Project Telos demo</title>
<style>
@font-face{{font-family:Kilon;src:url("https://harperz9.github.io/system/fonts/kilon.woff2") format("woff2");font-display:swap}}
@font-face{{font-family:Conso;src:url("https://harperz9.github.io/system/fonts/conso-regular.woff2") format("woff2");font-display:swap}}
:root{{--paper:#f4f3ef;--ink:#0b0c0e;--soft:#2f3238;--muted:#585c64;--iris:#4636e8;--line:rgba(11,12,14,.14)}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font-family:Conso,Arial,sans-serif;line-height:1.6}}a{{color:var(--ink)}}a:focus-visible,button:focus-visible{{outline:2px solid var(--iris);outline-offset:4px}}.skip{{position:absolute;left:1rem;top:1rem;transform:translateY(-140%);background:var(--paper);border:1px solid var(--line);padding:.6rem 1rem}}.skip:focus{{transform:none}}main{{min-height:100vh;padding:clamp(1.2rem,4vw,4rem)}}.rail,.label{{font-family:ui-monospace,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-size:.72rem}}h1{{font-family:Kilon,Arial Black,sans-serif;font-size:clamp(4rem,18vw,13rem);line-height:.78;letter-spacing:-.05em;margin:4rem 0 1rem}}.promise{{font-size:clamp(1.25rem,2.2vw,2.2rem);max-width:34ch;color:var(--soft)}}.market{{max-width:62ch;color:var(--muted);margin-top:1.1rem}}.specimen,.proof{{margin-top:clamp(2rem,5vw,4rem);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}.row{{display:grid;grid-template-columns:minmax(8rem,14rem) 1fr;gap:1rem;padding:1rem 0;border-top:1px solid var(--line)}}.row:first-child{{border-top:0}}.row span{{font-family:ui-monospace,Consolas,monospace;text-transform:uppercase;letter-spacing:.16em;color:var(--iris);font-size:.76rem}}.row p{{margin:0;max-width:58ch}}.proof{{padding:1rem 0}}pre{{margin:.8rem 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,Consolas,monospace;font-size:.92rem}}.note{{max-width:58ch;color:var(--muted)}}.actions{{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:2rem}}.pill{{border:1px solid var(--ink);border-radius:999px;padding:.72rem 1rem;text-decoration:none}}.pill.primary{{background:var(--ink);color:var(--paper)}}@media(max-width:620px){{.row{{grid-template-columns:1fr}}h1{{font-size:clamp(3.4rem,24vw,7rem)}}}}@media(prefers-reduced-motion:reduce){{*{{scroll-behavior:auto;transition:none!important;animation:none!important}}}}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<main id="main">
  <p class="rail">Project Telos / {esc(identity.role)}</p>
  <h1>{esc(identity.key)}</h1>
  <p class="promise">{esc(identity.promise)}</p>
  <p class="market">{esc(identity.market_position)}</p>
  <section class="specimen" aria-label="{esc(identity.key)} proof sequence">
    {demo_rows(identity)}
  </section>
  <section class="proof" aria-label="Run the proof">
    <p class="label">run it</p>
    <pre><code>{esc(identity.install_command)}
{esc(identity.run_command)}</code></pre>
    <p class="note">Inspect the artifact, try it against a real workflow, then bring the evidence into a pilot, sponsorship, or research conversation.</p>
  </section>
  <nav class="actions" aria-label="Demo actions">
    <a class="pill primary" href="../README.md">Read the README</a>
    <a class="pill" href="https://harperz9.github.io">Project Telos</a>
  </nav>
</main>
</body>
</html>
'''


def write_text(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    return path


def render_repo(identity: RepoIdentity) -> list[Path]:
    brand = identity.root / "docs" / "brand"
    written = [
        write_text(brand / f"{identity.key}-mark.svg", render_mark(identity)),
        write_text(brand / f"{identity.key}-hero.svg", render_hero(identity)),
        write_text(identity.root / identity.demo_path, render_demo(identity)),
    ]
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", choices=sorted(IDENTITIES))
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--check-fonts", action="store_true")
    args = parser.parse_args(argv)
    if args.check_fonts:
        check_fonts()
        print("font assets ok")
    keys = sorted(IDENTITIES) if args.all else ([args.repo] if args.repo else [])
    if not keys and not args.check_fonts:
        parser.error("pass --repo, --all, or --check-fonts")
    for key in keys:
        for path in render_repo(IDENTITIES[key]):
            print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
