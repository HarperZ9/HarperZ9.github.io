"""The three guides: one set of words on every page, small media, captions, and no autoplay sound."""

import hashlib
import json
import re
from pathlib import Path

from tools.guides import data, page

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media" / "guides"
HOME = (ROOT / "home" / "src" / "Guides.tsx").read_text(encoding="utf-8")
PAGES = {p: (ROOT / p).read_text(encoding="utf-8") for p in ("guides.html", "explainers.html", "publications.html", "index.html", "studio.html")}


def _without_card_tags(text: str) -> str:
    # tools/guides/page.py writes the page, then site_cards stamps the link-card tags into its head
    # and tools/structured_data.py adds the generated JSON-LD block.
    text = re.sub(r"\n?<!-- structured-data:begin[^>]*-->.*?<!-- structured-data:end -->", "", text, flags=re.S)
    return re.sub(r'<meta (?:property="og:image[^"]*"|name="twitter:[^"]*")[^>]*>\s*', "", text)


def test_guides_page_is_the_generators_output() -> None:
    assert _without_card_tags(PAGES["guides.html"]) == _without_card_tags(page.page())
    assert 'img/og/p/guides.jpg' in PAGES["guides.html"]


def test_home_uses_the_same_words() -> None:
    for g in data.GUIDES:
        for key in ("name", "title", "style", "role", "habit", "alt"):
            assert g[key] in HOME, f"home is missing {g['id']}.{key}"
        for f in data.live_films(g):
            assert data.FILM_TITLES[f].replace("'", "'") in HOME.replace("&apos;", "'")
    assert data.VOICE in HOME


def test_every_film_and_the_release_films_have_one_host() -> None:
    films = ["checking-cost", "passing-check", "rederive", "incentives", "visible-reasoning", "release-media"]
    assert sorted(f for g in data.GUIDES for f in data.live_films(g)) == sorted(films)
    hosts = re.findall(r'<aside class="gd-host"', PAGES["explainers.html"])
    assert len(hosts) == len(films)
    for f in films:
        g = data.by_film(f)
        section = PAGES["explainers.html"].split(f'id="{f}"', 1)[1].split("</h2>", 1)[1][:600]
        assert f'guides.html#{g["id"]}' in section, f"{f} is not hosted by {g['name']}"


def test_draft_films_have_a_host_a_title_and_a_draft_scene() -> None:
    for f in data.DRAFTS:
        film = json.loads((ROOT / "media" / "explainers" / f / "film.json").read_text(encoding="utf-8"))
        assert film["draft"] is True and data.FILM_TITLES[f] == film["title"]
        assert data.by_film(f)["id"] == film["host"]["guide"]
        assert f'id="{f}"' not in PAGES["explainers.html"], f"{f} is a draft and must not be on a live page yet"


def test_guides_reach_home_writing_and_studio() -> None:
    # 18 October 2026, the author: the explainer videos must not take over the site. The guides'
    # section left the home page; the films live in Night School and on their lesson pages.
    assert "<Guides />" not in (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert 'href="/night-school.html"' in (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "/system/guides.css" in PAGES["index.html"]
    assert 'guides.html#tallow' in PAGES["publications.html"]
    assert 'href="guides.html"' in PAGES["studio.html"]
    assert "https://harperz9.github.io/guides.html" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")


def test_media_match_the_manifest_and_stay_small() -> None:
    m = json.loads((MEDIA / "guides.json").read_text(encoding="utf-8"))
    assert set(m["guides"]) == {g["id"] for g in data.GUIDES}
    for gid, rec in m["guides"].items():
        for name, digest in rec["files"].items():
            assert hashlib.sha256((MEDIA / gid / name).read_bytes()).hexdigest() == digest, f"{gid}/{name} changed without the manifest"
        assert rec["bytes"] < 3_000_000, f"{gid}: {rec['bytes']} bytes"
        for loop in ("idle.mp4", "action.mp4"):
            assert (MEDIA / gid / loop).stat().st_size < 200_000, f"{gid}/{loop} is too large for a loop"
        # An introduction carries a sound track only when one was given on purpose (build_media --intro),
        # and only for a voice take the author approved (data.INTRO_VOICES).
        assert (b"soun" in (MEDIA / gid / "intro.mp4").read_bytes()) == rec["intro_audio"], f"{gid}/intro.mp4 sound track"
        assert rec["intro_audio"] == (gid in data.INTRO_VOICES), f"{gid}: sound without an approved voice, or an approved voice left out"
        assert rec.get("intro_voice") == data.INTRO_VOICES.get(gid), f"{gid}: intro voice take"
        for still in ("still.jpg", "close.jpg"):
            assert (MEDIA / gid / still).stat().st_size < 160_000


def test_intro_captions_cover_every_spoken_sentence() -> None:
    for g in data.GUIDES:
        timing = json.loads((MEDIA / g["id"] / "intro.timing.json").read_text(encoding="utf-8"))
        vtt = (MEDIA / g["id"] / "intro.vtt").read_text(encoding="utf-8")
        words = " ".join(line for line in vtt.splitlines()[2:] if line and "-->" not in line)
        assert words.split() == " ".join(r["text"] for r in timing).split()


def test_intro_lengths_on_the_buttons_match_the_clips() -> None:
    for g in data.GUIDES:
        timing = json.loads((MEDIA / g["id"] / "intro.timing.json").read_text(encoding="utf-8"))
        # The clip ends 0.35 s after the last word (raw-native tools/guides/render_clips.py, TAIL).
        assert g["intro_s"] == round(timing[-1]["end"] + 0.35), g["id"]
        assert f'Hear {g["name"]} ({g["intro_s"]} s, sound and captions)' in page.page()
        assert f'intro: {g["intro_s"]},' in HOME, f"home intro length for {g['id']}"


def test_nothing_plays_sound_on_its_own() -> None:
    js = (ROOT / "system" / "guides.mjs").read_text(encoding="utf-8")
    for body in (PAGES["guides.html"], HOME):
        assert "autoplay" not in body.lower()
    # Loops are made muted in code; the only unmuted media is the introduction, started by a press.
    assert js.count("muted: true") == 2 and "reduced.matches" in js
    assert "ended" not in js, "nothing should start the next thing when a video ends"


def test_words_are_clean() -> None:
    for text in (PAGES["guides.html"], HOME, (ROOT / "tools" / "guides" / "data.py").read_text(encoding="utf-8")):
        assert "—" not in text
        assert not re.search(r"[A-Z]:[\\/]", text)
