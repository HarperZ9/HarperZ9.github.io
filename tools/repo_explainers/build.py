"""Inline the shared CSS and JS into each explainer source page (pages/*.src.html).

    python tools/repo_explainers/build.py              # write out/<slug>.html
    python tools/repo_explainers/build.py --publish     # also copy each page the site already serves
                                                        # into repo-explainers/ (hub.html -> repo-explainers.html)
"""
import argparse, pathlib, shutil
here = pathlib.Path(__file__).parent
SITE = here.parents[1]


def built(src: pathlib.Path) -> bytes:
    page = src.read_text(encoding="utf-8")
    for key, name in (("/*CORE_CSS*/", "core.css"), ("/*CORE_JS*/", "core.js"), ("/*KIT_CSS*/", "kit.css"), ("/*KIT_JS*/", "kit.js")):
        page = page.replace(key, (here / name).read_text(encoding="utf-8"))
    return page.replace("\r\n", "\n").encode("utf-8")


def published(slug: str) -> pathlib.Path:
    return SITE / ("repo-explainers.html" if slug == "hub" else f"repo-explainers/{slug}.html")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(here / "out"))
    ap.add_argument("--publish", action="store_true")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for src in sorted((here / "pages").glob("*.src.html")):
        slug = src.name.replace(".src.html", "")
        data = built(src)
        (out / f"{slug}.html").write_bytes(data)
        note = ""
        if "\u2014" in data.decode("utf-8"):
            note = " EM-DASH PRESENT"
        if a.publish and published(slug).exists() and published(slug).read_bytes() != data:
            shutil.copyfile(out / f"{slug}.html", published(slug))
            note += " published"
        print(f"{slug}.html{note}")


if __name__ == "__main__":
    main()
