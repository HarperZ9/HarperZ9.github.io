import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "system" / "systems.json"
HOME_SOURCE = ROOT / "home" / "src" / "App.tsx"
NO_SCRIPT_HOME = ROOT / "home" / "index.html"


def test_javascript_home_derives_security_platforms_from_registry_domain() -> None:
    source = HOME_SOURCE.read_text(encoding="utf-8")

    assert (
        'systems.filter((system) => system.domains.includes("security-privacy"))'
        in source
    )
    assert "SECURITY_IDS" not in source


def test_no_javascript_home_lists_every_security_domain_record() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    security = [
        system
        for system in registry["systems"]
        if "security-privacy" in system["domains"]
    ]
    source = NO_SCRIPT_HOME.read_text(encoding="utf-8")
    section = re.search(
        r'<section aria-labelledby="noscript-security">(?P<body>.*?)</section>',
        source,
        re.DOTALL,
    )

    assert section is not None
    body = section.group("body")
    assert len(security) == 18
    for system in security:
        assert f'>{system["name"]}</a>' in body, system["id"]
        assert f'href="/{system["href"]}"' in body, system["id"]
