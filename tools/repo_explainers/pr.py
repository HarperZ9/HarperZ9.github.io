"""Commit the staged explainer, push, and open a PR. usage: pr.py <repo-dir> <github-repo> <shows> <provenance> <checks>"""
import pathlib, subprocess, sys
repo, ghrepo, shows, prov, checks = sys.argv[1:6]
run = lambda *a, **k: subprocess.run(a, cwd=repo, check=True, **k)
run("git", "add", "README.md", "docs/explainer")
title = "docs: animated explainer, linked from the README"
msg = f"""{title}

A self-contained page at docs/explainer/index.html. It walks through
{shows}.

{prov}

Reduced motion, keyboard step controls and phone width are supported.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
"""
run("git", "commit", "-q", "-F", "-", input=msg, text=True)
run("git", "push", "-q", "-u", "origin", "docs/animated-explainer")
body = f"""Adds `docs/explainer/index.html`, a self-contained animated explainer, and a README section that links it.

What the animation shows: {shows}.

Provenance: {prov}

Checks run locally: {checks}

Accessibility: reduced-motion support, native button step controls with a live caption, no-JS fallback that shows every step's text, checked at desktop and narrow widths.

The live copy is served from harperz9.github.io/repo-explainers/ once the site PR lands.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
"""
r = subprocess.run(["gh", "pr", "create", "--repo", ghrepo, "--head", "docs/animated-explainer", "--title", title, "--body", body],
                   cwd=repo, capture_output=True, text=True)
print(r.stdout.strip(), r.stderr.strip()[-300:])
