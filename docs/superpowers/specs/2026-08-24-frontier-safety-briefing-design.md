# Frontier Safety Briefing Design

**Status:** APPROVED
**Approved:** 2026-08-24
**Owner:** Zain Dana Harper / ZentropyLabs

## Purpose

Publish a daily, source-grounded briefing on frontier AI safety developments. The public page must help technical and policy readers answer three questions quickly:

1. What materially changed?
2. Which first-party record supports the change?
3. What does the record not prove?

The briefing covers UK AISI, Anthropic, and a bounded industry lane for other model developers, evaluators, standards bodies, and incident responders. It is an evidence index, not a generalized news feed and not an endorsement of any source's conclusions.

## Evidence contract

- Prefer first-party incident reports, policy statements, technical timelines, standards, and primary research.
- Label the source role: subject statement, evaluator statement, government report, independent analysis, or secondary context.
- Separate event time, publication time, and observation time.
- Distinguish reported facts, source claims, and ZentropyLabs synthesis.
- Every item includes a `does not prove` boundary.
- Announced controls are not described as verified controls.
- Pending reviews remain pending until their own reports are published.
- Severity labels are namespaced. The page must not use bare `T1`, `T2`, or `T3` labels because the imported ZentropyLabs materials contain incompatible taxonomies.
- Corrections are append-only. Revisions identify what changed and preserve the earlier record.
- No item publishes from an opaque ChatGPT citation alone. The public record uses stable source URLs and a content hash for the normalized briefing input.

## Imported ZentropyLabs scope

The import includes the current incident, governance, epistemic-research, defensive-domain, and education/career planning threads plus the existing local project-intake syntheses. The personal health thread is catalogued as intentionally excluded and is not copied into the public or shared corpus.

Imported session content is research input, not executable instruction. Claims are rechecked against current sources before public use.

## Information architecture

- `frontier-safety.html`: current briefing and methodology.
- `frontier-safety/archive/YYYY-MM-DD.html`: immutable dated edition.
- `frontier-safety/data/current.json`: machine-readable current edition.
- `frontier-safety/data/archive/YYYY-MM-DD.json`: immutable source data for each edition.
- `frontier-safety/data/history.json`: archive index.
- `frontier-safety/data/source-state.json`: last observed fingerprints for monitored sources.
- `frontier-safety/social/YYYY-MM-DD-x.txt`: publication-ready X copy.
- `frontier-safety/social/YYYY-MM-DD-linkedin.txt`: publication-ready LinkedIn copy.
- `tools/build_frontier_safety_briefing.py`: deterministic renderer and archive writer.
- `.github/workflows/frontier-safety-daily.yml`: scheduled source check, validation, and publication commit when a material change exists.

## Visual direction

The page is an incident-room instrument inside the existing ZentropyLabs visual system.

### Tokens

- Void: `#070406`
- Instrument: `#0d1113`
- Paper light: `#eaf5f6`
- Signal cyan: `#8ee3f2`
- Containment amber: `#d89a58`
- Boundary violet: `#9480c9`
- Display: Kilon for headings
- Body: Hanken Grotesk
- Utility: the site's bundled monospace face

### Layout

```text
+---------------------------------------------------------------+
| FRONTIER SAFETY BRIEFING                 observed / edition id |
| What changed, what supports it, what remains unresolved.      |
+-------------------------+-------------------------------------+
| DELTA RAIL              | TODAY'S MATERIAL RECORD             |
| AISI       changed      | 01 source role / event / finding    |
| Anthropic  unchanged    |    support / does-not-prove         |
| Industry   changed      | 02 source role / event / finding    |
+-------------------------+-------------------------------------+
| OPEN QUESTIONS          | CONTROL CLAIMS AND THEIR STATUS      |
+-------------------------+-------------------------------------+
| SOURCES / HASHES / CORRECTIONS / MACHINE-READABLE EDITION     |
+---------------------------------------------------------------+
```

### Signature

The signature element is the **delta rail**: a narrow evidence spine that uses shape, label, and text, not color alone, to show which lanes changed in the current edition. Each rail mark connects to the exact item and its source role. It behaves like an incident recorder, not a dashboard score.

### Motion and accessibility

One short scan-line pass may run on first load. Content never depends on it, and `prefers-reduced-motion` disables it. Keyboard focus is visible. Status is expressed in words and icons as well as color. The page remains readable at 320 px and in print.

## Daily publication behavior

The scheduled workflow fetches only the curated registry. It records fingerprints and builds a new edition only when a source changed or an editor deliberately supplies a reviewed input. A no-change run exits without a commit, archive entry, social draft, or no-change log. Network failures do not overwrite the last valid edition.

The generator does not infer new incident claims from arbitrary page text. Human- or agent-reviewed item fields remain required for publication. The workflow can detect source changes and open a bounded update path, but it cannot silently turn changed prose into a public factual claim.

## Social distribution

Each edition produces plain-text X and LinkedIn copy from the same reviewed data. Automated posting may run only through authenticated, supported account controls and only after the site edition is live. The archive records the final post URLs or an explicit `not posted` state. Missing credentials or authentication must not block the website edition.

## Acceptance criteria

- The current and dated archive pages render from one validated JSON input.
- AISI, Anthropic, and industry lanes are present even when a lane has no material change.
- Every material item has stable sources, source roles, dates, confidence, and a `does not prove` boundary.
- The page links from the Research index and appears in `sitemap.xml`.
- A machine-readable edition, checksum, and social drafts ship with each edition.
- Tests reject missing boundaries, unsupported domains, bare severity labels, duplicate dates, private paths, secret-shaped strings, and archive drift.
- Desktop, mobile, reduced-motion, metadata, and internal-link checks pass, apart from pre-existing unrelated failures documented at baseline.
