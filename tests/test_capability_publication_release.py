"""Selective-release contract for the reviewed capability/publication spine."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]

RELEASE_PATHS = (
    "assets/index-Dv8VLt1g.js",
    "assets/index-BniK76UM.js",
    "assets/index-DXjCZzHu.js",
    "assets/index-BexgIZUT.js",
    "assets/index-mtbFWZrz.js",
    "assets/index-G7cmpE16.js",
    "assets/index-DDpFxCuj.js",
    "assets/index-DI6YWfTZ.js",
    "assets/index-DtNiguMs.js",
    "assets/index-FBDE3rFM.js",
    "why-i-do-this.html",
    "publications/data/listings/why-i-do-this.json",
    "img/og/why-i-do-this.png",
    "system/series-table.css",
    "assets/index-BkvbD78Z.js",
    "work-with-me.html",
    "independence.html",
    "income-ledger.html",
    "assets/index-CyztdbmV.js",
    "assets/index-DbZyfUEO.css",
    "who-knew-first-series.html",
    "verified-is-not-trustworthy.html",
    "conferred-existence-essay.html",
    "writing/index.html",
    "publications/index.html",
    "papers/index.html",
    "publications/data/sections.json",
    "publications/data/papers.json",
    "publications/data/series/who-knew-first.json",
    "img/og/who-knew-first-series.png",
    "system/series.css",
    "publications/data/listings/models-propose-oracles-dispose.json",
    "publications/data/listings/no-receipt-no-accept.json",
    "publications/data/listings/pick-the-lock-for-everyone.json",
    "publications/data/listings/the-summary-is-not-the-record.json",
    "publications/data/listings/verified-is-not-trustworthy.json",
    "publications/data/listings/conferred-existence-essay.json",
    "publications/data/listings/frontier-safety-openai-hugging-face-incident.json",
    "publications/data/listings/witnessing-spine.json",
    "publications/data/listings/conferred-existence.json",
    "publications/data/listings/why.json",
    "publications/data/listings/current-story.json",
    "assets/index-D7LI6_j0.js",
    "assets/index-DkLmGDFh.js",
    "assets/index-B5IIN--D.js",
    "who-pays-the-referees.html",
    "publications/data/listings/who-pays-the-referees.json",
    "img/og/who-pays-the-referees.png",
    "the-terms-for-telling.html",
    "publications/data/listings/the-terms-for-telling.json",
    "img/og/the-terms-for-telling.png",
    "who-kept-the-books.html",
    "publications/data/listings/who-kept-the-books.json",
    "img/og/who-kept-the-books.png",
    "the-maker-is-part-of-the-story.html",
    "publications/data/listings/the-maker-is-part-of-the-story.json",
    "img/og/the-maker-is-part-of-the-story.png",
    "a-check-it-cannot-predict.html",
    "publications/data/listings/a-check-it-cannot-predict.json",
    "img/og/a-check-it-cannot-predict.png",
    "assets/index-Dmke1bnx.js",
    "assets/index-BIA-0d5A.js",
    "the-number-has-a-vintage.html",
    "publications/data/records/the-number-has-a-vintage.json",
    "img/og/the-number-has-a-vintage.png",
    "figures/vintage-benchmark-records.html",
    "figures/vintage-benchmark-records.json",
    "figures/vintage-benchmark-records.svg",
    "figures/vintage-like-for-like-check.html",
    "figures/vintage-like-for-like-check.json",
    "figures/vintage-like-for-like-check.svg",
    "assets/index-DMn8Bp7X.js",
    "support-has-more-than-one-record.html",
    "publications/data/records/support-has-more-than-one-record.json",
    "img/og/support-has-more-than-one-record.png",
    "what-the-formula-counts.html",
    "publications/data/records/what-the-formula-counts.json",
    "img/og/what-the-formula-counts.png",
    "the-scene-the-song-did-not-tell-you.html",
    "publications/data/records/the-scene-the-song-did-not-tell-you.json",
    "img/og/the-scene-the-song-did-not-tell-you.png",
    "the-timestamp-is-not-the-order.html",
    "publications/data/records/the-timestamp-is-not-the-order.json",
    "img/og/the-timestamp-is-not-the-order.png",
    "img/og/borrowed-ground.png",
    "writing/borrowed-ground/source-map.json",
    "writing/borrowed-ground/essay.md",
    "publications/data/records/borrowed-ground.json",
    "borrowed-ground.html",
    "assets/index-DrPnIzlB.js",
    "assets/index-CX_9A0Hy.js",
    "assets/index-4wTyKocM.js",
    "assets/index-JJHLIJUt.js",
    "assets/index-DYDJA8vR.js",
    "assets/index-D4UoCuIT.js",
    "assets/index-DuXEIE3Q.js",
    "assets/index-9egMTEOG.js",
    "assets/index-TO_R52sc.js",
    "img/og/the-sandbox-was-never-just-a-box.png",
    "writing/the-sandbox-was-never-just-a-box/source-map.json",
    "writing/the-sandbox-was-never-just-a-box/essay.md",
    "publications/data/records/the-sandbox-was-never-just-a-box.json",
    "the-sandbox-was-never-just-a-box.html",
    "assets/index-DPnmw9p_.js",
    "img/og/ltj-bukem-the-man-behind-the-atmosphere.png",
    "writing/ltj-bukem-the-man-behind-the-atmosphere/source-map.json",
    "writing/ltj-bukem-the-man-behind-the-atmosphere/essay.md",
    "publications/data/records/ltj-bukem-the-man-behind-the-atmosphere.json",
    "ltj-bukem-the-man-behind-the-atmosphere.html",
    "assets/index-b2DeyYcU.js",
    "site-index.html",
    "system/site-index.css",
    "system/site-index.js",
    "assets/index-BdFe8daW.js",
    "assets/index-Ah1hhjoZ.js",
    "assets/index-CHqKSAcx.js",
    "assets/index-CLzTNvxy.js",
    "assets/index-BHRZupim.js",
    "assets/index-D6p_rWan.js",
    "a-witness-should-not-become-a-ruler.html",
    "writing/a-witness-should-not-become-a-ruler/01.md",
    "writing/a-witness-should-not-become-a-ruler/02.md",
    "writing/a-witness-should-not-become-a-ruler/03.md",
    "writing/a-witness-should-not-become-a-ruler/source-notes.json",
    "writing/a-witness-should-not-become-a-ruler/tool-source-map.json",
    "img/og/a-witness-should-not-become-a-ruler.png",
    "checking-the-machines.html",
    "writing/checking-the-machines/01.md",
    "writing/checking-the-machines/source-notes.json",
    "demos/crucible-cleanroom/index.html",
    "emet-sample.html",
    "gallery.html",
    "loom.html",
    "presentation.html",
    "proof-index-sample.html",
    "proof-surface-sample.html",
    "public-surface-sweeper-sample.html",
    "studio.html",
    "system/demo-editorial.css",
    "system/discovery/lab.html",
    "system/doc.css",
    "system/instrument-editorial.css",
    "system/report-editorial.css",
    "system/system.css",
    "warden.html",
    "assets/index-CPG6kzKK.js",
    "assets/index-ClATdIWg.js",
    "assets/index-CS_jYuhh.js",
    "assets/index-CxyhrtVk.js",
    "assets/index-BQ-flpWG.js",
    "system/theme.js",
    "system/theme-entry.js",
    "system/theme.css",
    "assets/index-eZ1QGP52.css",
    "assets/index-BORSyU4q.css",
    "assets/index-DPe17JSn.css",
    "assets/index-DJj37yQz.css",
    "typeface.html",
    "system/type-specimen.css",
    "fonts.html",
    "requirements-font-preview.txt",
    "system/font-catalog.mjs",
    "system/font-marketplace.css",
    "system/font-specimen.js",
    "type/preview/editorial.json",
    "type/preview/mono.json",
    "type/preview/zain-editorial-regular.woff2",
    "type/preview/zain-mono-regular.woff2",
    # Compatibility copies at the pre-rename URLs, byte-identical to the Zain files.
    "type/preview/zentropy-editorial-regular.woff2",
    "type/preview/zentropy-mono-regular.woff2",
    "img/og/typeface.png",
    # 3 October 2026: the type forge, the in-browser Zain Mint engine (in progress, no download).
    "type-forge.html",
    "system/type-forge/forge.mjs",
    "system/type-forge/geometry.mjs",
    "system/type-forge/skeletons.mjs",
    "system/type-forge/skeletons-caps.mjs",
    "system/type-forge/pyround.mjs",
    "system/type-forge/ttf.mjs",
    "system/type-forge/forge-page.js",
    "system/type-forge/forge-page.css",
    "accountable-surface.html",
    "availability-is-not-reach.html",
    "analytics/benchmark-evidence-status.html",
    "analytics/benchmark-evidence-status.json",
    "analytics/current-cross-harness-pilot.html",
    "analytics/current-cross-harness-pilot.json",
    "analytics/current-cross-harness-pilot.svg",
    "analytics/exploratory-stack-comparison.html",
    "analytics/exploratory-stack-comparison.json",
    "analytics/exploratory-stack-comparison.svg",
    "analytics/flywheel-benchmark-record.html",
    "analytics/flywheel-benchmark-record.json",
    "analytics/flywheel-benchmark-record.svg",
    "analytics/market-baseline-plan.json",
    "analytics/model-pass-at-1-comparison.html",
    "analytics/model-pass-at-1-comparison.json",
    "analytics/model-pass-at-1-comparison.svg",
    "analytics/portfolio-analytics.json",
    "analytics/portfolio-source-inventory.html",
    "analytics/portfolio-source-inventory.json",
    "analytics/source/current-cross-harness-pilot-source.json",
    "analytics/source/flywheel-capability-declarations.json",
    "analytics/source/flywheel-offline-benchmark-record.json",
    "brender-archival.html",
    "bulletin.html",
    "briefings/2026-08-26-openai-hugging-face-incident/build.json",
    "briefings/2026-08-26-openai-hugging-face-incident/claims.json",
    "briefings/2026-08-26-openai-hugging-face-incident/figures.json",
    "briefings/2026-08-26-openai-hugging-face-incident/index.html",
    "briefings/2026-08-26-openai-hugging-face-incident/publication.json",
    "briefings/2026-08-26-openai-hugging-face-incident/social/linkedin.txt",
    "briefings/2026-08-26-openai-hugging-face-incident/social/x.txt",
    "briefings/2026-08-26-openai-hugging-face-incident/sources.json",
    "briefings/index.html",
    "career/career-artifacts.json",
    "career/career-build-receipt.json",
    "career/standards-reference.md",
    "career/open-source-census.json",
    "career/Zain-Dana-Harper-CV.docx",
    "career/Zain-Dana-Harper-CV.pdf",
    "career/Zain-Dana-Harper-Cover-Letter.docx",
    "career/Zain-Dana-Harper-Cover-Letter.pdf",
    "career/Zain-Dana-Harper-Portfolio-Brief.docx",
    "career/Zain-Dana-Harper-Portfolio-Brief.pdf",
    "career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.docx",
    "career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.pdf",
    "career/Zain-Dana-Harper-Resume-Grounds.docx",
    "career/Zain-Dana-Harper-Resume-Grounds.pdf",
    "career/Zain-Dana-Harper-Resume-Public-Operations.docx",
    "career/Zain-Dana-Harper-Resume-Public-Operations.pdf",
    "career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.docx",
    "career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf",
    "catalog.html",
    "canon.html",
    "cover-letter.html",
    "cv.html",
    "cv.md",
    "dossier.html",
    "feed.json",
    "feed.xml",
    "figures/availability-is-not-reach.html",
    "figures/availability-is-not-reach.json",
    "figures/availability-is-not-reach.svg",
    "figures/claim-provenance-panel.html",
    "figures/claim-provenance-panel.json",
    "figures/claim-provenance-panel.svg",
    "figures/control-boundary-flow.html",
    "figures/control-boundary-flow.json",
    "figures/control-boundary-flow.svg",
    "figures/graphics-retro-capability-map.html",
    "figures/graphics-retro-capability-map.json",
    "figures/graphics-retro-capability-map.svg",
    "figures/growth-needs-a-before.html",
    "figures/growth-needs-a-before.json",
    "figures/growth-needs-a-before.svg",
    "figures/incident-multilane-timeline.html",
    "figures/incident-multilane-timeline.json",
    "figures/incident-multilane-timeline.svg",
    "figures/label-is-a-lens.html",
    "figures/label-is-a-lens.json",
    "figures/label-is-a-lens.svg",
    "figures/motive-sample-nonexclusive.html",
    "figures/motive-sample-nonexclusive.json",
    "figures/motive-sample-nonexclusive.svg",
    "figures/recovered-actions-by-day.html",
    "figures/recovered-actions-by-day.json",
    "figures/recovered-actions-by-day.svg",
    # 2026-09-25: the sandbox essay's rewritten record carries a figure.
    "figures/sandbox-two-findings.html",
    "figures/sandbox-two-findings.json",
    "figures/sandbox-two-findings.svg",
    "figures/security-capability-map.html",
    "figures/security-capability-map.json",
    "figures/security-capability-map.svg",
    "figures/source-scope-matrix.html",
    "figures/source-scope-matrix.json",
    "figures/source-scope-matrix.svg",
    "figures/system-capability-map.html",
    "figures/system-capability-map.json",
    "figures/system-capability-map.svg",
    "figures/task-overrepresentation.html",
    "figures/task-overrepresentation.json",
    "figures/task-overrepresentation.svg",
    "figures/the-second-hearing-evidence-map.html",
    "figures/the-second-hearing-evidence-map.json",
    "figures/the-second-hearing-evidence-map.svg",
    "figures/verification-capability-map.html",
    "figures/verification-capability-map.json",
    "figures/verification-capability-map.svg",
    "hire.html",
    "growth-needs-a-before.html",
    "engine-revival.html",
    "elder-enb.html",
    "enb-runtime-core.html",
    "flywheel.html",
    "frontier-safety-openai-hugging-face-incident.html",
    "img/og/behavior-transform.png",
    "img/og/availability-is-not-reach.png",
    "img/og/growth-needs-a-before.png",
    "img/og/brender-archival.png",
    "img/og/bulletin.png",
    "img/og/canon.png",
    "img/og/join.png",
    "img/og/elder-enb.png",
    "img/og/engine-revival.png",
    "img/og/plexus.png",
    "img/og/portfolio-home.png",
    "img/og/profile.png",
    "img/og/private-practice.png",
    "img/og/publications.png",
    "img/og/security-toolkit.png",
    "img/og/truth-enb.png",
    "img/og/the-second-hearing.png",
    "img/og/what-the-label-changes.png",
    "img/og/cards-data.js",
    "img/og/_card.html",
    "index.html",
    "index-graph.html",
    "join.html",
    "media/retro-systems-lab/evidence-manifest.json",
    "media/retro-systems-lab/identity/brender-verify.svg",
    "media/retro-systems-lab/identity/crossover.svg",
    "media/retro-systems-lab/identity/engine-preserve.svg",
    "media/retro-systems-lab/identity/retro-play.svg",
    "media/retro-systems-lab/manifest.json",
    "models-propose-oracles-dispose.html",
    "no-receipt-no-accept.html",
    "overview.html",
    "pick-the-lock-for-everyone-talk.html",
    "pick-the-lock-for-everyone.html",
    "publications.html",
    "publications/build.json",
    "publications/data/index.json",
    "publications/data/records/availability-is-not-reach.json",
    "publications/data/records/growth-needs-a-before.json",
    "publications/data/records/the-second-hearing.json",
    "publications/data/records/what-the-label-changes.json",
    "publications/schema/publication-record.schema.json",
    "private-practice.html",
    "security-toolkit.html",
    "security-tools.json",
    "system/bulletin-board.js",
    "system/bulletin-work.js",
    "system/figure.css",
    "system/figure.js",
    "system/figure.test.mjs",
    "system/hire.css",
    "system/home-art.js",
    "system/publication-article.css",
    "system/publications.css",
    "system/publications.js",
    "system/reading.css",
    # 2026-09-25 human-first notebook: the token file and the notebook sheet module
    # load on every spine page through reading.css and figure.css.
    "system/tokens.css",
    "system/notebook-sheet.css",
    "system/print.css",
    "system/retro-systems-lab.css",
    # 2026-09-25 void-and-bone pass: the catalog, product map and record pages, and
    # the hub pages, link these family sheets.
    "system/catalog.css",
    "system/hubs.css",
    "system/hubs-fonts.css",
    "system/hubs-guides.css",
    "system/routes.js",
    "system/systems.js",
    "system/systems.json",
    "retro.html",
    "research.html",
    "resume.html",
    "resume.md",
    "resume-evaluation-tooling.html",
    "resume-grounds.html",
    "resume-public-operations.html",
    "resume-support-operations.html",
    "sitemap.xml",
    "systems/behavior-transform.html",
    "systems/bulletin.html",
    "systems/mneme.html",
    "systems/plexus.html",
    "systems/relay.html",
    "systems/studio-engine.html",
    "systems/telos.html",
    "the-second-hearing.html",
    "truth-enb.html",
    "what-the-label-changes.html",
    "writing.html",
)

# Reviewed Flywheel v1.0.1 site rollup over the combined release tree: capability-first
# product description made canon across home/catalog/registry with the refreshed home
# bundle pair (index-JJHLIJUt.js; index-4wTyKocM.js retained as the superseded rollup
# bundle); CV and resume refresh (cv.html, cv.md, regenerated career binaries); and the
# "An open letter on checking the machines" reading page with its source part, source
# notes, writing-index, homepage and sitemap links. Recomputed by _release_fingerprint().
# September 20, 2026: reviewed letter-only revision; all other release paths
# remain byte-identical to 87c320c. The frozen contract is retained.
# September 23, 2026: reviewed Frontier Safety archive route added to the
# sitemap; all other release-spine paths remain byte-identical.
# September 25, 2026: reviewed studio.html copy edit that removes four em
# dashes; all other release-spine paths remain byte-identical.
# September 25, 2026: reviewed Who Knew First registration (route registry,
# site index, sitemap, writing index and publication build record); all other
# release-spine paths remain byte-identical.
# September 25, 2026, evening: the void-and-bone redesign (plate.css surface, poster
# home bundle, art covers, Articulate page and record, Flywheel 1.0.4 facts, the
# sandbox figure, capability-map and registry updates, publication listings).
# September 25, 2026, 20:00: author-approved essay rewrites ship; descriptions fit
# the 160-character limit, the surface moves into tokens.css for no-JS readers, and
# the site index regains the Who Knew First pillar.
# September 26, 2026: the 25 September void-plates integration, rebased on public
# main d422871. Six page families (charts, briefing, studio, career, systems, hubs)
# move to the void-and-bone plates: publication tables stack on phones and name a
# result column, with "Does not prove" first; the home bundle pair becomes
# index-DYDJA8vR.js and index-BORSyU4q.css; per-domain system plates and the
# catalog.css family sheet; the hubs sheets join the release tree (catalog.css,
# hubs.css, hubs-fonts.css, hubs-guides.css); career, studio, frontier-safety and
# figure cache keys move to their 20260925 revisions; the incident briefing hashes
# refresh for the remapped figure palette; the frontier-safety head drops its
# fallback theme-color; under 40rem a data-stack figure table (figure.css and
# publication-article.css) reads as one record per row in place of a sideways scroll.
# The node renderers, build_publications, build_frontier_safety_briefing and
# render_career_pages --check reran byte-identical on the new base.
# tools/build_checking_machines.py and tools/render_legacy_essays.py (for
# no-receipt-no-accept.html) lag their pages and were not rerun; rerunning them
# would drop the 25 September plain-language edition and revert approved prose.
# September 26, 2026: the void-plates review pass. Reader text sits on a calm
# paper ground sitewide with the field in the gutters (plate.css floor, product
# column, career, catalog, charts, figures and home sections); one ink aperture
# brand mark; embedded figures drop their own chrome; the six remaining incident
# figures and the four capability maps take the sheet palette with square
# corners; the claim cards open on plain titles; a distinct frontier-safety
# edition cover; the home bundle pair becomes index-DYDJA8vR.js and
# index-BORSyU4q.css with the human-first pair kept as retained history;
# pick-the-lock-for-everyone.html regenerated from its source (word count
# 23,456).
# September 26, 2026: the facts pass. Seventeen tools move to the versions PyPI and
# GitHub serve today (Gather 1.9.0, Crucible 1.3.0, Relay 0.4.0, Mneme 0.5.1, Canon
# 0.4.2, Articulate 0.5.0, Index 2.13.0, Forum 1.14.0, Plexus 0.2.2, Accountable
# Surface 0.3.1, Telos 0.4.1, Phantom 1.1.1 and the toolkit rows); each fixing
# release carries its published advisory; the Flywheel lane relations re-source to
# the v1.0.4 lane registry; the capability maps, record pages and home bundle
# (index-D4UoCuIT.js) regenerate from the registry. The review pass moves Chorus to
# 0.3.1 on PyPI, drops commit hashes from the lane summaries on the home page and
# lists the home evidence newest first.
# September 27, 2026: Forum 1.15.1, Gather 1.9.1 and Relay 0.5.0 with the five
# advisories published that day; the security plate lists twelve advisories and
# the five Flywheel 1.0.4 lane pins inside their ranges. The review pass bounds the
# PATH claims and counts advisories in the relations instead of listing IDs. Bulletin
# moves to its 0.5.0 release and live contract, and BuildLang to its v1.4.0 GitHub
# release with 1.2.0 still on crates.io. The home bundle rebuilt from the refreshed
# registry is index-DuXEIE3Q.js.
# September 27, 2026, copy pass: the registry drops its fourteen "operator" uses for
# plain product words, and record pages and capability maps show relation wording
# from scripts/relation-wording.mjs ("Flywheel includes Relay as a lane") in place
# of raw keys such as "integrates lane". The Accountable Surface social card takes
# its new headline. Catalog, overview, record pages, capability maps, security
# registry, route registry, site index and the home bundle (index-Brb2IBwO.js)
# regenerate from the registry.
# September 27, 2026, copy pass, second commit: advisory IDs and package names stay
# whole on narrow screens. Generated pages, the three code-backed capability maps,
# the site index, eleven hand pages and the home wrap each one in class="ident";
# system.css, doc.css, figure.css and the home sheet carry the rule; record-page facts
# keep flex only on the status fact. The home pair is index-CGMskzEB.js and
# index-DPe17JSn.css.
# September 27, 2026, copy pass, third commit: punctuation that touches a marked token
# (an opening bracket before it, a comma, full stop or closing bracket after it) sits
# inside the marked span, so it cannot end or start a line alone. Tokens inside the
# no-wrap .built-stat stay unmarked, and code inside a marked span takes no extra
# leading. The home bundle is index-BzE0lc-H.js; the intermediate index-CGMskzEB.js
# was never published and is gone.
# September 27, 2026, copy pass, review fixes: the home board note and the Bulletin
# page name the person who runs the board in place of "operator"; capability-map
# edge titles read as the record-page sentence; coherence-membrane joins the marked
# package names; record social cards carry their image's content hash as ?v=;
# system.css, figure.css and catalog.css move to the 20260927-copy-pass key on every
# page and generator that links them; provenance-sensorium.html is marked. The home
# bundle is index-9egMTEOG.js; index-BzE0lc-H.js was never published and is gone.
# September 28, 2026: Who Knew First's dated follow-up updates its listing and
# the five generated index, feed and build artifacts. The original author
# paragraphs and nine-case record remain unchanged.
# September 28, 2026: four reviewed Atlas essays, source records and share cards;
# refreshed Flywheel and Articulate release copy across the registry and home.
# September 30, 2026: reviewed career documents add issued Applied Skills,
# completed coursework, public-interest writing, Kent location and availability.
# The source-ledger categories, quantitative outcomes, standards reference and
# five-page CV passed independent review. The MCP badge was issuer-verified.
# September 30, 2026: independently reviewed Qualys Policy Audit certification
# update; issuer dates and assessed knowledge added to career formats.
# September 30, 2026: CAR credential and both issuer-verified Qualys Certified
# Specialist designations added; CV widow guard and spacing independently reviewed.
# September 30, 2026: reviewed VMDR direct-exam credential and two Claude
# assessment-awarded completion badges; issuer scope remains explicit.
# September 30, 2026: reviewed Qualys Kubernetes and Container Security
# direct-exam certification added without optional-course or production claims.
# September 30, 2026: reviewed TotalCloud/EDR direct-exam credentials and
# current-main Frontier Safety integration; published incoming content unchanged.
# September 30, 2026: reviewed Google DeepMind Advanced assessed skill badge,
# bounded coding result, and CV-only bullet spacing; no broader training claim.
# September 30, 2026: reviewed UNESCO intermediate AI ethics course certificate
# and governance scope; issuer URL preserved, no study-hours or accreditation claim.
# September 30, 2026: reviewed Google multi-agent skill badge and Cisco learning
# credential; model-policy generation failure and knowledge-exam scope preserved.
# September 30, 2026: reviewed Azure DevOps Applied Skills credential and
# Google model-evaluation course badge; assessment and runtime limits retained.
# October 1 issuer record, September 30 local completion: reviewed BigQuery
# validation badge and Claude Bedrock coursework; full LF inventory grouped intact.
# October 1 issuer record: reviewed Create ML Models with BigQuery ML badge;
# grouped lab-scope records preserve distinct levels, checkpoints, and date evidence.
# September 30 local completion: reviewed Advanced SecOps course badge;
# grouped coursework retains issuer levels and limits, without practical-lab claims.
# 2026-09-30: reviewed personal-project/employment classification and career-transition correction.
# October 1, 2026: Who Pays the Referees, the first series piece after Who Knew
# First, joins the publication index, feeds, sitemap, route registry, site index
# and home bundle with its listing and share card.
# October 1, 2026 review: four sourcing fixes in who-pays-the-referees.html (Alphabet's
# stake wording, "at least four labs", a dated status line, one scoped series item); no
# other release path changed.
# October 1, 2026: Who Knew First's dated follow-up and five dated corrections update
# its listing and, rebased onto the Who Pays the Referees release, the regenerated
# publication index, feeds, build receipt, route registry, site index and home bundle
# (index-DkLmGDFh.js). who-pays-the-referees.html replaces its dated "not yet on that
# page" line with the published follow-up. The original author paragraphs and the
# nine-case record remain unchanged.
# October 1, 2026: reviewed Atlas essay The Number Has a Vintage, its source record,
# two figures and share card, rebased onto the Who Pays the Referees and Who Knew First
# follow-up releases; the publication index, feeds, build receipt, route registry, site
# index and home bundle (index-D7LI6_j0.js) are regenerated on that base. The bundle
# built on the old base, index-BLnRqjW-.js, was never published and is gone.
# October 1, 2026: one home for reading. publications.html becomes the Writing hub with five
# sections generated from publications/data/sections.json; the eleven hand-written rows become
# listings; writing.html and the writing/, publications/ and papers/ folders become redirect
# pages; the two inline essays move to pages of their own; the Who Knew First series hub,
# back-link lines on every piece, the Writing pillar and menu group, the Frontier Safety
# edition list, the briefings index, sitemap, feeds, build receipt, route registry, site
# index and home bundle (index-Dmke1bnx.js, index-DbZyfUEO.css) are regenerated.
# October 1, 2026: Who Pays the Referees gains four dated corrections; the page is rehashed.
# October 1, 2026: The Terms for Telling, series piece 2, is published with its listing and
# card; the series hub, the Writing hub, the series panel on Who Pays the Referees, feeds,
# sitemap, build receipt, route registry, site index and home bundle (index-BIA-0d5A.js) are
# regenerated.
# October 1, 2026: Zentropy Labs is retired. Page titles, bylines, the home bundle
# (index-CyztdbmV.js), the open letter signature, the CV and the two affected social
# cards name Zain Dana Harper.
# October 1, 2026: Work with me (services, scoped quotes, limits, case studies from published
# work), the independence policy and the public income ledger join the Work routes and the
# sitemap; the route registry, site index, publication build receipt and home bundle
# (index-BkvbD78Z.js) are regenerated. index-CyztdbmV.js stays as retained history.
# October 1, 2026: the typefaces are renamed Zain Editorial and Zain Mono (name table,
# files, CSS, specimen copy); the old font URLs stay as byte-identical copies, and the
# route registry, site index and home bundle (index-FBDE3rFM.js) are regenerated; the
# re-render also picks up the Continue the series text from #286.
# index-BkvbD78Z.js stays as retained history.
# October 1, 2026: Why I Do This, the author's own account, opens the Who Knew First series
# as its "Start here" piece, with its listing and card. The Continue the series table gains
# a Start here row on every series page, the series hub and the Writing hub link it, and the
# feeds, sitemap, build receipt, route registry, site index and home bundle
# (index-B3PP6LeH.js) are regenerated. index-FBDE3rFM.js stays as retained history.
# October 1, 2026, before publication: the author retitles the opener A Bullshitter Knows a
# Bullshitter; the slug why-i-do-this.html stays. The listing, series opener, card, feeds,
# build receipt, route registry, site index, series tables and home bundle
# (index-C1IxEots.js) are regenerated. index-B3PP6LeH.js was never published and is gone.
# October 1, 2026, before publication: the purple-team passage, the June-page bridge and the
# close of why-i-do-this.html now use the author's own words. No derived file changes.
# October 1, 2026, before publication: why-i-do-this.html gains the author's spoken answer on
# purple teaming, redemption and the alder. Its reading time moves from 8 to 10 minutes, so the
# series tables and the build receipt are regenerated.
# October 1, 2026, before publication: the alder paragraph in why-i-do-this.html now uses the
# author's words of 16 September 2026 on the red alder and on truth, and the next paragraph gains
# his sentence on stewards. Its reading time stays at 10 minutes, so no derived file changes.
# October 2, 2026: merged with main after the independence policy v2, the Zentropy logotype
# retirement and the plugin page refreshes; the release is rehashed on that base.
# October 2, 2026: the opener goes live and its publication date moves from 1 to 2 October in
# the page, its listing, the feeds, the publication index, the build receipt, the series tables,
# the route registry, the site index and the home bundle (index-DtNiguMs.js, replacing the
# never-published index-C1IxEots.js).
# October 1, 2026: Who Knew First gains a third dated follow-up and The Terms for Telling a
# further dated update; both pages are rehashed.
# October 2, 2026: merged with main after the series opener went live; rehashed on that base.
# October 2, 2026: dated reference corrections across fourteen pages, Who Knew First's publication
# date moved to 25 September, nine listings dated 2 October, and the home bundle rebuilt as
# index-DI6YWfTZ.js; the release is rehashed.
# October 3, 2026: the correction batch merged on 3 October, so every batch note and listing date
# moved from 2 to 3 October with tools/correction_batch.py; the release is rehashed.
# October 3, 2026: the six philosophy papers published in their October edition from
# writing/papers/ (tools/render_papers.py), three new paper PDFs listed in papers.json, and the
# Witnessing Spine foreword added; the release is rehashed.
# October 3, 2026: search and citation metadata (JSON-LD, citation tags, feed links) written into
# page heads by tools/structured_data.py and the system record renderer; the release is rehashed.
# October 3, 2026: the confirmed second-read corrections on Who Knew First, Who Pays the Referees
# and The Terms for Telling, and the arity correction on the Conferred Existence essay, each with
# a dated note, merged over the structured-data release; the series reading time follows; the
# release is rehashed.
# October 3, 2026: RAW now describes the public C++23 reference renderer (raw.html, the system
# registry, the record pages and capability maps, and the home bundle index-DDpFxCuj.js); the
# release is rehashed (merged over the media fixes).
# October 3, 2026: the type forge (type-forge.html and system/type-forge/) joins the release, and
# fonts.html and typeface.html link to it; the release is rehashed.
# October 3, 2026: the type forge joins the route registry and the site index, and the
# publication receipt records the sitemap that lists it; the release is rehashed.
# October 3, 2026: the research record counts twelve DOI records (the four October editions
# join it on the Writing hub, the CV, the resumes and the dossier), the two archived corpora are
# typeset with LaTeX with build receipts, and the home bundle is index-G7cmpE16.js; the release
# is rehashed. Later the same day a Zenodo search by ORCID returned thirteen records: the formal
# note on faithfulness (15 September 2026) joins the record, the bundle is index-BniK76UM.js, and
# the release is rehashed again.
# October 3, 2026: No Receipt, No Accept is re-rendered from its approved Markdown (the
# 25 September rewrite) and its PDF is typeset with LaTeX with a build receipt; the release
# is rehashed.
# October 3, 2026: every paper and essay PDF and .tex carries the author's name, the license,
# the DOI and the first-public date, the seven systems papers' LaTeX is published, and the hub
# links each LaTeX source; the release is rehashed.
# October 3, 2026: retro.html loads retro-studio.js at a new stamp (the Retro front half moves to
# a worker), and studio.html loads studio.js at a new stamp; the release is rehashed.
# October 3, 2026: the explainers go live in the page. No Receipt, No Accept and the Flywheel page
# carry live, interactive explainers driven by the media engine from the same specs as their
# videos, with Learn recall checks; the two essay explainers are re-rendered and the Flywheel loop
# explainer is new. The release is rehashed.
# October 3, 2026: studio.html loads atelier.js as a module at a new stamp (the Atelier takes its
# seed rule from the vendored superstack contract); the release is rehashed.
# October 4, 2026: the author retires Kilon and Telos Display because viewers found them hard
# to read. system/system.css drops the unused Telos Display specimen block, and the font files
# and their build tool leave the site; the release is rehashed.
# October 3, 2026: system/system.css stops hiding the specimen plates on instrument surfaces;
# a reading-page rule had hidden all 43 Gallery plates, Plate 14 included. The release is rehashed.
# October 3, 2026: the Atelier draws through the media engine's "atelier" plugin, and studio.html
# loads atelier.js at a new stamp; the release is rehashed.
# October 4, 2026: the Studio shell (source switch, inspector header, action bar, shared undo)
# changes studio.html; the release is rehashed. Merging that change is the review.
# October 4, 2026: every page shares as its own link card from img/og/p, so the og and twitter
# image tags of the release pages changed; the release is rehashed. Merging that change is the review.
# October 4, 2026, later: studio.html loads the Studio at the keep slice's stamps; the release
# is rehashed.
# October 4, 2026, later: studio.html loads the Studio and the Atelier at the entry slice's
# stamps; the release is rehashed.
# October 4, 2026, later: studio.html restores Sketch's stroke Undo and loads the Studio at
# the restore stamp; the release is rehashed.
# October 4, 2026, later: the full Retro Engine joins the Studio; studio.html gains the Retro
# source's panel and loads the Studio at the retro-hub stamp, and retro.html loads
# retro-studio.js at that stamp. The release is rehashed.
# October 4, 2026, later: Bring your own and Watch with me start on an empty sheet; studio.html
# loads the Studio at the bring stamp over the retro-hub release. The release is rehashed.
# October 8, 2026: Who Kept the Books, series piece 3, ships with its listing and card; the
# series panels, series tables, hub, feeds, index, routes, site index and home bundle change
# with it (the release paths, listed and reviewed; the Writing hub now keeps the series opener first). The release is rehashed.
# October 8, 2026, later: The Maker Is Part of the Story, series piece 4, ships with its listing
# and cards; panels, series tables, hub, feeds, index, routes, site index and home bundle change
# with it (release paths listed and reviewed). The release is rehashed.
# October 8, 2026, later: A Check It Cannot Predict, series piece 5, ships with its listing and
# cards; panels, series tables, hub, feeds, index, routes, site index and home bundle change with
# it (release paths listed and reviewed). The release is rehashed.
# October 4, 2026, later: explainers.html (narrated films with sources and recall questions)
# joins the sitemap, the route registry and the site index, and the publication receipt records
# that sitemap. The release is rehashed.
# October 9, 2026: repo-explainers.html joins the sitemap, the route registry and the site index with
# its own page card, and flywheel.html links to the Flywheel repository explainer; the publication
# receipt records that sitemap. The release is rehashed.
# October 9, 2026, later: the site menu, the home page, Systems and the Studio link the explainer
# films and the repository explainers, sixteen product records link their explainer, and the home
# bundle is rebuilt from that registry (release paths listed and reviewed). The release is rehashed.
REVIEWED_RELEASE_SHA256 = "20223dea2ce895b82dcd7e9bd7b72eb1cd9d6157bdd4b435376d415933480419"


BRIEFING_FIGURES = (
    "claim-provenance-panel",
    "control-boundary-flow",
    "incident-multilane-timeline",
    "motive-sample-nonexclusive",
    "recovered-actions-by-day",
    "source-scope-matrix",
    "task-overrepresentation",
)

BRIEFING_EVIDENCE_FIGURES = tuple(
    path.stem
    for path in sorted((ROOT / "figures").glob("*.json"))
    if "figure" in json.loads(path.read_text(encoding="utf-8"))
)

PUBLIC_MARKERS = (
    re.compile(r"(?i)(?<![a-z0-9])[a-z]:[/\\]+(?:users|dev|program files)[/\\]+"),
    re.compile(r"(?i)file:///(?:[a-z]:[/\\]+|users/|home/)"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
)


def _text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _release_fingerprint() -> str:
    records = []
    for relative in sorted(RELEASE_PATHS):
        payload = (ROOT / relative).read_bytes()
        if Path(relative).suffix.lower() not in {".pdf", ".png"}:
            payload = payload.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        records.append(f"{relative}\t{hashlib.sha256(payload).hexdigest()}")
    return hashlib.sha256(("\n".join(records) + "\n").encode()).hexdigest()


def _local_target(href: str) -> tuple[Path, str]:
    parsed = urlsplit(href)
    relative = parsed.path.lstrip("/") or "index.html"
    if relative.endswith("/"):
        relative += "index.html"
    return ROOT / relative, parsed.fragment


def _route_registry() -> dict[str, object]:
    source = _text("system/routes.js")
    match = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', source)
    assert match, "generated route registry JSON is missing"
    return json.loads(json.loads(match.group(1)))


def test_release_fingerprint_is_stable_across_text_line_endings(
    tmp_path: Path, monkeypatch
) -> None:
    artifact = tmp_path / "artifact.html"
    monkeypatch.setattr(__import__(__name__), "ROOT", tmp_path)
    monkeypatch.setattr(__import__(__name__), "RELEASE_PATHS", ("artifact.html",))

    artifact.write_bytes(b"alpha\nbeta\n")
    lf_fingerprint = _release_fingerprint()
    artifact.write_bytes(b"alpha\r\nbeta\r\n")

    assert _release_fingerprint() == lf_fingerprint


def test_release_spine_matches_the_reviewed_artifact_fingerprint() -> None:
    missing = [path for path in RELEASE_PATHS if not (ROOT / path).is_file()]
    assert not missing, f"release files missing: {missing}"

    for directory in ("analytics", "briefings", "figures", "systems"):
        actual = {
            path.relative_to(ROOT).as_posix()
            for path in (ROOT / directory).rglob("*")
            if path.is_file()
        }
        expected = {path for path in RELEASE_PATHS if path.startswith(f"{directory}/")}
        assert actual == expected, f"{directory} release tree drifted"

    assert _release_fingerprint() == REVIEWED_RELEASE_SHA256


def test_font_marketplace_files_are_part_of_the_reviewed_release_spine() -> None:
    required = {
        "fonts.html",
        "requirements-font-preview.txt",
        "system/font-catalog.mjs",
        "system/font-marketplace.css",
        "system/font-specimen.js",
        "type/preview/editorial.json",
        "type/preview/mono.json",
        "type/preview/zain-editorial-regular.woff2",
        "type/preview/zain-mono-regular.woff2",
    }
    assert required <= set(RELEASE_PATHS)


def test_home_uses_only_the_reviewed_atomic_bundle_pair() -> None:
    source = _text("index.html")
    obsolete_js = "index-B_" + "tbCD5Q.js"
    obsolete_css = "index-D3" + "HRo6Wc.css"
    previous_js = "index-Dwp-qWEt.js"
    previous_css = "index-ktAZgEPv.css"
    retired_js = "index-B3zWbYkK.js"
    retired_css = "index-CiruV1jn.css"
    previous_task_js = "index-FyYdKcDU.js"
    previous_fix_js = "index-BCyg-ZCA.js"
    previous_fix_css = "index-Bh3pWSfE.css"
    previous_art_js = "index-BPBDYusx.js"
    previous_art_css = "index-D6A4RL1P.css"
    previous_publications_js = "index-DDkK7Yu0.js"
    previous_plain_language_js = "index-DFJMXR3Q.js"
    previous_pilot_js = "index-3Dl0qE22.js"
    previous_cross_harness_js = "index-TelJDAPv.js"
    previous_join_js = "index-BoU_gOMc.js"
    previous_board_js = "index-B-g9u1T0.js"
    previous_board_css = "index-B5xhdbWj.css"
    previous_index_discovery_js = "index-BU4-yae8.js"
    previous_forum_skill_js = "index-DiKzNTOp.js"
    previous_forum_skill_draft_js = "index-BU9Il18X.js"
    previous_forum_skill_copy_js = "index-B5ckJTHM.js"
    previous_050_js = "index-4XRtEPd6.js"
    previous_050_publication_js = "index-Cb1vbMcz.js"
    previous_060_draft_js = "index-koLbeX_t.js"
    previous_060_unbound_js = "index-DRgIqeCu.js"
    previous_060_source_bound_js = "index-CHEroeT4.js"
    previous_060_partial_release_js = "index-DWTh1LcV.js"
    previous_060_final_before_gather_js = "index-Bxkbws6Z.js"
    previous_060_final_gather_pre_review_js = "index-CYqKao4X.js"
    previous_060_final_gather_fixture_js = "index-CpC5RhmM.js"
    previous_gather_171_js = "index-AYA0gyN2.js"
    # September 26, 2026: the void-plates home (calm section ground, 14px labels, the
    # edition cover) is the current pair. The 25 September human-first pair
    # (index-TO_R52sc.js, index-DJj37yQz.css) replaced the capability-first pair;
    # both retired pairs stay in the release tree as retained history.
    # September 26, 2026, facts pass: the home bundle rebuilt from the refreshed
    # registry is index-D4UoCuIT.js; the void-plates bundle stays as retained history.
    # September 27, 2026: the bundle rebuilt for the 27 September releases and
    # advisories is index-DuXEIE3Q.js; index-D4UoCuIT.js stays as retained history.
    # The earlier 27 September builds, index-RXS41pPF.js and index-CUXkFuw-.js, were
    # never published and are gone.
    # September 27, 2026, copy pass: the home pair rebuilt from the registry after its
    # plain-words rewrite, with advisory IDs and package names kept whole, is
    # index-BzE0lc-H.js and index-DPe17JSn.css, with touching punctuation kept in
    # each marked token. index-DuXEIE3Q.js and index-BORSyU4q.css stay as retained
    # history. The intermediate builds index-Brb2IBwO.js and index-CGMskzEB.js were
    # never published and are gone.
    # September 27, 2026, copy pass, review fixes: the rebuilt bundle names the person
    # who runs the board in the live board note and marks coherence-membrane; it is
    # index-9egMTEOG.js with the same sheet, and index-BzE0lc-H.js, never published,
    # is gone.
    # October 1, 2026: Who Pays the Referees joins the Research routes, so the home
    # bundle rebuilt from the registry is index-B5IIN--D.js with the same sheet.
    # index-DMn8Bp7X.js stays as retained history.
    # October 1, 2026: Who Knew First's dated follow-up moves its route date to
    # 2026-10-01, so the bundle rebuilt from the registry is index-DkLmGDFh.js with the
    # same sheet. index-B5IIN--D.js stays as retained history.
    # October 1, 2026: The Number Has a Vintage joins the Research routes on the Who
    # Knew First follow-up base, so the bundle rebuilt from the registry is
    # index-D7LI6_j0.js with the same sheet. index-DkLmGDFh.js stays as retained
    # history; index-BLnRqjW-.js, built on the old base, was never published.
    # October 1, 2026: The Terms for Telling joins the Who Knew First routes, so the bundle
    # rebuilt from the registry is index-BIA-0d5A.js with the same sheet. index-Dmke1bnx.js
    # stays as retained history.
    # October 1, 2026: Zentropy Labs is retired and the home names Zain Dana Harper, so the
    # bundle rebuilt from the registry is index-CyztdbmV.js with the same sheet.
    # index-BIA-0d5A.js stays as retained history.
    # October 1, 2026: Work with me, the independence policy and the income ledger join the
    # Work routes, so the bundle rebuilt from the registry is index-BkvbD78Z.js with the same sheet.
    # index-CyztdbmV.js stays as retained history.
    # October 1, 2026: the typefaces are renamed Zain Editorial and Zain Mono, so the
    # bundle rebuilt from the registry is index-FBDE3rFM.js with the same sheet.
    # index-BkvbD78Z.js stays as retained history.
    # October 1, 2026: Why I Do This joins the Who Knew First routes as the series opener, so
    # the bundle rebuilt from the registry is index-B3PP6LeH.js with the same sheet.
    # index-FBDE3rFM.js stays as retained history.
    # October 1, 2026, before publication: the opener is retitled A Bullshitter Knows a
    # Bullshitter, so the bundle rebuilt from the registry is index-C1IxEots.js with the same
    # sheet. index-B3PP6LeH.js was never published and is gone.
    # October 2, 2026: the opener goes live with its publication date set to 2 October, so
    # the bundle rebuilt from the registry is index-DtNiguMs.js with the same sheet.
    # index-C1IxEots.js was never published and is gone.
    # October 2, 2026: the reference corrections move Who Knew First's publication date to
    # 25 September and date nine listings 2 October, so the bundle rebuilt from the registry
    # is index-DI6YWfTZ.js with the same sheet. index-DtNiguMs.js stays as retained history.
    # October 3, 2026: RAW's registry record now describes the C++23 reference renderer, so
    # the bundle rebuilt from the registry is index-DDpFxCuj.js with the same sheet.
    # index-DI6YWfTZ.js stays as retained history.
    # October 3, 2026: the Writing hub's research record counts twelve DOI records and lists
    # the four October editions in it, so the bundle rebuilt from the registry is
    # index-G7cmpE16.js with the same sheet. index-DDpFxCuj.js stays as retained history.
    # October 3, 2026: a Zenodo search by ORCID returned thirteen records, so the research
    # record adds the formal note on faithfulness and counts thirteen; the bundle rebuilt from
    # the registry is index-BniK76UM.js with the same sheet. index-G7cmpE16.js stays as history.
    # October 8, 2026: Who Kept the Books, series piece 3, joins the newest-writing strip, so
    # the bundle rebuilt from the registry is index-DXjCZzHu.js with the same sheet.
    # index-BniK76UM.js stays as retained history.
    # October 8, 2026, later: The Maker Is Part of the Story, series piece 4, joins the strip, so
    # the bundle rebuilt from the registry is index-BexgIZUT.js with the same sheet.
    # index-DXjCZzHu.js stays as retained history.
    # October 8, 2026, later: A Check It Cannot Predict, series piece 5, joins the strip, so the
    # bundle rebuilt from the registry is index-mtbFWZrz.js with the same sheet.
    # index-BexgIZUT.js stays as retained history.
    # October 9, 2026: the home links the explainer films and the repository explainers, and
    # sixteen registry records carry an explainer link, so the bundle rebuilt from the registry
    # is index-Dv8VLt1g.js with the same sheet. index-mtbFWZrz.js stays as retained history.
    current_js = "index-Dv8VLt1g.js"
    previous_five_js = "index-mtbFWZrz.js"
    assert previous_five_js not in source
    assert (ROOT / "assets" / previous_five_js).is_file()
    assert f"assets/{previous_five_js}" in RELEASE_PATHS
    previous_check_js = "index-BexgIZUT.js"
    assert previous_check_js not in source
    assert (ROOT / "assets" / previous_check_js).is_file()
    assert f"assets/{previous_check_js}" in RELEASE_PATHS
    previous_maker_js = "index-DXjCZzHu.js"
    assert previous_maker_js not in source
    assert (ROOT / "assets" / previous_maker_js).is_file()
    assert f"assets/{previous_maker_js}" in RELEASE_PATHS
    previous_wkb_js = "index-BniK76UM.js"
    assert previous_wkb_js not in source
    assert (ROOT / "assets" / previous_wkb_js).is_file()
    assert f"assets/{previous_wkb_js}" in RELEASE_PATHS
    previous_count_js = "index-G7cmpE16.js"
    assert previous_count_js not in source
    assert (ROOT / "assets" / previous_count_js).is_file()
    assert f"assets/{previous_count_js}" in RELEASE_PATHS
    previous_record_js = "index-DDpFxCuj.js"
    assert previous_record_js not in source
    assert (ROOT / "assets" / previous_record_js).is_file()
    assert f"assets/{previous_record_js}" in RELEASE_PATHS
    previous_raw_js = "index-DI6YWfTZ.js"
    assert previous_raw_js not in source
    assert (ROOT / "assets" / previous_raw_js).is_file()
    assert f"assets/{previous_raw_js}" in RELEASE_PATHS
    previous_opener_js = "index-DtNiguMs.js"
    assert previous_opener_js not in source
    assert (ROOT / "assets" / previous_opener_js).is_file()
    assert f"assets/{previous_opener_js}" in RELEASE_PATHS
    assert not (ROOT / "assets" / "index-B3PP6LeH.js").exists()
    assert not (ROOT / "assets" / "index-C1IxEots.js").exists()
    previous_fonts_js = "index-FBDE3rFM.js"
    assert previous_fonts_js not in source
    assert (ROOT / "assets" / previous_fonts_js).is_file()
    assert f"assets/{previous_fonts_js}" in RELEASE_PATHS
    previous_work_js = "index-BkvbD78Z.js"
    assert previous_work_js not in source
    assert (ROOT / "assets" / previous_work_js).is_file()
    assert f"assets/{previous_work_js}" in RELEASE_PATHS
    previous_name_js = "index-CyztdbmV.js"
    assert previous_name_js not in source
    assert (ROOT / "assets" / previous_name_js).is_file()
    assert f"assets/{previous_name_js}" in RELEASE_PATHS
    previous_terms_js = "index-BIA-0d5A.js"
    assert previous_terms_js not in source
    assert (ROOT / "assets" / previous_terms_js).is_file()
    assert f"assets/{previous_terms_js}" in RELEASE_PATHS
    previous_writing_hub_js = "index-Dmke1bnx.js"
    assert previous_writing_hub_js not in source
    assert (ROOT / "assets" / previous_writing_hub_js).is_file()
    assert f"assets/{previous_writing_hub_js}" in RELEASE_PATHS
    previous_vintage_js = "index-D7LI6_j0.js"
    assert previous_vintage_js not in source
    assert (ROOT / "assets" / previous_vintage_js).is_file()
    assert f"assets/{previous_vintage_js}" in RELEASE_PATHS
    # The bundles built during this change, index-DO0BUWdN.js and index-LG6YNxx3.js, were never published.
    assert not (ROOT / "assets" / "index-DO0BUWdN.js").exists()
    assert not (ROOT / "assets" / "index-LG6YNxx3.js").exists()
    previous_followup_js = "index-DkLmGDFh.js"
    assert previous_followup_js not in source
    assert (ROOT / "assets" / previous_followup_js).is_file()
    assert f"assets/{previous_followup_js}" in RELEASE_PATHS
    previous_referees_js = "index-B5IIN--D.js"
    assert previous_referees_js not in source
    assert (ROOT / "assets" / previous_referees_js).is_file()
    assert f"assets/{previous_referees_js}" in RELEASE_PATHS
    previous_atlas_js = "index-DMn8Bp7X.js"
    assert previous_atlas_js not in source
    assert (ROOT / "assets" / previous_atlas_js).is_file()
    assert f"assets/{previous_atlas_js}" in RELEASE_PATHS
    for unpublished_js in (
        "index-RXS41pPF.js", "index-CUXkFuw-.js", "index-Brb2IBwO.js", "index-CGMskzEB.js",
        "index-BzE0lc-H.js", "index-BLnRqjW-.js",
    ):
        assert not (ROOT / "assets" / unpublished_js).exists()
        assert f"assets/{unpublished_js}" not in RELEASE_PATHS
    previous_advisories_css = "index-BORSyU4q.css"
    assert previous_advisories_css not in source
    assert (ROOT / "assets" / previous_advisories_css).is_file()
    assert f"assets/{previous_advisories_css}" in RELEASE_PATHS
    previous_advisories_js = "index-DuXEIE3Q.js"
    assert previous_advisories_js not in source
    assert (ROOT / "assets" / previous_advisories_js).is_file()
    assert f"assets/{previous_advisories_js}" in RELEASE_PATHS
    previous_facts_js = "index-D4UoCuIT.js"
    assert previous_facts_js not in source
    assert (ROOT / "assets" / previous_facts_js).is_file()
    assert f"assets/{previous_facts_js}" in RELEASE_PATHS
    previous_void_plates_js = "index-DYDJA8vR.js"
    assert previous_void_plates_js not in source
    assert (ROOT / "assets" / previous_void_plates_js).is_file()
    current_css = "index-DbZyfUEO.css"
    previous_copy_pass_css = "index-DPe17JSn.css"
    assert previous_copy_pass_css not in source
    assert (ROOT / "assets" / previous_copy_pass_css).is_file()
    previous_human_first_pair = ("index-TO_R52sc.js", "index-DJj37yQz.css")
    previous_capability_first_pair = ("index-JJHLIJUt.js", "index-eZ1QGP52.css")
    previous_capability_first_home_js = "index-4wTyKocM.js"
    prior_mission_js = "index-DpT1GQuA.js"
    prior_mission_css = "index-B2kgPYlE.css"
    previous_home_js = "index-CS_jYuhh.js"
    previous_flywheel_js = "index-BIYnDBdw.js"
    previous_flywheel_css = "index-DGQrcJ5p.css"
    previous_security_js = "index-BnUu1wyw.js"
    prior_reviewed_js = "index-C_1S2nb6.js"
    prior_reviewed_css = "index-XLAt4tDw.css"
    assert f'src="/assets/{current_js}"' in source
    assert f'href="/assets/{current_css}"' in source
    assert (ROOT / "assets" / current_js).is_file()
    assert (ROOT / "assets" / current_css).is_file()
    assert previous_home_js not in source
    for superseded in previous_capability_first_pair + previous_human_first_pair:
        assert superseded not in source
        assert (ROOT / "assets" / superseded).is_file()
        assert f"assets/{superseded}" in RELEASE_PATHS
    # The prior v1.0.1 rollup home bundle is superseded by the capability-first
    # refresh. It stays in the reviewed release tree as a historical artifact but
    # is no longer referenced by index.html.
    assert previous_capability_first_home_js not in source
    assert (ROOT / "assets" / previous_capability_first_home_js).is_file()
    assert f"assets/{previous_capability_first_home_js}" in RELEASE_PATHS
    assert f"assets/{current_js}" in RELEASE_PATHS
    assert f"assets/{current_css}" in RELEASE_PATHS
    assert prior_mission_js not in source
    assert prior_mission_css not in source
    assert "index-CPG6kzKK.js" not in source
    assert "index-ClATdIWg.js" not in source
    assert previous_gather_171_js not in source
    assert not (ROOT / "assets" / previous_gather_171_js).exists()
    assert previous_060_draft_js not in source
    assert not (ROOT / "assets" / previous_060_draft_js).exists()
    assert previous_060_unbound_js not in source
    assert not (ROOT / "assets" / previous_060_unbound_js).exists()
    assert previous_060_source_bound_js not in source
    assert not (ROOT / "assets" / previous_060_source_bound_js).exists()
    assert previous_060_partial_release_js not in source
    assert not (ROOT / "assets" / previous_060_partial_release_js).exists()
    assert previous_060_final_before_gather_js not in source
    assert not (ROOT / "assets" / previous_060_final_before_gather_js).exists()
    assert previous_060_final_gather_pre_review_js not in source
    assert not (ROOT / "assets" / previous_060_final_gather_pre_review_js).exists()
    assert previous_060_final_gather_fixture_js not in source
    assert not (ROOT / "assets" / previous_060_final_gather_fixture_js).exists()
    assert previous_050_publication_js not in source
    assert not (ROOT / "assets" / previous_050_publication_js).exists()
    assert previous_050_js not in source
    assert not (ROOT / "assets" / previous_050_js).exists()
    assert previous_board_js not in source
    assert previous_board_css not in source
    assert not (ROOT / "assets" / previous_board_js).exists()
    assert not (ROOT / "assets" / previous_board_css).exists()
    assert previous_index_discovery_js not in source
    assert not (ROOT / "assets" / previous_index_discovery_js).exists()
    assert previous_forum_skill_js not in source
    assert not (ROOT / "assets" / previous_forum_skill_js).exists()
    assert previous_forum_skill_draft_js not in source
    assert not (ROOT / "assets" / previous_forum_skill_draft_js).exists()
    assert previous_forum_skill_copy_js not in source
    assert not (ROOT / "assets" / previous_forum_skill_copy_js).exists()
    assert previous_flywheel_js not in source
    assert previous_flywheel_css not in source
    assert not (ROOT / "assets" / previous_flywheel_js).exists()
    assert not (ROOT / "assets" / previous_flywheel_css).exists()
    assert previous_pilot_js not in source
    assert not (ROOT / "assets" / previous_pilot_js).exists()
    assert previous_cross_harness_js not in source
    assert not (ROOT / "assets" / previous_cross_harness_js).exists()
    assert previous_join_js not in source
    assert not (ROOT / "assets" / previous_join_js).exists()
    assert previous_security_js not in source
    assert not (ROOT / "assets" / previous_security_js).exists()
    assert prior_reviewed_js not in source
    assert prior_reviewed_css not in source
    assert not (ROOT / "assets" / prior_reviewed_js).exists()
    assert not (ROOT / "assets" / prior_reviewed_css).exists()
    assert obsolete_js not in source
    assert obsolete_css not in source
    assert not (ROOT / "assets" / obsolete_js).exists()
    assert not (ROOT / "assets" / obsolete_css).exists()
    assert previous_js not in source
    assert previous_css not in source
    assert not (ROOT / "assets" / previous_js).exists()
    assert not (ROOT / "assets" / previous_css).exists()
    assert retired_js not in source
    assert retired_css not in source
    assert not (ROOT / "assets" / retired_js).exists()
    assert not (ROOT / "assets" / retired_css).exists()
    assert previous_task_js not in source
    assert not (ROOT / "assets" / previous_task_js).exists()
    assert previous_publications_js not in source
    assert not (ROOT / "assets" / previous_publications_js).exists()
    assert previous_plain_language_js not in source
    assert not (ROOT / "assets" / previous_plain_language_js).exists()
    assert previous_fix_js not in source
    assert previous_fix_css not in source
    assert not (ROOT / "assets" / previous_fix_js).exists()
    assert not (ROOT / "assets" / previous_fix_css).exists()
    assert previous_art_js not in source
    assert previous_art_css not in source
    assert not (ROOT / "assets" / previous_art_js).exists()
    assert not (ROOT / "assets" / previous_art_css).exists()


def test_six_briefing_figures_keep_semantic_nonvisual_fallbacks() -> None:
    for stem in BRIEFING_FIGURES:
        source = _text(f"figures/{stem}.html")
        assert '<figure class="evidence-figure"' in source, stem
        assert "<figcaption" in source, stem
        table = re.search(
            r'<table\b[^>]*class="[^"]*\bfigure-table\b[^"]*"[^>]*>(.*?)</table>',
            source,
            re.DOTALL,
        )
        assert table, stem
        assert "data-figure-row" in table.group(1), stem
        assert '<svg role="img"' in source, stem
        assert "aria-labelledby=" in source, stem
        assert re.search(r'data-figure-kind="(?:relationship|timeline|matrix|bar)"', source), stem


def test_recovered_actions_bar_fits_the_desktop_viewport() -> None:
    source = _text("figures/recovered-actions-by-day.html")
    styles = _text("system/figure.css")
    assert 'class="figure-svg-scroll figure-svg-scroll--fit"' in source
    assert re.search(
        r"\.figure-svg-scroll--fit\s+svg\s*\{[^}]*min-width:\s*0",
        styles,
        re.DOTALL,
    )


def test_every_evidence_plate_has_readable_labels_and_explicit_scope() -> None:
    required = {
        "title",
        "claim",
        "doesNotProve",
        "retrievedAt",
        "units",
        "transformations",
        "uncertainty",
        "sources",
    }
    for stem in BRIEFING_EVIDENCE_FIGURES:
        companion = json.loads(_text(f"figures/{stem}.json"))["figure"]
        assert required <= set(companion), stem
        assert companion["sources"], stem
        assert companion["transformations"], stem

        html = _text(f"figures/{stem}.html")
        svg = _text(f"figures/{stem}.svg")
        ElementTree.fromstring(svg)
        assert re.search(r'class="[^"]*\bfigure-finding\b', html), stem
        assert re.search(r'class="[^"]*\bfigure-scope\b', html), stem
        assert re.search(r'class="[^"]*\bfigure-limitations\b', html), stem
        assert svg in html, f"{stem}: inline and standalone SVG drifted"

        root = ElementTree.fromstring(svg)
        view_box = [float(value) for value in root.attrib["viewBox"].split()]
        intrinsic_width = float(root.attrib.get("width", view_box[2]))
        display_scale = intrinsic_width / view_box[2]
        label_sizes = [float(value) for value in re.findall(r'font-size="([0-9.]+)"', svg)]
        effective_labels = [value * display_scale for value in label_sizes]
        assert effective_labels and min(effective_labels) >= 16, (
            stem,
            min(effective_labels, default=None),
        )

        point_groups = re.findall(
            r'<g\b[^>]*data-figure-point="true"[^>]*>(.*?)</g>',
            svg,
            re.DOTALL,
        )
        assert point_groups, stem
        for group in point_groups:
            marks = re.findall(
                r'<(?:rect|path|line|circle)\b(?=[^>]*stroke="(?!transparent)[^"]+")[^>]*>',
                group,
            )
            effective_strokes = []
            for mark in marks:
                width = re.search(r'stroke-width="([0-9.]+)"', mark)
                effective_strokes.append(float(width.group(1)) * display_scale if width else display_scale)
            assert effective_strokes and max(effective_strokes) >= 2, stem


def test_incident_briefing_uses_readable_embedded_evidence_plates() -> None:
    page = _text("briefings/2026-08-26-openai-hugging-face-incident/index.html")
    styles = _text("system/system.css")
    assert 'class="inner-clean frame-compact briefing-document"' in page
    assert len(re.findall(r"<iframe\b", page)) == 7
    assert ".briefing-document iframe" in styles
    assert re.search(r"inline-size:\s*100%", styles)
    assert re.search(r"min-block-size:\s*", styles)


def test_briefing_archive_and_feeds_resolve_to_the_permanent_record() -> None:
    route = "/briefings/2026-08-26-openai-hugging-face-incident/"
    archive = _text("briefings/index.html")
    assert f'href="{route}"' in archive
    assert 'href="/feed.json"' in archive
    assert 'href="/feed.xml"' in archive

    feed = json.loads(_text("feed.json"))
    assert feed["home_page_url"].endswith("/publications.html")
    routes = [urlsplit(item["url"]).path for item in feed["items"]]
    assert routes.count(route) == 1
    assert "/the-second-hearing.html" in routes
    assert "/availability-is-not-reach.html" in routes
    assert "/what-the-label-changes.html" in routes
    page = _text("briefings/2026-08-26-openai-hugging-face-incident/index.html")
    updated = re.search(r'<time datetime="(\d{4}-\d{2}-\d{2})">Updated ', page)
    assert updated
    expected_updated = f"{updated.group(1)}T00:00:00Z"
    briefing_item = next(item for item in feed["items"] if urlsplit(item["url"]).path == route)
    assert briefing_item["date_modified"] == expected_updated

    atom = ElementTree.fromstring(_text("feed.xml"))
    namespace = {"atom": "http://www.w3.org/2005/Atom"}
    entries = atom.findall("atom:entry", namespaces=namespace)
    briefing_entry = next(
        entry
        for entry in entries
        if entry.findtext("atom:id", namespaces=namespace).endswith(route)
    )
    assert atom.findtext("atom:updated", namespaces=namespace) == max(
        item["date_modified"] for item in feed["items"]
    )
    assert briefing_entry.findtext("atom:updated", namespaces=namespace) == expected_updated
    target, fragment = _local_target(route)
    assert target.is_file() and not fragment


def test_incident_build_receipt_matches_every_generated_output() -> None:
    build = json.loads(
        _text("briefings/2026-08-26-openai-hugging-face-incident/build.json")
    )
    assert build["settings"]["lineEnding"] == "LF"

    drifted = []
    for output in build["outputs"]:
        payload = (ROOT / output["path"]).read_bytes()
        payload = payload.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        actual = hashlib.sha256(payload).hexdigest()
        if actual != output["sha256"]:
            drifted.append(output["path"])

    assert not drifted, f"incident build outputs drifted: {drifted}"


def test_every_generated_capability_and_hiring_route_resolves() -> None:
    registry = _route_registry()
    routes = [route for family in registry["families"] for route in family["routes"]]
    hrefs = {route["href"] for route in routes}
    assert {
        "hire.html#engineering-path",
        "hire.html#technical-operations-path",
        "hire.html#public-service-field-path",
        "catalog.html",
        "systems/behavior-transform.html",
        "systems/mneme.html",
        "systems/plexus.html",
        "systems/relay.html",
        "systems/studio-engine.html",
    } <= hrefs

    for href in sorted(hrefs):
        target, fragment = _local_target(href)
        assert target.is_file(), f"route target missing: {href}"
        if fragment:
            source = target.read_text(encoding="utf-8")
            assert re.search(rf'\bid=["\']{re.escape(fragment)}["\']', source), href

    systems = json.loads(_text("system/systems.json"))["systems"]
    assert systems, "capability registry is empty"
    for system in systems:
        target, fragment = _local_target(system["href"])
        assert target.is_file(), f"capability target missing: {system['id']} -> {system['href']}"
        if fragment:
            assert re.search(
                rf'\bid=["\']{re.escape(fragment)}["\']',
                target.read_text(encoding="utf-8"),
            ), system["id"]


def test_release_spine_contains_no_owner_local_paths_or_secret_markers() -> None:
    findings = []
    for relative in RELEASE_PATHS:
        source = (ROOT / relative).read_bytes().decode("utf-8", errors="ignore")
        normalized = re.sub(r"\\{2,}", r"\\", source)
        if any(pattern.search(candidate) for pattern in PUBLIC_MARKERS for candidate in (source, normalized)):
            findings.append(relative)
    assert not findings, f"public boundary markers found in: {findings}"
