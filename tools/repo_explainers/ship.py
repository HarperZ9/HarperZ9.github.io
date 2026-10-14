"""Stage an explainer into a repo checkout: branch, page, docs README, README link.

usage: python ship.py <slug> <repo-dir> "<README heading to insert before>" "<what the explainer walks through>"
Committing, pushing and the PR are done separately after the repo's tests pass.
"""
import pathlib, subprocess, sys
here = pathlib.Path(__file__).parent
slug, repo, heading, walks = sys.argv[1:5]
repo = pathlib.Path(repo)
sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=repo, capture_output=True, text=True, check=True).stdout.strip()
subprocess.run(["git", "checkout", "-q", "-b", "docs/animated-explainer"], cwd=repo, check=True)
d = repo / "docs" / "explainer"
d.mkdir(parents=True, exist_ok=True)
(d / "index.html").write_bytes((here / "out" / f"{slug}.html").read_bytes())
(d / "README.md").write_text(f"""# {slug} explainer

`index.html` is a single self-contained page that walks through how this
repository works. It is published at
<https://harperz9.github.io/repo-explainers/{slug}.html>.

Open `index.html` in a browser to read it from a checkout. It loads two
typefaces from harperz9.github.io and falls back to system fonts offline.

The commands, values and verdicts on the page came from running this repository
at commit {sha}, and each step cites the file it describes. When the behaviour
it shows changes, rerun the commands in the page's "Try it" section and update
the values in the same pull request.
""", encoding="utf-8", newline="\n")
readme = repo / "README.md"
s = readme.read_text(encoding="utf-8")
ins = f"""## See it work, step by step

The [animated explainer](https://harperz9.github.io/repo-explainers/{slug}.html)
walks through {walks}. Every value on it is output from this repository. Its
source is [docs/explainer/index.html](docs/explainer/index.html).

"""
key = f"## {heading}\n"
assert s.count(key) == 1, f"heading not unique: {key!r}"
readme.write_text(s.replace(key, ins + key, 1), encoding="utf-8", newline="\n")
print("staged", slug, "at", sha)
