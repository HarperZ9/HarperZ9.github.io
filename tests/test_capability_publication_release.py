"""Selective-release contract for the reviewed capability/publication spine."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

from tools.release_reviews import load_pins, path_digest, verify


ROOT = Path(__file__).resolve().parents[1]

# The release spine is the set of paths with a pin under tests/release-pins/; each pin names the
# review in tests/release-reviews/ that covers its bytes. See tools/release_reviews.py.
RELEASE_PATHS = tuple(load_pins(ROOT))


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


def test_release_digest_is_stable_across_text_line_endings(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact.html"
    artifact.write_bytes(b"alpha\nbeta\n")
    lf_digest = path_digest(tmp_path, "artifact.html")
    artifact.write_bytes(b"alpha\r\nbeta\r\n")

    assert path_digest(tmp_path, "artifact.html") == lf_digest


def test_release_spine_matches_the_reviewed_artifact_bytes() -> None:
    assert len(RELEASE_PATHS) >= 387, "release pins are missing"
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

    problems = verify(ROOT)
    assert not problems, (
        "release bytes are not reviewed; record the change with "
        "python -m tools.release_reviews record <YYYY-MM-DD-slug> --note ... --stale\n"
        + "\n".join(problems)
    )


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
    # October 12, 2026: the home leads with the three guides who host the films (Guides.tsx) and
    # guides.html joins the registry, so the bundle is index-C3mo4X0I.js with the sheet
    # index-Se2ioCLN.css. index-Dv8VLt1g.js and index-DbZyfUEO.css stay as retained history.
    # October 12, 2026, later: the "Your call" answer is reworded after the live check, so the bundle
    # is index-jmVIw9rV.js with the same sheet. index-C3mo4X0I.js stays as retained history.
    # October 12, 2026, evening: the introductions carry the guides' own voices, approved by the
    # author after listening, so the intro buttons and the voice note change and the bundle is
    # index-DwjtCOsP.js with the same sheet. index-jmVIw9rV.js stays as retained history.
    # October 15, 2026: Night School and its first lesson join the route registry, so the bundle
    # rebuilt from it is index-amx6uI37.js with the same sheet. index-DwjtCOsP.js stays as
    # retained history.
    # October 16, 2026: the fourteen lesson pages beside the pilot join the route registry
    # (and #454's registry change, already on main, reaches the bundle), so the bundle rebuilt
    # from it is index-DWytnneE.js with the same sheet. index-amx6uI37.js stays as retained
    # history.
    # October 16, 2026, later: lessons S17 and S19 join the route registry, so the bundle rebuilt
    # from it is index-CoD1AHwR.js with the same sheet. index-DWytnneE.js stays as retained history.
    # October 16, 2026, later still: lessons E23 and E24 join the route registry, so the bundle
    # rebuilt from it is index-B4VAhGeJ.js with the same sheet. index-CoD1AHwR.js stays as retained history.
    # 2026-10-16-night-school-evaluate-threads: the route registry gains lessons, so the bundle rebuilt from it is index-Bm2nPm2b.js with the
    # same sheet. index-B4VAhGeJ.js stays as retained history.
    # 2026-10-16-night-school-quant-tiling: the route registry gains lessons, so the bundle rebuilt from it is index-bJe3vRuh.js with the
    # same sheet. index-Bm2nPm2b.js stays as retained history.
    # 2026-10-16-night-school-fused-precision: the route registry gains lessons, so the bundle rebuilt from it is index-BxvqK2zV.js with the
    # same sheet. index-bJe3vRuh.js stays as retained history.
    # 2026-10-16-night-school-denoiser-receipts: the route registry gains lessons, so the bundle rebuilt from it is index-1pL-pv-D.js with the
    # same sheet. index-BxvqK2zV.js stays as retained history.
    current_js = "index-1pL-pv-D.js"
    previous_night_school_denoiser_receipts_js = "index-BxvqK2zV.js"
    assert previous_night_school_denoiser_receipts_js not in source
    assert (ROOT / "assets" / previous_night_school_denoiser_receipts_js).is_file()
    assert f"assets/{previous_night_school_denoiser_receipts_js}" in RELEASE_PATHS
    previous_night_school_fused_precision_js = "index-bJe3vRuh.js"
    assert previous_night_school_fused_precision_js not in source
    assert (ROOT / "assets" / previous_night_school_fused_precision_js).is_file()
    assert f"assets/{previous_night_school_fused_precision_js}" in RELEASE_PATHS
    previous_night_school_quant_tiling_js = "index-Bm2nPm2b.js"
    assert previous_night_school_quant_tiling_js not in source
    assert (ROOT / "assets" / previous_night_school_quant_tiling_js).is_file()
    assert f"assets/{previous_night_school_quant_tiling_js}" in RELEASE_PATHS
    previous_night_school_evaluate_threads_js = "index-B4VAhGeJ.js"
    assert previous_night_school_evaluate_threads_js not in source
    assert (ROOT / "assets" / previous_night_school_evaluate_threads_js).is_file()
    assert f"assets/{previous_night_school_evaluate_threads_js}" in RELEASE_PATHS
    previous_pair8_js = "index-CoD1AHwR.js"
    assert previous_pair8_js not in source
    assert (ROOT / "assets" / previous_pair8_js).is_file()
    assert f"assets/{previous_pair8_js}" in RELEASE_PATHS
    previous_lessons_js = "index-DWytnneE.js"
    assert previous_lessons_js not in source
    assert (ROOT / "assets" / previous_lessons_js).is_file()
    assert f"assets/{previous_lessons_js}" in RELEASE_PATHS
    previous_school_js = "index-amx6uI37.js"
    assert previous_school_js not in source
    assert (ROOT / "assets" / previous_school_js).is_file()
    assert f"assets/{previous_school_js}" in RELEASE_PATHS
    assert "index-DwjtCOsP.js" not in source
    assert (ROOT / "assets" / "index-DwjtCOsP.js").is_file()
    previous_voice_js = "index-jmVIw9rV.js"
    assert previous_voice_js not in source
    assert (ROOT / "assets" / previous_voice_js).is_file()
    assert f"assets/{previous_voice_js}" in RELEASE_PATHS
    previous_guides_js = "index-C3mo4X0I.js"
    assert previous_guides_js not in source
    assert (ROOT / "assets" / previous_guides_js).is_file()
    assert f"assets/{previous_guides_js}" in RELEASE_PATHS
    previous_guides_pair = ("index-Dv8VLt1g.js", "index-DbZyfUEO.css")
    for superseded in previous_guides_pair:
        assert superseded not in source
        assert (ROOT / "assets" / superseded).is_file()
        assert f"assets/{superseded}" in RELEASE_PATHS
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
    current_css = "index-Se2ioCLN.css"
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
