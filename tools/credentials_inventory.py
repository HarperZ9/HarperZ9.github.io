"""Write career/credentials.json: every credential in the career source, with its public verification result.

The list comes from career/resume-source.json (the credentials the live career pages show).
Each entry was checked on 2026-11-02 against the issuer's public verification page only:
no account was signed in to and no email was read. Results:

  verified        the issuer's public page names Zain Dana Harper and the credential
  link dead       the listed URL answers 404 for a signed-out reader
  no public record  the listed URL is a course or program description, not a personal record

Microsoft Learn and Claude Academy pages render in the browser, so they were read in a browser;
Credly was read through its public Open Badges API; Coursera, Linux Foundation and the course
pages were read over HTTP. `--recheck` repeats the HTTP-checkable ones.

    python tools/credentials_inventory.py [--recheck]
"""
from __future__ import annotations

import argparse
import json
import pathlib
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "career" / "resume-source.json"
OUT = ROOT / "career" / "credentials.json"
CHECKED = "2026-11-02"
UA = {"User-Agent": "Mozilla/5.0 (harperz9 credential check)"}

BROWSER = "issuer public page read in a browser, signed out"
CREDLY = "Credly public Open Badges assertion (api.credly.com/v1/obi/v2/badge_assertions)"
HTTP = "issuer public page read over HTTP, signed out"

# id -> (result, method, note). Ids not listed fall to their provider rule below.
RESULTS = {
    "ms-ai-security": ("verified", BROWSER, "Credential ID page: issued September 29, 2026; status Active"),
    "ms-entra": ("verified", BROWSER, "Credential ID page: issued September 29, 2026; status Active"),
    "ms-storage": ("verified", BROWSER, "Credential ID page: issued September 29, 2026; status Active"),
    "ms-devops-security": ("verified", BROWSER, "Credential ID page: issued September 30, 2026; status Active"),
    "sc100-apps-data": ("verified", BROWSER, "Public Learn profile shows the trophy, completed 9/30/2026, all module assessments passed"),
    "sc100-mcra-mcsb": ("verified", BROWSER, "Public Learn profile shows the module badge, completed 9/30/2026"),
    "anthropic-mcp-advanced": ("verified", BROWSER, "Verification page: presented to Zain Dana Harper, issued September 30, 2026"),
    "claude-code-in-action": ("verified", BROWSER, "Verification page: presented to Zain Dana Harper, issued September 30, 2026"),
    "building-claude-api": ("verified", BROWSER, "Verification page: presented to Zain Dana Harper, issued September 30, 2026"),
    "claude-amazon-bedrock": ("verified", BROWSER, "Verification page: presented to Zain Dana Harper, issued September 30, 2026"),
    "cisco-ethical-hacker": ("verified", CREDLY, "Assertion issued 2026-09-30; the public badge page names the earner"),
    "google-bigquery-predictive": ("verified", CREDLY, "Assertion issued 2026-10-01; the public badge page names the earner"),
    "google-bigquery-ml-models": ("verified", CREDLY, "Assertion issued 2026-10-01; the public badge page names the earner"),
    "unesco-ai-ethics": ("verified", HTTP, "Coursera verification page names the learner and the course"),
}
PROVIDER_RULE = {
    "Linux Foundation": ("link dead", HTTP, "The listed training-portal URL answers 404 signed out; no public certificate page was found"),
    "Qualys": ("no public record", HTTP, "The listed URL is the Qualys course page; no public verification page was found"),
    "BlueDot Impact": ("no public record", HTTP, "The listed URL is the course page"),
}
GOOGLE_COURSE = ("no public record", HTTP, "The listed URL is the Google Skills course page; no public profile link is on record")
VERIFY_URL = {
    "sc100-apps-data": "https://learn.microsoft.com/en-us/users/zainharper-0960/",
    "sc100-mcra-mcsb": "https://learn.microsoft.com/en-us/users/zainharper-0960/",
}


def status(url: str) -> int:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as fh:
            return fh.status
    except urllib.error.HTTPError as exc:
        return exc.code


def build(recheck: bool = False) -> dict:
    src = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = []
    for c in src["credentials"]:
        provider = c.get("provider", "")
        result = RESULTS.get(c["id"]) or PROVIDER_RULE.get(provider) or (
            GOOGLE_COURSE if provider.startswith("Google") else ("no public record", HTTP, "No verification page on record"))
        url = VERIFY_URL.get(c["id"], c.get("url", ""))
        if recheck and result[0] == "link dead":
            code = status(url)
            if code == 200:
                result = ("no public record", HTTP, f"The listed URL now answers {code}; recheck the content by hand")
        rows.append({
            "id": c["id"], "issuer": provider, "title": c["title"], "kind": c.get("kind", ""),
            "date": c.get("earned") or c.get("completed") or "",
            "expires": c.get("expires", ""),
            "credential_id": c.get("credential_id") or c.get("badge_id") or c.get("certificate_id") or c.get("verification_code") or "",
            "verification_url": url, "result": result[0], "method": result[1], "note": result[2], "checked": CHECKED,
        })
    rows.sort(key=lambda r: (r["date"], r["issuer"], r["title"]), reverse=True)
    counts = {}
    for r in rows:
        counts[r["result"]] = counts.get(r["result"], 0) + 1
    return {"schema": "harperz9-credentials/v1", "checked": CHECKED, "total": len(rows), "counts": counts,
            "policy": src.get("credential_policy", ""), "credentials": rows}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--recheck", action="store_true")
    data = build(ap.parse_args().recheck)
    OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"{data['total']} credentials: {data['counts']} -> {OUT.relative_to(ROOT)}")
