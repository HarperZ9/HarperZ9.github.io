# Crucible recorded workflow demo

This capture demonstrates a real, deterministic Crucible 1.2.0 workflow from a clean source checkout at revision `a3cfb13e299abf1a665ebdf9338d0f85c5399367`.

The story is a measurable conversion:

1. Register a three-claim release-brief thesis.
2. Inspect a sanitized worker artifact and emit numeric substrate evidence.
3. Run Crucible to produce a witnessed assessment and cleanroom review bundle.
4. Observe `1 MATCH / 2 DRIFT / 0 UNVERIFIABLE` on the draft.
5. Refine the artifact without moving the criterion.
6. Re-run the same thesis and observe `3 MATCH / 0 DRIFT / 0 UNVERIFIABLE`.
7. Validate the cleanroom packet and re-derive the witnessed verdicts from disk.

## Deliverables

- `crucible-workflow-short-30s.mp4`: concise 1920 by 1080 marketing cut.
- `crucible-workflow-full-94s.mp4`: full 1920 by 1080 workflow walkthrough.
- `raw-transcript.txt`: exact command output with local source paths sanitized.
- `workflow-evidence.json`: machine-readable receipts, counts, verdicts, review checks, source revision, and command exits.
- `verification.json`: independent MP4 decode, dimensions, duration, digest, sanitization scan, and clean-source verification.
- `bundle-draft/` and `bundle-refined/`: Crucible cleanroom packets.
- `artifact-evidence-draft.json` and `artifact-evidence-refined.json`: SHA-256 receipts and measured worker-artifact metrics.
- `stills/`: representative frames used for visual review.

The MP4s are transcript-driven motion captures. Every command, verdict count, assessment seal, artifact receipt, and review check shown is read from the generated evidence files. No output was invented for the video.

## Exact workflow commands

Run from this directory with the Crucible source directory on `PYTHONPATH`:

```text
python make_substrate.py worker-draft.md substrate-draft.json artifact-evidence-draft.json
python -m crucible run thesis.json --substrate substrate-draft.json --registry registry-draft --bundle bundle-draft
python -m crucible review bundle-draft
python make_substrate.py worker-refined.md substrate-refined.json artifact-evidence-refined.json
python -m crucible run thesis.json --substrate substrate-refined.json --registry registry-refined --bundle bundle-refined
python -m crucible review bundle-refined
python -m crucible verdicts registry-refined --verify
```

`run_workflow.py` executes those steps, records exit codes, sanitizes local paths, and writes the two evidence artifacts. `build_videos.py` asserts the expected evidence shape before it renders either video.

## Evidence summary

| Gate | Draft | Refined |
| --- | ---: | ---: |
| Evidence records | 2 | 3 |
| Unresolved placeholders | 1 | 0 |
| Cleanroom boundaries | 1 | 1 |
| MATCH | 1 | 3 |
| DRIFT | 2 | 0 |
| UNVERIFIABLE | 0 | 0 |
| Cleanroom review | PASS | PASS |
| Re-derived from disk | true | true |

## Presentation choices

The visual frame follows the current Telos v2 direction: a deep plum field, restrained generative spectrum, Hanken-like neutral grotesk typography, Conso-like mono surfaces, one verdict-green semantic accent, and precise cut-corner frames. The UI does not imitate the legacy Calibrate Pro design.

## Safety and provenance

- Local deterministic execution only.
- No external service, account, credential, prompt history, private worker context, or reasoning trace is included.
- Paths in the transcript and video are relative or replaced with `<DEMO_ROOT>` and `<CRUCIBLE_SOURCE>`.
- Source repository files were not edited, committed, pushed, or published.
