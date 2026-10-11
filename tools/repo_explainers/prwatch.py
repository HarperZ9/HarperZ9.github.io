"""Commit Watch and Walkthrough changes, push, open a PR. usage: prwatch.py <repo-dir> <github-repo> <film-or-none>"""
import subprocess, sys
repo, ghrepo, film = sys.argv[1:4]
run = lambda *a, **k: subprocess.run(a, cwd=repo, check=True, **k)
run("git", "add", "README.md", "docs/explainer/index.html")
title = "docs: Watch and Walkthrough sections in the README and explainer"
watch = (f"embeds the concept film \"{film}\" from harperz9.github.io/explainers.html, with captions and a link to its transcript and sources"
         if film != "none" else "says plainly that no concept film fits this tool yet")
msg = f"""{title}

The README and docs/explainer/index.html gain two sections. Watch {watch},
and notes that a narrated video walkthrough comes with the next release.
Walkthrough takes a reader through install, a first run and the main feature,
step by step, with commands and output copied from real runs recorded on the
explainer page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
"""
run("git", "commit", "-q", "-F", "-", input=msg, text=True)
run("git", "push", "-q", "-u", "origin", "docs/watch-walkthrough")
body = f"""Adds a **Watch** section and a **Walkthrough** section to the README and to `docs/explainer/index.html`.

- Watch: {watch}. A narrated video walkthrough is listed as coming with the next release; no dead link is added.
- Walkthrough: install, first run and the main feature, step by step. Every command and output is copied from runs already recorded on the explainer page, which cites its commit.

The explainer page stays byte-identical to the copy served at harperz9.github.io/repo-explainers/.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
"""
r = subprocess.run(["gh", "pr", "create", "--repo", ghrepo, "--head", "docs/watch-walkthrough", "--title", title, "--body", body],
                   cwd=repo, capture_output=True, text=True)
print(r.stdout.strip(), r.stderr.strip()[-300:])
