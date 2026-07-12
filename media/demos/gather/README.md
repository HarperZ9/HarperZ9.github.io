# Gather recorded workflow

This is an evidence-backed marketing demo of Gather 1.6.1. It uses a small,
sanitized local fixture and the current Gather CLI. No network request,
authenticated source, credential, or private corpus is used.

The videos are deterministic motion captures rendered from the recorded CLI
transcript. They are not a staged desktop recording. Every displayed hash,
count, seal, and verdict is read from `evidence.json`, which is produced by the
real commands below.

## What the workflow proves

1. `extract` turns local HTML into seven addressable blocks. Every block keeps a
   source-node path and SHA-256 fingerprint.
2. `docs` scopes two local notes, drops zero, seals the retained receipts, and
   stores two content-addressed records.
3. `corpus search` recalls both relevant records with their fingerprints still
   attached.
4. `corpus verify` re-reads both stored bodies and returns `MATCH` for both.
5. `corpus digest` emits one seal over the retained receipt set.
6. The bundled integrity drill changes one receipt and verification returns
   `False`. The full video shows that failure as `TAMPER CAUGHT` rather than
   hiding it.

Verified evidence from this capture:

- Gather: `1.6.1`
- Extracted blocks: `7`
- Content SHA-256: `32d493643936a4fcf687b1e6974e3a5bf8c4e4cf976a9c127313792492ade9cc`
- Markdown SHA-256: `e60a84d745df86549568094dc6864ff41d823adfafcf7a06fb2aebe64b9fa24a`
- Stored: `2 added`, `0 deduped`, `0 dropped`
- Corpus digest seal: `aac58984d65dee86c783cdb2cce1d557c542d5230ac54a1f646842dae475d3e3`
- Corpus verification: `2 / 2 MATCH`

## Deliverables

- `gather-workflow-short.mp4`: 29.17-second marketing cut, 1920x1080, H.264,
  30 fps, silent.
- `gather-workflow-full.mp4`: 116-second full workflow, 1920x1080, H.264,
  30 fps, silent.
- `gather-workflow-short-poster.png` and `gather-workflow-full-poster.png`:
  1920x1080 cover frames.
- `transcript.txt`: raw path-sanitized command transcript.
- `evidence.json`: machine-readable command, output, return-code, timing, and
  transcript-digest record.
- `source.html` and `notes/`: the public-safe source fixtures.
- `capture_demo.py`: re-runs the CLI workflow and removes the temporary corpus
  after capture.
- `render_demo.py`: renders both videos directly from `evidence.json`.
- `qa-frames/`: encoded-video spot checks and contact sheets used for visual QA.

The FFmpeg executable is supplied by `imageio-ffmpeg==0.6.0` in `_vendor`.
This scratch-local dependency does not modify Gather or the system Python
environment.

## Reproduce the evidence

From the Gather checkout:

```powershell
python -m gather --version
python -m gather extract <DEMO_DIR>/source.html
python -m gather docs <DEMO_DIR>/notes --scope receipt,verification,provenance --store <DEMO_DIR>/corpus --json
python -m gather corpus search <DEMO_DIR>/corpus --terms receipt,verification --json
python -m gather corpus verify <DEMO_DIR>/corpus --json
python -m gather corpus digest <DEMO_DIR>/corpus --json
python examples/demo.py
```

Or reproduce the sanitized transcript in one step from this directory:

```powershell
python capture_demo.py
```

`capture_demo.py` runs against the canonical sibling checkout at
`../../public/gather`, replaces only the local checkout and demo-directory
prefixes, preserves hashes and tool output, and removes the temporary corpus
after the receipt has been recorded.

## Reproduce the videos

If `_vendor` is absent, install the encoder beside the demo first:

```powershell
python -m pip install --disable-pip-version-check --target ./_vendor imageio-ffmpeg==0.6.0
```

Then render:

```powershell
python render_demo.py
```

The renderer converts the existing Telos v2 Hanken Grotesk and Conso webfonts
to scratch-local TTF files for Pillow. It does not modify the source font files.
The visual system follows the current Telos canon: dark plum ground, Hanken for
reading, Conso for receipts, verdict color only, and one precise workflow surface.

## Verification and hygiene

The capture intentionally normalizes local path prefixes to `<DEMO_DIR>` and
`<GATHER_CHECKOUT>`. It does not redact or rewrite any content hash, digest seal,
return code, or verifier result.

The final transcript and evidence file were scanned for local drive paths,
credential terms, private-key terms, user-home paths, protected-workspace paths,
and common personal email domains. The scan returned no hits. Both MP4 files
were also decoded end to end with FFmpeg after rendering.

Known limitation: the videos are silent. The on-screen progression is designed
to stand alone without narration.
