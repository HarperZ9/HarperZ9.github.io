"""Public contracts for A Bullshitter Knows a Bullshitter (route why-i-do-this.html), the author's own account that opens the Who Knew First series."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_listings import load_listing

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "why-i-do-this.html"
TITLE = "A Bullshitter Knows a Bullshitter"
OLD_TITLE = "Why I Do This"


def source() -> str:
    return PAGE.read_text(encoding="utf-8")


def visible_text(value: str) -> str:
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", value, flags=re.I | re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def essay_text() -> str:
    page = source()
    return visible_text(re.search(r'<div class="wid-voice">(.*?)</div>', page, re.S).group(1))


def test_listing_validates_and_joins_the_hubs_the_series_and_the_feeds() -> None:
    listing, _stored = load_listing(ROOT / "publications/data/listings/why-i-do-this.json", ROOT)
    assert listing["route"] == "why-i-do-this.html"
    assert listing["form"] == "personal essay"
    for hub in ("publications.html", "who-knew-first-series.html", "who-knew-first.html",
                "who-pays-the-referees.html", "the-terms-for-telling.html"):
        assert 'href="why-i-do-this.html"' in (ROOT / hub).read_text(encoding="utf-8"), hub
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    assert "https://harperz9.github.io/why-i-do-this.html" in [item["url"] for item in feed["items"]]
    assert "<loc>https://harperz9.github.io/why-i-do-this.html</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert (ROOT / "img/og/why-i-do-this.png").is_file()


def test_the_title_is_the_authors_choice_everywhere_it_is_shown() -> None:
    """The author retitled the piece on 1 October 2026; the slug stays why-i-do-this.html."""
    page = source()
    assert re.search(r"<h1>(.*?)</h1>", page, re.S).group(1) == TITLE
    assert f"<title>{TITLE} · Zain Dana Harper</title>" in page
    for prop in ('property="og:title"', 'name="twitter:title"'):
        assert f'{prop} content="{TITLE}"' in page, prop
    assert f'content="{TITLE}: ' in page  # og:image:alt
    assert f'aria-current="page">{TITLE}</a>' in page  # docnav
    listing, _stored = load_listing(ROOT / "publications/data/listings/why-i-do-this.json", ROOT)
    assert listing["title"] == TITLE
    series = json.loads((ROOT / "publications/data/series/who-knew-first.json").read_text(encoding="utf-8"))
    assert series["opener"]["text"] == TITLE and series["opener"]["href"] == "why-i-do-this.html"
    cards = (ROOT / "img/og/cards-data.js").read_text(encoding="utf-8")
    assert f'"headline": "{TITLE}"' in cards
    for route in ("why-i-do-this.html", "publications.html", "who-knew-first-series.html", "who-knew-first.html",
                  "who-pays-the-referees.html", "the-terms-for-telling.html", "site-index.html", "feed.json",
                  "feed.xml", "publications/data/index.json", "system/routes.js", "home/src/site-routes.ts"):
        body = (ROOT / route).read_text(encoding="utf-8")
        assert OLD_TITLE not in body, route
        assert TITLE in body, route
    # No list of title alternatives is left on the page.
    assert "alternative" not in visible_text(page).casefold()


def test_the_series_hub_and_the_writing_hub_name_it_as_the_opener() -> None:
    hub = (ROOT / "who-knew-first-series.html").read_text(encoding="utf-8")
    opener = re.search(r'<p class="series-opener">(.*?)</p>', hub, re.S).group(1)
    assert "Start here:" in opener and 'href="why-i-do-this.html"' in opener
    assert hub.index('class="series-opener"') < hub.index("</header>")
    writing = (ROOT / "publications.html").read_text(encoding="utf-8")
    series = writing.split('id="series" data-publication-section', 1)[1].split("</section>", 1)[0]
    first = re.search(r"<article\b.*?</article>", series, re.S).group(0)
    assert "Series opener" in first and 'href="why-i-do-this.html"' in first


def test_it_is_first_person_and_keeps_the_consented_wording() -> None:
    text = essay_text()
    assert len(re.findall(r"\bI\b", text)) > 80
    assert "From early on, my curiosity was focused on inference, interpretability, social engineering, " \
           "manipulation, language and escalation techniques." in text
    assert "whether any of it was authorized is not what matters here" in text
    for item in ("I am going to have a son in November", "I left on poor terms", "I have ADHD",
                 "I have been a bullshitter my whole life", "My words and my actions do not align"):
        assert item in text, item
    # The author kept these as written (1 October 2026).
    assert "I still push a boundary now and then and work on my purple-team tools, but my main focus is "            "honesty, verification, re-derivability and independence." in text
    assert "open or closed, in any nation" in text
    # The author's own words replace passages the drafting model composed (1 October 2026).
    assert "I was building tools that existed to break AI, using AI to do so." in text
    # The author's spoken answer on purple teaming, redemption and the alder (1 October 2026).
    for item in ("our own human forest floor", "I never completed college"):
        assert item in text, item
    # The author's words of 16 September 2026 on the red alder, on truth and on stewards (1 October 2026).
    for item in ("red alder", "our bones settle in the earth",
                 "We as humans are stewards, and it is time we come back to acting within our role."):
        assert item in text, item
    for composed in ("In June I published a page", "Read the work and check it"):
        assert composed not in text, composed


def test_the_alder_comes_before_the_son() -> None:
    text = essay_text()
    alder = text.index("In arboriculture I learned what the red alder does.")
    son = text.index("I am going to have a son in November.")
    assert alder < son


def test_public_surface_rules_hold() -> None:
    page = source()
    text = visible_text(page)
    assert "unauthorized" not in text.casefold()
    assert "—" not in page and "–" not in page
    assert re.search(r"(?<![A-Za-z0-9+.-])[A-Za-z]:[\\/]", re.sub(r"https?://\S+", "", text)) is None
    for internal in ("transcript", "TRACE", "pre-check", "Draft manuscript"):
        assert internal not in text, internal
    # Family members are named by relation only.
    assert "my father" in text.casefold() or "My father" in text


def test_sources_and_the_ai_note_come_after_the_essay() -> None:
    page = source()
    body_end = page.index('<div class="wpr-series-continue">')
    assert page.index('id="how-made"') > body_end and page.index('id="sources"') > body_end
    essay = re.search(r'<div class="wid-voice">(.*?)</div>', page, re.S).group(1)
    assert len(re.findall(r"<a\b", essay)) <= 1  # at most one inline link; the June page is cited under Sources
    how = visible_text(re.search(r'<section id="how-made".*?</section>', page, re.S).group(0))
    assert "Claude Opus 5.5, a model built by Anthropic" in how
    assert "voice memo on 1 October 2026" in how
    sources = re.search(r'<section id="sources".*?</section>', page, re.S).group(0)
    for href in ("who-knew-first.html", "who-knew-first-series.html", "why.html", "flywheel.html", "articulate.html"):
        assert f'href="{href}"' in sources, href


def test_publication_date_is_the_day_the_opener_went_live() -> None:
    # The opener went live on 2 October 2026 (Pacific); the voice memo it draws on is from 1 October.
    listing, _stored = load_listing(ROOT / "publications/data/listings/why-i-do-this.json", ROOT)
    assert listing["published_at"] == "2026-10-02"
    page = source()
    assert '<meta property="article:published_time" content="2026-10-02">' in page
    assert '<span class="sep">/</span>October 2, 2026<span class="sep">/</span>' in page
    assert 'Published <time datetime="2026-10-02">2 October 2026</time> <span class="sc-here">' in page
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    item = next(entry for entry in feed["items"] if entry["url"].endswith("/why-i-do-this.html"))
    assert item["date_published"].startswith("2026-10-02")
