# Cover letter: AI evaluation and test engineering

Zain Dana Harper | Kent, Washington | harperz9.github.io/cv.html | github.com/HarperZ9

Dear hiring team,

I build evaluation harnesses that test whether a check can be fooled, and publish the answer when it can. On 28 held-out tasks, a request-versus-action guard caught 64 of 66 harmful tool calls while a schema check caught 1 of 66. On a 145-case planted-defect suite, our Three-Plate Verification Oracle caught 115 of 115 defects with 0 false accepts (versus 7 of 115 for single-plate review), and pairing compact recall with a live BuildLang float64 oracle lifted a local 14B model from 16.67% to 95.83% (p = 4e-6) while rejecting 24 of 24 planted-wrong answers.

That work lives in Flywheel 2.0.0 on PyPI, Homebrew, and Scoop (31 consolidated packages including unsafe-free Rust EMET 1.3.1, Articulate 0.19.1 with 2,096 tests, Accountable Surface, 324 terminal-state fixtures, and a pinned METR count_odds run through Inspect). Its behavior check flagged 20 of 20 planted changes and 0 of 50 unchanged pairs, and my findings page publishes 30 reproducible results (12 of them nulls).

Other maintainers accept my fixes: they have merged 41 of my pull requests in 34 projects, DeepEval, Pydantic AI, Datasette, and python-grimp/grimp (#303 to #305) among them, counted November 14, 2026. I bring about thirteen years of programming, an independent engineering practice shipping tools on PyPI and crates.io, and eleven years in commercial tree care scoping jobs and managing safety-critical ground operations.

On your team I want to build planted faults, controls, and deterministic harnesses that make silent evaluation failures impossible to miss, and write up each finding so anyone can rerun it. Ask me directly about any requirement and I will answer with the evidence or the gap.

Zain Dana Harper

Written November 25, 2026. Figures and their sources: harperz9.github.io/career/source-ledger.md
