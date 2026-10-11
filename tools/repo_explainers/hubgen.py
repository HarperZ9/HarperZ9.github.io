"""Append generated hub cards for spec-built explainers to hub.src.html (idempotent)."""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gen import load

here = pathlib.Path(__file__).parent
SLUGS = sys.argv[1:]
START, END = "<!-- generated-cards:begin -->", "<!-- generated-cards:end -->"


def motif(spec):
    pipe = next((b["pipe"] for st in spec["steps"] for b in st["scene"] if "pipe" in b), None)
    n = len(pipe["stages"]) if pipe else 4
    n = max(3, min(n, 8))
    gap = 320 / n
    w = gap * 0.62
    parts = ['<line x1="20" y1="60" x2="340" y2="60"/>']
    for i in range(n):
        x = 20 + i * gap + (gap - w) / 2
        cls = ' class="k"' if i == n // 2 else ""
        parts.append(f'<rect{cls} x="{x:.0f}" y="46" width="{w:.0f}" height="28"/>')
    parts.append(f'<circle class="dot" cx="{20 + (n // 2) * gap + gap / 2:.0f}" cy="94" r="4"/>')
    return f'<svg class="motif" viewBox="0 0 360 120" aria-hidden="true">{"".join(parts)}</svg>'


cards = []
for slug in SLUGS:
    s = load(slug)
    short = s["sha"][:7]
    shows = s.get("hub_shows") or s["description"].split(": ", 1)[-1].split(". Built from")[0]
    shows = "Shows " + shows[0].lower() + shows[1:].rstrip(".") + "."
    cards.append(f'''    <li class="xcard">
      {motif(s)}
      <div class="body">
        <h3><a href="repo-explainers/{slug}.html">{s["name"]}</a></h3>
        <p>{s["lede"]}</p>
        <p class="shows">{shows}</p>
        <div class="meta"><span>{len(s["steps"])} steps</span><span>{s["name"]} {s["version"].split()[-1]}, commit {short}</span><a href="https://github.com/HarperZ9/{s["repo"]}">repository</a></div>
      </div>
    </li>''')
p = here / "pages" / "hub.src.html"
src = p.read_text(encoding="utf-8")
block = START + "\n" + "\n".join(cards) + "\n    " + END
if START in src:
    a, rest = src.split(START, 1)
    _, b = rest.split(END, 1)
    src = a + block + b
else:
    src = src.replace("  </ul>\n</section>\n<section class=\"block wrap\" aria-labelledby=\"how-built\">",
                      "    " + block + "\n  </ul>\n</section>\n<section class=\"block wrap\" aria-labelledby=\"how-built\">", 1)
    assert START in src
p.write_text(src, encoding="utf-8", newline="\n")
print("cards:", len(cards))
