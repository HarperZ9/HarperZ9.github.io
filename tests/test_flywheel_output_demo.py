"""Contracts for the Flywheel output-check demonstration section."""

from __future__ import annotations

import re
import unittest
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
MEDIA_DIR = Path("media/flywheel-output-check-20260905")
EXPECTED_VIDEO = MEDIA_DIR / "short.mp4"
EXPECTED_POSTER = MEDIA_DIR / "poster.png"
EXPECTED_CAPTIONS = MEDIA_DIR / "captions.vtt"
PAID_PILOT_MAILTO = "mailto:zaindharper@gmail.com?subject=Flywheel%20paid%20pilot"


@dataclass
class Node:
    tag: str
    attrs: dict[str, str | None] = field(default_factory=dict)
    parent: Node | None = None
    children: list[Node] = field(default_factory=list)
    chunks: list[str] = field(default_factory=list)
    content: list[str | Node] = field(default_factory=list)

    def text(self) -> str:
        parts = [
            item.text() if isinstance(item, Node) else item
            for item in self.content
        ]
        return " ".join(part for part in parts if part)

    def descendants(self, tag: str | None = None) -> list[Node]:
        matches: list[Node] = []
        for child in self.children:
            if tag is None or child.tag == tag:
                matches.append(child)
            matches.extend(child.descendants(tag))
        return matches

    def first_by_id(self, node_id: str) -> Node | None:
        for node in self.descendants():
            if node.attrs.get("id") == node_id:
                return node
        return None

    def has_ancestor(self, tag: str) -> bool:
        current = self.parent
        while current is not None:
            if current.tag == tag:
                return True
            current = current.parent
        return False


class DocumentParser(HTMLParser):
    VOID_TAGS = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), dict(attrs), self.stack[-1])
        self.stack[-1].children.append(node)
        self.stack[-1].content.append(node)
        if node.tag not in self.VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        node = Node(tag.lower(), dict(attrs), self.stack[-1])
        self.stack[-1].children.append(node)
        self.stack[-1].content.append(node)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        while len(self.stack) > 1:
            node = self.stack.pop()
            if node.tag == tag:
                break

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self.stack[-1].chunks.append(text)
            self.stack[-1].content.append(text)


def parse_page(relative: str) -> Node:
    parser = DocumentParser()
    parser.feed((ROOT / relative).read_text(encoding="utf-8"))
    return parser.root


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def local_path(value: str | None) -> Path | None:
    if not value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith(("#", "mailto:")):
        return None
    return Path(parsed.path.lstrip("/"))


class FlywheelOutputDemoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.flywheel = parse_page("flywheel.html")

    def require_demo_section(self) -> Node:
        demo = self.flywheel.first_by_id("demo")
        self.assertIsNotNone(demo, "flywheel.html must expose a #demo section")
        assert demo is not None
        self.assertEqual(demo.tag, "section")
        return demo

    def test_hero_links_to_demo_and_demo_offers_paid_pilot_contact(self) -> None:
        primary_routes = [
            node
            for node in self.flywheel.descendants("nav")
            if node.attrs.get("aria-label") == "Primary routes"
        ]
        self.assertEqual(len(primary_routes), 1, "expected one primary route nav")
        self.assertIn(
            "#demo",
            [link.attrs.get("href") for link in primary_routes[0].descendants("a")],
        )

        demo = self.require_demo_section()
        demo_hrefs = [link.attrs.get("href") for link in demo.descendants("a")]
        self.assertIn(PAID_PILOT_MAILTO, demo_hrefs)
        self.assertIn("hire.html", demo_hrefs)

    def test_demo_uses_native_video_with_no_eager_or_repeating_playback(self) -> None:
        demo = self.require_demo_section()
        self.assertTrue(demo.descendants("h2"), "demo section must have an h2 heading")

        video = self.flywheel.first_by_id("fw-output-demo")
        self.assertIsNotNone(video, "demo must include native video #fw-output-demo")
        assert video is not None
        self.assertEqual(video.tag, "video")
        self.assertTrue(video.has_ancestor("section"))
        self.assertIn("controls", video.attrs)
        self.assertEqual(video.attrs.get("preload"), "none")
        self.assertNotIn("autoplay", video.attrs)
        self.assertNotIn("loop", video.attrs)
        self.assertEqual(local_path(video.attrs.get("poster")), EXPECTED_POSTER)

        sources = [local_path(source.attrs.get("src")) for source in video.descendants("source")]
        self.assertIn(EXPECTED_VIDEO, sources)

    def test_demo_caption_track_is_local_default_english_vtt(self) -> None:
        video = self.flywheel.first_by_id("fw-output-demo")
        self.assertIsNotNone(video, "demo must include native video #fw-output-demo")
        assert video is not None
        tracks = video.descendants("track")
        caption_tracks = [
            track
            for track in tracks
            if track.attrs.get("kind") == "captions"
            and track.attrs.get("srclang") == "en"
        ]
        self.assertEqual(len(caption_tracks), 1, "expected one English captions track")

        track = caption_tracks[0]
        self.assertEqual(track.attrs.get("label"), "English")
        self.assertIn("default", track.attrs)
        self.assertEqual(local_path(track.attrs.get("src")), EXPECTED_CAPTIONS)

    def test_demo_media_files_are_checked_in_and_nonempty(self) -> None:
        for relative in (EXPECTED_VIDEO, EXPECTED_POSTER, EXPECTED_CAPTIONS):
            path = ROOT / relative
            self.assertTrue(path.is_file(), f"missing demo media artifact: {relative}")
            self.assertGreater(path.stat().st_size, 0, f"empty demo media artifact: {relative}")

        self.assertIn(b"ftyp", (ROOT / EXPECTED_VIDEO).read_bytes()[:64])
        self.assertTrue((ROOT / EXPECTED_POSTER).read_bytes().startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(
            (ROOT / EXPECTED_CAPTIONS).read_text(encoding="utf-8").startswith("WEBVTT")
        )

    def test_visible_transcript_lists_case_outcomes_and_limits_scope(self) -> None:
        demo = self.require_demo_section()
        demo_text = norm(demo.text()).lower()
        for phrase in (
            "synthetic inputs",
            "one structured field",
            "not a screen recording",
            "what this does not prove",
            "not a software release or general correctness",
            "no model or real ci run was used",
            "does not establish source trust",
        ):
            self.assertIn(phrase, demo_text)

        transcript = self.flywheel.first_by_id("demo-transcript")
        self.assertIsNotNone(transcript, "demo must include visible #demo-transcript")
        assert transcript is not None
        self.assertFalse(transcript.has_ancestor("details"))
        self.assertNotIn("hidden", transcript.attrs)
        self.assertNotIn("display:none", norm(transcript.attrs.get("style") or "").lower())

        result_lists = [
            node
            for node in transcript.descendants("dl")
            if "demo-results" in (node.attrs.get("class") or "").split()
        ]
        self.assertEqual(len(result_lists), 1, "transcript must expose one result list")

        expected = (
            (
                "42 claimed; 41 in the record",
                ("FAIL", "HOLD", "disagrees", "0 of 1 fields confirmed"),
            ),
            (
                "41 claimed, with its source",
                ("PASS", "RELEASE", "matches", "1 of 1 fields confirmed"),
            ),
            (
                "41 claimed, without a citation",
                ("UNVERIFIABLE", "HOLD", "source is not named", "0 of 1 fields confirmed"),
            ),
        )
        terms = [
            node
            for node in result_lists[0].children
            if node.tag in {"dt", "dd"} and norm(node.text())
        ]
        for case_label, required_tokens in expected:
            term_index = next(
                (
                    index
                    for index, node in enumerate(terms)
                    if node.tag == "dt" and case_label == norm(node.text())
                ),
                None,
            )
            self.assertIsNotNone(term_index, f"missing transcript case {case_label}")
            assert term_index is not None
            body: list[str] = []
            for node in terms[term_index + 1 :]:
                if node.tag == "dt":
                    break
                body.append(norm(node.text()))
            case_text = " ".join(body)
            for token in required_tokens:
                self.assertIn(token, case_text, f"{case_label} missing {token}")


if __name__ == "__main__":
    unittest.main()
