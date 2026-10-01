"""Source snapshots for the plugin support pages.

Each flagship plugin's privacy policy, README, manifest and license are copied
from the tool's own repository at a pinned commit into plugins/data/<slug>/.
The pages are rendered only from those snapshots, so every sentence on a
support, privacy or terms page traces back to a file in the tool's repository.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "plugins" / "data"
SPEC = DATA / "plugins.json"
LOCK = DATA / "sources.lock.json"
RAW = "https://raw.githubusercontent.com/{repo}/{ref}/{path}"
SNAPSHOT_NAMES = {
    "privacy": "PRIVACY.md",
    "readme": "README.md",
    "manifest": "manifest.json",
    "license": "LICENSE",
    "security": "SECURITY.md",
}


def normalized(data: bytes) -> bytes:
    """Hash input with LF line endings so a CRLF checkout keeps the same digest."""
    return data.replace(b"\r\n", b"\n")


def digest(data: bytes) -> str:
    return hashlib.sha256(normalized(data)).hexdigest()


def load_spec() -> dict:
    return json.loads(SPEC.read_text(encoding="utf-8"))


def snapshot_path(slug: str, kind: str) -> Path:
    return DATA / slug / SNAPSHOT_NAMES[kind]


def refresh() -> dict:
    """Download every source file at its pinned commit and write the lock file."""
    lock: dict[str, dict[str, dict[str, str]]] = {}
    for tool in load_spec()["tools"]:
        entries = {}
        for kind, path in tool["sources"].items():
            url = RAW.format(repo=tool["repo"], ref=tool["ref"], path=path)
            request = urllib.request.Request(url, headers={"User-Agent": "harperz9-site-builder"})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = normalized(response.read())
            target = snapshot_path(tool["slug"], kind)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            entries[kind] = {"path": path, "sha256": digest(data)}
        lock[tool["slug"]] = entries
    LOCK.write_text(json.dumps(lock, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return lock


def verify_lock() -> list[str]:
    """Return a problem line for each snapshot that drifted from the lock."""
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    problems = []
    for tool in load_spec()["tools"]:
        for kind in tool["sources"]:
            recorded = lock.get(tool["slug"], {}).get(kind, {}).get("sha256")
            actual = digest(snapshot_path(tool["slug"], kind).read_bytes())
            if recorded != actual:
                problems.append(f"{tool['slug']}/{kind}: lock {recorded} != file {actual}")
    return problems


@dataclass(frozen=True)
class ToolSource:
    slug: str
    label: str
    repo: str
    ref: str
    ref_name: str
    sources: dict
    license_quote: dict
    privacy: str
    readme: str
    manifest: dict
    license: str
    has_security: bool

    def file_url(self, kind: str) -> str:
        return f"https://github.com/{self.repo}/blob/{self.ref}/{self.sources[kind]}"

    @property
    def repo_url(self) -> str:
        return f"https://github.com/{self.repo}"


def _read(slug: str, kind: str) -> str:
    return snapshot_path(slug, kind).read_text(encoding="utf-8").replace("\r\n", "\n")


def load_tools() -> list[ToolSource]:
    tools = []
    for tool in load_spec()["tools"]:
        slug = tool["slug"]
        tools.append(ToolSource(
            slug=slug,
            label=tool["label"],
            repo=tool["repo"],
            ref=tool["ref"],
            ref_name=tool["ref_name"],
            sources=tool["sources"],
            license_quote=tool["license_quote"],
            privacy=_read(slug, "privacy"),
            readme=_read(slug, "readme"),
            manifest=json.loads(_read(slug, "manifest")),
            license=_read(slug, "license"),
            has_security="security" in tool["sources"],
        ))
    return tools


def product_readme(readme: str) -> str:
    """Drop a packaging preamble: start at the first level-one heading."""
    match = re.search(r"^# .+$", readme, flags=re.M)
    return readme[match.start():] if match else readme


def lead_paragraph(readme: str) -> str:
    body = product_readme(readme).split("\n", 1)[1]
    for block in re.split(r"\n\s*\n", body.strip()):
        if not block.lstrip().startswith(("#", "-", "|", "```")):
            return " ".join(line.strip() for line in block.splitlines())
    raise ValueError("README has no lead paragraph")


def try_it(readme: str) -> list[str]:
    match = re.search(r"^## Try it\n(.*?)(?=^## |\Z)", product_readme(readme), flags=re.M | re.S)
    if not match:
        raise ValueError("README has no Try it section")
    items: list[str] = []
    for line in match.group(1).splitlines():
        if line.startswith("- "):
            items.append(line[2:].strip())
        elif line.startswith("  ") and items:
            items[-1] += " " + line.strip()
    return items


REQUIREMENT = re.compile(
    r"requires (?:an installed )?((?:Python|Node\.js) [0-9.]+(?:\+| or (?:later|newer)))")


def runtime_requirement(readme: str) -> str:
    match = REQUIREMENT.search(" ".join(readme.split()))
    if not match:
        raise ValueError("README states no runtime requirement")
    return match.group(1)


def sentences_matching(text: str, pattern: str) -> list[str]:
    flat = " ".join(line.strip() for line in text.splitlines() if not line.startswith("#"))
    parts = re.split(r"(?<=[.])\s+(?=[A-Z*])", flat)
    return [p.replace("**", "").strip() for p in parts if re.search(pattern, p)]
