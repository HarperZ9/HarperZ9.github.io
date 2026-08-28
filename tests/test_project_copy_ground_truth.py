import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NON_DEPLOYABLE_HTML_DIRS = {"node_modules", "dist", ".worktrees", "_preview", "_drafts", "_redesign"}


def deployable_html_pages() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("*.html")
        if not any(part in NON_DEPLOYABLE_HTML_DIRS for part in path.relative_to(ROOT).parts)
    ]


def _registry_record(system_id: str) -> dict:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    return next(record for record in registry["systems"] if record["id"] == system_id)


def test_truth_enb_copy_names_the_actual_skyrim_graphics_project() -> None:
    record = _registry_record("truth-enb")
    purpose = record["purpose"]
    page = (ROOT / "truth-enb.html").read_text(encoding="utf-8")

    assert "Skyrim SE/AE" in purpose
    assert "ENBSeries 0.504" in purpose
    for capability in ("atmosphere", "cloud", "aurora", "exposure", "tone"):
        assert capability in purpose.lower()
        assert capability in page.lower()

    assert record["architectureRole"] == "enb-shader-suite"
    assert record["dependencies"] == ["enb-runtime-core"]
    assert "Flywheel" not in page

    invented = "public ENB graphics configuration surface for reviewable visual-runtime workflows"
    assert invented.lower() not in purpose.lower()
    assert invented.lower() not in page.lower()


def test_public_copy_does_not_replace_security_capability_with_generic_boundary_prose() -> None:
    public_copy = "\n".join(
        path.read_text(encoding="utf-8", errors="replace")
        for path in (ROOT / "home" / "src" / "App.tsx", ROOT / "security.html", ROOT / "private-practice.html")
    )
    assert "Authorized security, kept bounded" not in public_copy
    assert "The public surface contains sanitized tests, schemas, detectors" not in public_copy


def test_private_security_projects_keep_their_distinct_verified_roles() -> None:
    practice = (ROOT / "private-practice.html").read_text(encoding="utf-8")
    security = (ROOT / "security.html").read_text(encoding="utf-8")
    homepage = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")

    defining_copy = {
        "Array": ("offensive-security campaigns", "digest-sealed waves", "time-limited approval"),
        "Seed": ("59-module C++23", "3,065 tests", "security-assessment engine"),
        "Sofer": ("private-line orchestration", "specialist agents", "high-consequence technical domains"),
        "Isomorph": ("AI red-team harness", "refusal behavior", "jailbreak-class"),
        "Bounds": ("intent drift", "runtime observations", "proof chains"),
        "ORCA": ("native operator runtime", "engagement state", "portable bundles"),
        "Gate": ("integration and release authority", "SBOM", "fail-closed release decision"),
    }
    for project, phrases in defining_copy.items():
        assert f'id="{project.lower()}"' in practice
        for phrase in phrases:
            assert phrase in practice

    for project in defining_copy:
        assert project in security

    assert "controlled offensive campaigns" in homepage
    assert "model refusal and jailbreak testing" in homepage


def test_private_security_projects_are_distinct_registry_records() -> None:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    records = {record["id"]: record for record in registry["systems"]}
    expected = {
        "array": "authorized offensive campaign orchestrator",
        "seed": "native security-assessment engine",
        "sofer": "private-line orchestration suite",
        "isomorph": "AI inference-boundary red-team harness",
        "bounds": "agent, runtime, and release trust verifier",
        "orca": "native assessment operator runtime",
        "gate": "private-system integration and release authority",
    }
    expected_hrefs = {
        "array": "array.html",
        "seed": "seed.html",
        "sofer": "sofer.html",
        "isomorph": "isomorph.html",
        "bounds": "bounds.html",
        "orca": "private-practice.html#orca",
        "gate": "private-practice.html#gate",
    }

    assert "authorized-private-practice" not in records
    for system_id, product_type in expected.items():
        record = records[system_id]
        assert record["productType"] == product_type
        assert record["maturity"] == "controlled-private"
        assert record["sourceHref"] is None
        assert record["href"] == expected_hrefs[system_id]
        assert record["inputs"]
        assert record["outputs"]
        assert record["evidence"]
        assert record["limitations"]
        assert record["related"]

    security_registry = json.loads((ROOT / "security-tools.json").read_text(encoding="utf-8"))
    security_records = {record["slug"] for record in security_registry["records"]}
    assert set(expected) <= security_records
    assert "authorized-private-practice" not in security_records


def test_every_system_has_one_canonical_placement_and_specific_product_type() -> None:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    domain_ids = {domain["id"] for domain in registry["domains"]}

    for record in registry["systems"]:
        assert record["primaryDomain"] in domain_ids, record["id"]
        assert record["primaryDomain"] in record["domains"], record["id"]
        assert record["productType"].strip(), record["id"]
        assert record["releaseState"].strip(), record["id"]


def test_registry_uses_project_specific_inputs_outputs_and_roles() -> None:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    forbidden_templates = {
        "operator-defined constraints",
        "reviewable verification record",
    }
    generic_roles = {"engine", "adapter", "plugin", "evaluation-layer"}

    for record in registry["systems"]:
        assert forbidden_templates.isdisjoint(record["inputs"]), record["id"]
        assert forbidden_templates.isdisjoint(record["outputs"]), record["id"]
        assert record["architectureRole"] not in generic_roles, record["id"]


def test_registry_relationships_are_typed_and_evidence_backed() -> None:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    records = {record["id"]: record for record in registry["systems"]}
    evidence_ids = {evidence["id"] for record in records.values() for evidence in record["evidence"]}

    assert registry["schema"] == "harperz9-systems/v4"
    assert registry["relationshipPolicy"]["relatedUsage"] == "navigation-only"
    assert registry["relationshipPolicy"]["integrationClaims"] == "relations-only"

    keys = set()
    for relation in registry["relations"]:
        assert relation["source"] in records
        assert relation["target"] in records
        assert relation["relation"] != "hierarchy"
        assert relation["status"] in {"verified-in-source", "candidate", "historical"}
        assert relation["evidenceIds"]
        assert set(relation["evidenceIds"]) <= evidence_ids
        assert relation["claimScope"].strip()
        key = (relation["source"], relation["target"], relation["relation"])
        assert key not in keys
        keys.add(key)

    assert ("flywheel", "gather", "integrates-lane") in keys
    assert ("truth-enb", "enb-runtime-core", "build-dependency") in keys
    assert ("chorus", "gather", "accepts-corpus-from") in keys
    assert not any(source == "flywheel" and target == "chorus" for source, target, _ in keys)


def test_catalog_renders_each_system_once_under_its_primary_domain() -> None:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    catalog = (ROOT / "catalog.html").read_text(encoding="utf-8")

    for record in registry["systems"]:
        link = f'<a href="{record["href"]}">{record["name"]}</a>'
        assert catalog.count(link) == 1, record["id"]

        domain_section = re.search(
            rf'<section[^>]+id="domain-{re.escape(record["primaryDomain"])}".*?</section>',
            catalog,
            re.DOTALL,
        )
        assert domain_section, record["id"]
        assert link in domain_section.group(0), record["id"]


def test_current_independent_systems_are_not_missing_from_registry() -> None:
    registry = json.loads((ROOT / "system" / "systems.json").read_text(encoding="utf-8"))
    records = {record["id"]: record for record in registry["systems"]}

    assert records["chorus"]["productType"] == "discourse synthesis system"
    assert records["raw"]["productType"] == "Skyrim D3D11 rendering platform"
    assert records["chorus"]["architectureRole"] != "flywheel-component"
    assert records["raw"]["architectureRole"] != "flywheel-component"


def test_public_copy_has_no_false_universal_flywheel_hierarchy() -> None:
    pages = [
        ROOT / "retro.html",
        ROOT / "engine-revival.html",
        ROOT / "brender-archival.html",
        ROOT / "security.html",
        ROOT / "home" / "src" / "App.tsx",
    ]
    public_copy = "\n".join(path.read_text(encoding="utf-8") for path in pages)
    forbidden = (
        "Flywheel remains the primary platform above the cluster",
        "Flywheel is the single primary platform",
        "These security systems attach beneath it",
        "the retro lane is part of the Flywheel ecosystem",
    )
    for phrase in forbidden:
        assert phrase not in public_copy

    figure = json.loads(
        (ROOT / "figures" / "graphics-retro-capability-map.json").read_text(encoding="utf-8")
    )
    false_edges = {
        ("flywheel", "truth-enb"),
        ("flywheel", "retro-engine"),
        ("flywheel", "engine-revival"),
        ("flywheel", "brender-archival"),
    }
    actual_edges = {(edge["source"], edge["target"]) for edge in figure["figure"]["data"]["edges"]}
    assert false_edges.isdisjoint(actual_edges)


def test_product_pages_do_not_use_biological_metaphors_or_fabricated_commands() -> None:
    for page_name in ("gather.html", "crucible.html", "learn.html"):
        page = (ROOT / page_name).read_text(encoding="utf-8")
        assert " organ" not in page.lower(), page_name
        assert "peer organ" not in page.lower(), page_name

    learn = (ROOT / "learn.html").read_text(encoding="utf-8")
    assert "learn course init" not in learn
    assert "learn course run" not in learn


def test_generated_provenance_comments_name_real_generators() -> None:
    for page in deployable_html_pages():
        text = page.read_text(encoding="utf-8", errors="replace")
        for generator in re.findall(r"Generated by ([^\s]+)", text):
            assert (ROOT / generator).is_file(), f"{page.name}: {generator}"
