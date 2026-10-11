"""Refresh only the Watch section of built explainer source pages from walkthroughs.watch_html.

usage: python rewatch.py <slug> [<slug> ...]
Run build.py afterwards (build.py --publish updates the site copies). Pages with nothing to watch lose the section: no line promises a video.
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import walkthroughs as wt

here = pathlib.Path(__file__).parent
OPEN = '<section class="block wrap" aria-labelledby="watch">'

for slug in sys.argv[1:]:
    p = here / "pages" / f"{slug}.src.html"
    s = p.read_text(encoding="utf-8")
    body = wt.watch_html(slug)
    new = f'{OPEN}\n  <h2 id="watch">Watch</h2>\n  {body}\n</section>\n\n' if body else ""
    if OPEN in s:
        a = s.index(OPEN)
        b = s.index("</section>", a) + len("</section>")
        while s[b:b + 1] == "\n":
            b += 1
        s = s[:a] + new + s[b:]
    elif new:
        h = s.index('<section class="block wrap" aria-labelledby="how">')
        s = s[:h] + new + s[h:]
    p.write_text(s, encoding="utf-8", newline="\n")
    print(slug, "watch:", "films" if body else "none (section removed)")
