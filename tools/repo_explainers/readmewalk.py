"""Write Watch and Walkthrough sections into a repo README from the built page."""
import html, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import walkthroughs as wt

def md_inline(s):
    s = re.sub(r'<a href="([^"]+)">(.*?)</a>', lambda m: f'[{m.group(2)}]({m.group(1)})', s)
    s = re.sub(r'</?code>', '`', s)
    s = re.sub(r'</?(b|strong)>', '**', s)
    s = re.sub(r'<[^>]+>', '', s)
    return html.unescape(s)

def steps(page):
    ol = re.search(r'<ol class="walkthrough">(.*?)</ol>', page, re.S).group(1)
    for li in re.findall(r'<li>(.*?)</li>', ol, re.S):
        t = re.search(r'<h3>(.*?)</h3>', li, re.S).group(1)
        p = re.search(r'<p>(.*?)</p>', li, re.S).group(1)
        c = re.search(r'<pre class="cmd"><code>(.*?)</code></pre>', li, re.S)
        code = html.unescape(re.sub(r'<[^>]+>', '', c.group(1))) if c else None
        yield md_inline(t), md_inline(p), code

def section(slug, page):
    out = []
    tag, films = wt.release_films(slug)
    if films:
        out += [f"Rendered by this repository's {tag} release from its own output, so every number on screen is one that release produced.", ""]
        for scene, m, base in films:
            voice = " The narration is a synthesized version of the author's voice." if m.get("narrated") else ""
            out += [f"[![{m['title']}: a film rendered by the {tag} release]({base}/poster.jpg)]({base}/index.html)", "",
                    f"**[{m['title']}]({base}/index.html)** ({wt.length(m['duration'])}). Rendered from values read at commit {m['commit'][:7]}: [facts.json]({base}/facts.json).{voice}", ""]
    fit = wt.FIT.get(slug)
    if fit:
        key, why = fit
        title, length = wt.FILMS[key]
        url = f"{wt.SITE}/explainers.html#{key}-h"
        out += [f"[![{title}: a narrated film, {length}]({wt.SITE}/media/explainers/{key}/poster.jpg)]({url})", "",
                f"**[{title}]({url})** ({length}, narrated, captioned). {why} The film page carries the transcript, the sources and recall questions.", ""]
    out = (["## Watch", ""] + out) if out else []
    out += ["## Walkthrough", "",
            "Install it, run it once, then use the main feature. Each command below is real, and so is its output.", ""]
    for i, (t, p, code) in enumerate(steps(page), 1):
        out.append(f"{i}. **{t}.** {p}")
        if code:
            out += ["", "   ```text"] + [("   " + l) if l else "" for l in code.split("\n")] + ["   ```"]
        out.append("")
    return "\n".join(out)

def patch(readme, slug, page):
    """Insert the Watch and Walkthrough sections after "See it work", or refresh them in place."""
    s = readme.read_text(encoding="utf-8")
    block = section(slug, page)
    old = [h for h in ("## Watch\n", "## Walkthrough\n") if h in s]
    if old:
        a = min(s.index(h) for h in old)
        w = s.index("## Walkthrough\n", a)
        m = re.search(r'^## ', s[w + 3:], re.M)
        b = w + 3 + m.start() if m else len(s)
        s = s[:a] + block + "\n" + s[b:]
    else:
        a = s.index("## See it work, step by step")
        m = re.search(r'^## ', s[a + 3:], re.M)
        b = a + 3 + m.start() if m else len(s)
        s = s[:b] + block + "\n" + s[b:]
    readme.write_text(s, encoding="utf-8", newline="\n")

if __name__ == "__main__":
    slug, repo = sys.argv[1], pathlib.Path(sys.argv[2])
    here = pathlib.Path(__file__).parent
    page = (here / "out" / f"{slug}.html").read_text(encoding="utf-8")
    patch(repo / "README.md", slug, page)
    (repo / "docs" / "explainer" / "index.html").write_bytes((here / "out" / f"{slug}.html").read_bytes())
    print("patched", slug)
