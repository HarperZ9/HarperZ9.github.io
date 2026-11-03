"""Choose which experiments the site may show, check their numbers, and write the public data.

    python tools/experiments/select.py --workshop <mission-control folder> --held <held list .md>

Reads the publication register and the findings ledger from the workshop (both local, never published) and writes:
  experiments/experiments.json   the public cards: text, numbers, verdicts, limits, domains, figure names
  media/experiments/<id>-960.{avif,webp}   each card's figure, from the study's own 3840 px render
  the held list                  every study left off, with the reason, for the author

Public rule, in order (the first that fails holds the study back):
  1. The register tier is D, "an honest null or refutation worth reporting". Tier A ("candidate for publication")
     has no rows; B (signal with a next step), C (internal) and E (unreliable) stay with the author.
  2. The row carries no hold: "not for outbound use", "internal", "not until author review", or any mention of
     the author or of saved posts (personal material stays off the site).
  3. Its data licence is recorded and open, or the row names no outside dataset.
  4. Every number on the card appears in the study's own ledger entry (the Verified line reports this check).
  5. After paths and file names are removed, the text has no local path.
scripts/build-experiments.mjs renders experiments/index.html from the JSON.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parents[2]
HOLD = re.compile(r"not for outbound|internal[;.]|not until author review|\bauthor\b|private|\bsaves?\b", re.I)
BAD_LICENCE = re.compile(r"research-only|non-?commercial|BY-NC|copyright|not checked|internal|private|saves|no stated licen|local research cop|terms per dataset not", re.I)
DATASET = re.compile(r"dataset|ITRDB|OpenNeuro|Dryad|CRU\b|FIA\b|Kaggle|Hugging ?Face|PubMed|Zenodo|Dataverse|archive|census|survey data", re.I)
NUM = re.compile(r"(?<![\w.])[-+]?\d[\d,]*\.?\d*")
FILEREF = re.compile(r"[\w./-]*\d{4}-\d\d-\d\d-[\w.-]+/?[\w./-]*|\b[\w./-]+\.(?:md|json|jsonl|txt|py|csv|png|lock)\b")
LOCAL = re.compile(r"[A-Za-z]:[\\/]|/Users/|\\\\")

QUIET_FIELDS = {"models", "model architecture", "machine learning", "pruning", "ai-interpretability", "agents", "tokenizers", "memory"}
QUIET_FOLDERS = re.compile(r"architectures|model-interface|model-organism|adapt-check|checked-valve|reference-transform|inside-out-build|world-model|leap|hierarch|recall|weight|epigenet|microsystem|nested|network-optics|neuron-steer|kernel-sweep", re.I)

# the sixteen domains of the 2026-11-02 domain map, with the register field words folded into each
DOMAINS = [
    ("method", "Method and statistics", r"method|statistic|metascience|forecast|verification|reproduc|psychometric|causal|replication|evaluation"),
    ("physics", "Physics", r"physics|mechanic|fluid|wave|quantum|nuclear|astronom|flight|fracture|geophys|thermo|collective motion|soft actuator"),
    ("information", "Information and signal", r"information|signal|compression|coding|cybernetic|disinformation|entropy"),
    ("instruments", "Instruments and control", r"instrument|metrolog|sensor|valve|control|electronic|calibrat|transduc"),
    ("ai", "AI and machine learning", r"\bai\b|interpretab|agent|model architecture|machine learning|models|tokeni|memory|pruning|neural"),
    ("optics", "Optics, colour and imaging", r"optic|colour|color|film|imaging|spectro|photon|lens"),
    ("computing", "Computing and mathematics", r"cs-|systems|hpc|geometr|graph|complexity|matri|mathemat|network"),
    ("ecology", "Plants, trees and earth", r"plant|tree|forest|fung|myc|ecolog|climate|earth|wood|geochem|xylem"),
    ("biology", "Biology and medicine", r"biolog|neuro|physiolog|medicin|biomarker|evolution|biomechan|body"),
    ("psychology", "Psychology and perception", r"psycholog|cognit|percept|human stud|mood"),
    ("society", "Society and economics", r"econom|sociolog|politic|law|governance|game theory|institution"),
    ("history", "History of science", r"history|philosoph"),
    ("materials", "Materials and chemistry", r"material|composite|soft matter|chemi|polymer"),
    ("rendering", "Rendering and design", r"render|design|typograph|visualis|graphics"),
    ("language", "Language and literature", r"linguist|literat|language|reading"),
    ("sound", "Music and sound", r"music|acoustic|sound"),
]


def ledger_entries(text: str) -> dict[str, tuple[str, str]]:
    heads = list(re.finditer(r"^### (F\d+)\. (.+)$", text, re.M))
    out = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out[m.group(1)] = (m.group(2).strip(), text[m.start():end])
    return out


def scrub(s) -> str:
    s = FILEREF.sub("", str(s or ""))
    return re.sub(r"\s{2,}", " ", re.sub(r"\(\s*\)|\s+([,;.])(?=\s|$)", r"\1", s)).strip(" ;,")


def domains_of(row) -> list[str]:
    words = " ".join(row.get("fields") or []).lower()
    hit = [d for d, _, rx in DOMAINS if re.search(rx, words)]
    return hit or ["method"]


def study_folder(workshop: Path, ev) -> Path | None:
    refs = []
    if isinstance(ev, str):
        refs.append(ev)
    elif isinstance(ev, dict):
        refs += [str(ev.get("source") or ""), str(ev.get("prereg") or "")]
    for ref in refs:
        head = ref.strip().split()[0] if ref.strip() else ""
        part = head.split("/")[0]
        if not part:
            continue
        exact = workshop / part
        if exact.is_dir():
            return exact
        hits = sorted(workshop.glob(f"*-{part}"))
        if hits and hits[0].is_dir():
            return hits[0]
    return None


def figure_of(folder: Path | None) -> Path | None:
    if not folder:
        return None
    pngs = [p for sub in ("", "render", "renders", "figures", "out") for p in sorted((folder / sub).glob("*.png")) if (folder / sub).is_dir()]
    for p in sorted(pngs, key=lambda p: (("result" not in p.name.lower()) and ("4k" not in p.name.lower()), p.name)):
        try:
            with Image.open(p) as im:
                if im.size == (3840, 2160):
                    return p
        except OSError as e:
            print(f"figure: {p.name} unreadable: {e}")
    return None


def lock_of(folder: Path | None, ev) -> str | None:
    pre = str(ev.get("prereg") or "") if isinstance(ev, dict) else ""
    m = re.search(r"\b[0-9a-f]{8,64}\b", pre)
    if m:
        return m.group(0)[:12]
    if folder:
        # only a folder with exactly one lock (or one preregistration) names this study's lock without doubt
        locks = sorted(folder.glob("*.lock.json")) + sorted(folder.glob("*/prereg.lock.json")) + sorted(folder.glob("*/*/prereg.lock.json"))
        if len(locks) == 1:
            return hashlib.sha256(locks[0].read_bytes()).hexdigest()[:12]
        if not locks:
            pre = sorted(folder.glob("PREREG*.txt")) + sorted(folder.glob("*PREREG*.md"))
            if len(pre) == 1:
                return hashlib.sha256(pre[0].read_bytes()).hexdigest()[:12]
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workshop", required=True)
    ap.add_argument("--held", required=True)
    a = ap.parse_args()
    ws = Path(a.workshop)
    reg = json.loads((ws / "2026-10-27-plygrnd/PUBLICATION-REGISTER.json").read_text(encoding="utf-8"))
    ledger = ledger_entries((ws / "2026-10-27-plygrnd/FINDINGS.md").read_text(encoding="utf-8"))
    media = SITE / "media/experiments"
    media.mkdir(parents=True, exist_ok=True)
    cards, held = [], []
    for row in reg["rows"]:
        f, ev = row["f"], row.get("evidence")
        evd = ev if isinstance(ev, dict) else {}
        title = ledger.get(f, (row["title"], ""))[0]
        def hold(reason):
            held.append((f, row["tier"], title, reason))
        # the author, 2026-11-03: "We want to remain quiet" on the model-architecture line (memory studies, leap
        # architecture, hierarchy and recall, weight reading, model epigenetics, microsystem kernels, nested worlds,
        # the optics of a network); none of it goes on the site
        if QUIET_FIELDS.intersection(f.lower() for f in row.get("fields") or []) or QUIET_FOLDERS.search(json.dumps(row.get("evidence"))):
            hold("model-architecture line, kept off the site (author, 2026-11-03)")
            continue
        if row["tier"] != "D":
            hold({"A": "tier A", "B": "tier B: real signal with a next step, not cleared for publication", "C": "tier C: internal", "E": "tier E: not reliable as it stands"}.get(row["tier"], "no tier"))
            continue
        if HOLD.search(json.dumps(row)):
            hold("the register row carries a hold or names personal material")
            continue
        lic = str(row.get("data_licence") or "")
        if BAD_LICENCE.search(lic) or (not lic and DATASET.search(json.dumps(row))):
            hold("data licence not recorded as open")
            continue
        if f not in ledger:
            hold("no ledger entry to check the numbers against")
            continue
        shown = {"claim": row["claim"], **{k: evd.get(k) for k in ("denominator", "interval", "controls", "forecast_vs_outcome", "known_answer")}}
        body = ledger[f][1].replace(",", "")
        nums = [n for v in shown.values() if v for n in NUM.findall(str(v))]
        missing = [n for n in nums if n.replace(",", "").rstrip(".").lstrip("+") not in body]
        if missing:
            hold(f"{len(missing)} of {len(nums)} numbers not found in the ledger entry")
            continue
        text = {k: scrub(v) for k, v in shown.items() if v}
        limits = scrub(row.get("does_not_prove") or row.get("reviewer_attack") or "")
        why = scrub(row.get("tier_reason"))
        if any(LOCAL.search(v) for v in [*text.values(), limits, why, title]):
            hold("a local path survived scrubbing")
            continue
        folder = study_folder(ws, ev)
        fig, figname = figure_of(folder), None
        if fig:
            figname = "fig-" + hashlib.sha256(str(fig.relative_to(ws)).encode()).hexdigest()[:10]
            if not (media / f"{figname}.webp").exists():
                with Image.open(fig) as im:
                    small = im.convert("RGB").resize((960, 540), Image.LANCZOS)
                    small.save(media / f"{figname}.avif", "AVIF", quality=55)
                    small.save(media / f"{figname}.webp", "WEBP", quality=78, method=6)
        cards.append({
            "id": f, "n": int(f[1:]), "title": title, "finding": text.pop("claim"), "numbers": text,
            "verdict": why, "limits": limits, "domains": domains_of(row), "lock": lock_of(folder, ev),
            "rung": scrub(row.get("rung") or (row.get("ladder") or {}).get("rung") or ""),
            "scorer": scrub(row["scorer"] if isinstance(row.get("scorer"), str) else (row.get("scorer") or {}).get("who", "")),
            "self_graded": bool(re.search(r"self", json.dumps(row.get("scorer") or ""), re.I)) or (isinstance(row.get("scorer"), dict) and row["scorer"].get("self_graded")),
            "checked_numbers": len(nums), "figure": figname, "_folder": str(folder) if folder else None,
        })
    # a study plate often draws every finding of its study; it ships only when none of them is held
    shown_ids = {c["id"] for c in cards}
    by_folder: dict[str, set[str]] = {}
    for row in reg["rows"]:
        fo = study_folder(ws, row.get("evidence"))
        if fo:
            by_folder.setdefault(str(fo), set()).add(row["f"])
    for c in cards:
        fo = c.pop("_folder")
        if c["figure"] and not by_folder.get(fo, set()) <= shown_ids:
            c["figure"] = None
    used = {c["figure"] for c in cards if c["figure"]}
    for f in media.glob("fig-*"):
        if f.stem not in used:
            f.unlink()
    out = {"built": dt.date.today().isoformat(), "rule": "register tier D, no hold, open data, every number found in the study's ledger entry",
           "domains": [{"id": d, "label": lbl} for d, lbl, _ in DOMAINS], "cards": sorted(cards, key=lambda c: -c["n"])}
    (SITE / "experiments").mkdir(exist_ok=True)
    (SITE / "experiments/experiments.json").write_bytes((json.dumps(out, indent=1, ensure_ascii=False) + "\n").encode("utf-8"))
    lines = ["# Experiments held back from the site", "", f"Built {out['built']} by tools/experiments/select.py. The public rule: {out['rule']}.",
             f"Shown: {len(cards)}. Held: {len(held)}. Each held study is listed with the first rule it failed; the author decides.", "",
             "| Finding | Tier | Title | Held because |", "|---|---|---|---|"]
    lines += [f"| {f} | {t} | {ti.replace('|', '/')} | {r} |" for f, t, ti, r in held]
    Path(a.held).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"experiments: {len(cards)} shown, {sum(1 for c in cards if c['figure'])} with figures ({len(used)} plates), {len(held)} held")


if __name__ == "__main__":
    main()
