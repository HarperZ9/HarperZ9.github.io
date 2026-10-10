# Repository explainers: the generator

This folder builds the pages under `repo-explainers/` and the copy of each one in its own
repository at `docs/explainer/index.html`. One page walks through one repository: what it does
for you, the films to watch, how it works step by step, and a walkthrough of real commands with
their real output.

## Layout

| Path | What it is |
|---|---|
| `specs/<slug>.py` | The data for a spec-built page: steps, scenes, uses, limits, provenance (repository and commit). |
| `pages/<slug>.src.html` | Each page's source. Spec-built pages are written by `gen.py`; `raw-native`, `flywheel`, `articulate` and the hub (`hub.src.html`, published as `repo-explainers.html`) are hand-written. |
| `core.css`, `core.js`, `kit.css`, `kit.js` | Shared style and behaviour, inlined into every page by `build.py`. |
| `walkthroughs.py`, `walk2.py` | Walkthrough steps per page, and the Watch section: the latest release's own films, then the concept film that fits. |
| `gen.py` | Writes `pages/<slug>.src.html` from `specs/<slug>.py`. |
| `build.py` | Inlines the shared files and writes `out/<slug>.html`; `--publish` copies changed pages into `repo-explainers/`. |
| `rewatch.py` | Refreshes only the Watch section of source pages. |
| `readmewalk.py` | Writes the Watch and Walkthrough sections into a repository's README and copies the page to `docs/explainer/index.html`. |
| `hubgen.py` | Adds hub cards for spec-built pages. |
| `ship.py`, `pr.py`, `prwatch.py`, `check.sh` | Stage a page in a repository checkout, run its checks, commit and open the pull request. |
| `capture/` | The scripts that ran each repository to capture the output shown on its page. They run against clones in the folder named by `EXPLAINER_REPOS`. Their sample inputs for the writing checker contain em dashes on purpose. |

## When a repository's release media lands

Release media (raw-native ADR 0012) arrives in this site under
`media/releases/<repo>/<tag>/<scene>/`, each scene with a `media.json`. The Watch section reads the
latest tag there, so a repository gains its films with three commands:

```
python tools/repo_explainers/rewatch.py <slug>
python tools/repo_explainers/build.py --publish
python tools/repo_explainers/readmewalk.py <slug> <path-to-the-repository-checkout>
```

Then open a pull request in the repository (`docs/explainer/index.html` and `README.md`) and one
here (`repo-explainers/<slug>.html`). The two copies are byte-identical.

A page with neither release films nor a fitting concept film has no Watch section. No page
promises a video that does not exist yet.

## Checks

`tests/test_repo_explainers_generator.py`:

- every source page builds, byte for byte, into the page the site serves;
- every spec regenerates its source page, apart from the Watch section;
- no generated page promises a future video;
- release films come from the latest tag;
- no local paths in the tool.

Pages built from older output keep the commit they were built from in their header. Rebuilding a
page from new output means rerunning its capture script and updating its spec in the same pull
request.
