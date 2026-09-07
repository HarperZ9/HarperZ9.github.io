"""Focused contracts for generated product/catalog presentation."""

from __future__ import annotations

import json
import re
from html import unescape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYSTEMS = ROOT / "system" / "systems.json"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def registry() -> dict[str, object]:
    return json.loads(SYSTEMS.read_text(encoding="utf-8"))


def section(source: str, section_id: str) -> str:
    match = re.search(
        rf'<section\b[^>]*\bid="{re.escape(section_id)}"[^>]*>.*?</section>',
        source,
        re.DOTALL,
    )
    assert match, section_id
    return match.group(0)


def article_with_href(source: str, href: str) -> str:
    for article in re.findall(r"<article\b[^>]*>.*?</article>", source, re.DOTALL):
        title = re.search(
            r'<h3 class="product-card-title"><a href="([^"]+)"[^>]*>',
            article,
        )
        if title and unescape(title.group(1)) == href:
            return article
    raise AssertionError(href)


def definition_list(source: str, class_name: str) -> str:
    match = re.search(
        rf'<dl class="{re.escape(class_name)}">.*?</dl>',
        source,
        re.DOTALL,
    )
    assert match, class_name
    return match.group(0)


def grouped_definition_pairs(source: str, class_name: str) -> list[tuple[str, str]]:
    return [
        (unescape(term), unescape(value))
        for term, value in re.findall(
            rf'<div class="{re.escape(class_name)}"><dt>(.*?)</dt><dd>(.*?)</dd></div>',
            source,
            re.DOTALL,
        )
    ]


def system_by_id(system_id: str) -> dict[str, object]:
    for system in registry()["systems"]:
        if system["id"] == system_id:
            return system
    raise AssertionError(system_id)


def domain_label(domain_id: str) -> str:
    for domain in registry()["domains"]:
        if domain["id"] == domain_id:
            return domain["label"]
    raise AssertionError(domain_id)


def test_overview_product_cards_lead_with_purpose_action_and_status() -> None:
    page = read("overview.html")
    flywheel = system_by_id("flywheel")
    row = article_with_href(page, flywheel["href"])

    assert 'class="product-card"' in row
    assert f'<p class="product-purpose">{flywheel["purpose"]}</p>' in row
    assert '<a class="product-action" href="flywheel.html">Open product record</a>' in row
    assert f'<dt>Status</dt><dd>{flywheel["maturity"]}</dd>' in row
    assert f'<dt>Release</dt><dd>{flywheel["releaseState"]}</dd>' in row
    assert row.index('class="product-purpose"') < row.index('class="product-card-actions"')
    assert row.index('class="product-purpose"') < row.index('class="product-status"')


def test_product_card_status_pairs_stay_grouped_for_responsive_layout() -> None:
    page = read("overview.html")
    flywheel = system_by_id("flywheel")
    row = article_with_href(page, flywheel["href"])
    status = definition_list(row, "product-status")

    assert grouped_definition_pairs(status, "product-status-fact") == [
        ("Status", flywheel["maturity"]),
        ("Release", flywheel["releaseState"]),
    ]
    assert '<dl class="product-status"><dt>' not in status


def test_catalog_preserves_cross_domain_breadth_without_repeating_secondary_noise() -> None:
    page = read("catalog.html")
    flywheel = system_by_id("flywheel")
    primary = section(page, "domain-agent-systems")
    secondary = section(page, "domain-developer-infrastructure")
    primary_row = article_with_href(primary, flywheel["href"])
    secondary_row = article_with_href(secondary, flywheel["href"])

    assert "Secondary domain reference." not in page
    assert f'<p class="product-purpose">{flywheel["purpose"]}</p>' in primary_row
    assert "Flywheel v0.4.1" in primary_row
    assert 'class="catalog-evidence"' in primary_row
    assert '<details class="product-record-details">' in secondary_row
    assert "<summary>Why this record appears here</summary>" in secondary_row
    assert f"Primary area: {domain_label(flywheel['primaryDomain'])}." in secondary_row
    assert f"Also appears here because it serves {domain_label('developer-infrastructure')}." in secondary_row


def test_record_pages_keep_limits_visible_and_relationships_optional() -> None:
    page = read("accountable-surface.html")

    assert '<dl class="system-facts">' in page
    assert '<dt>Status</dt><dd>active</dd>' in page
    assert '<dt>Access</dt><dd>inspect</dd>' in page
    assert '<dt>Release</dt><dd>active source 0.1.0; no release</dd>' in page
    assert '<section class="mv" id="architecture-and-relationships"' in page
    assert '<details class="product-record-details" id="architecture-details">' in page
    assert "<summary>Architecture, dependencies, and relationship notes</summary>" in page
    assert "Flywheel declares Accountable Surface as an actuation lane" in page
    assert '<a href="/accountable-machines.html">Accountable Machines</a>' in page
    assert "<strong>Authorization boundary.</strong>" in page


def test_record_fact_pairs_stay_grouped_for_responsive_layout() -> None:
    page = read("accountable-surface.html")
    accountable_surface = system_by_id("accountable-surface")
    facts = definition_list(page, "system-facts")

    assert grouped_definition_pairs(facts, "system-fact") == [
        ("Status", accountable_surface["maturity"]),
        ("Access", accountable_surface["accessMode"]),
        ("Release", accountable_surface["releaseState"]),
        ("Checked", accountable_surface["lastVerified"]),
    ]
    assert '<dl class="system-facts"><dt>' not in facts
