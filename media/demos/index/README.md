# Index: verified workspace workflow capture

This package records a real Index 2.9.0 workflow over a synthetic, local-only workspace. It is designed as publication-ready source material for marketing, while preserving the evidence trail behind every claim in the cut.

The short cut is a 30-second sales demonstration. The full cut is a 118-second inspectable walkthrough. Both are silent H.264 MP4 files at 1920x1080 and 30 frames per second.

## Story in the capture

An operator inherits three unfamiliar repositories. Index derives three internal dependency edges from independent import and manifest signals, verifies one claim back to `pyproject.toml:5`, fits all three repositories into a 1,200-token context envelope with no omission, and renders the result as a self-contained workbench.

The visual edit is deterministic rather than a simulated live shell. Every terminal line shown in the videos is copied from `raw-terminal-sanitized.txt`; `build_demo_media.py` refuses to build if the core evidence lines are missing from that transcript. Product screenshots are real generated Index HTML opened in headless Chromium. The local root is replaced with `SANITIZED_WORKSPACE` in the browser DOM before capture, and `capture_atlas.py` asserts that the private root is gone.

## Evidence from the run

- Source checkout: commit `46247e2`, package version `2.9.0`.
- Fixture: three synthetic local Git repositories with no remotes or credentials.
- Graph: three internal edges; all three are `import+manifest [high]`.
- Structural hub: `signal-core`, with in-degree 2 and out-degree 0.
- Claim check: `MATCH`, `operator-console -> routing-service`, witnessed at `pyproject.toml:5`.
- Context envelope: `MATCH`, 738 of 1,200 tokens, 3 retained, 0 omitted.
- Atlas: 3 repositories, 4 documents, 12 knowledge edges.
- Workbench receipt prefix: `2999aacfce8573cc`.

The fixture is intentionally small enough to audit by hand. It proves the workflow and evidence posture; it is not a scale benchmark.

## Exact commands

Run these from this capture directory:

```powershell
$IndexSource = Resolve-Path '..\..\public\index'
$env:PYTHONPATH = "$IndexSource\src"

git -C $IndexSource rev-parse --short HEAD
python -m index_graph status --json

python -m index_graph graph --root .\workspace
python -m index_graph verify --root .\workspace --depends "operator-console -> routing-service"
python -m index_graph context-envelope --root .\workspace --focus operator-console --budget 1200
python -m index_graph workbench --root .\workspace --budget 1200 --out .\index-workbench.html
python -m index_graph atlas --root .\workspace
python -m index_graph atlas --root .\workspace --format html --out .\index-atlas.html

python .\capture_atlas.py
python .\build_demo_media.py
```

`capture_atlas.py` requires the two generated HTML files. After capture, `index-workbench.html` was deliberately removed from this package because the truthful raw artifact prints its local filesystem root. The redacted screenshots and videos retain the product output without disclosing that path. Re-running the commands recreates the intermediate.

The media builder uses Pillow and the FFmpeg installation at `C:\Program Files\Shutter Encoder\Library\ffmpeg.exe`.

## Deliverables

| Artifact | Purpose | SHA-256 |
| --- | --- | --- |
| `index-verified-workspace-short-30s.mp4` | 30-second social and outreach cut | `432885F603382F8FDAEC243566B21ADCE289D6460A08171522AFFBC603E5A781` |
| `index-verified-workspace-full-118s.mp4` | 118-second full workflow | `BCCA349546CD14036000F3C737820F89D900CF61DED47D0B3DD3B8617A4E7ED9` |
| `raw-terminal-sanitized.txt` | Exact commands and sanitized output | `487784968077E8F8C208B35861BE1C0A5CA101A98F30E1AF288FD1E77C0D8DA3` |
| `index-atlas.html` | Real generated offline atlas | `5BC763CBA03014DB9A2B0FC5A9252871EFC68EDD4110C2540C078C867BA852DE` |
| `workbench-1920x1080.png` | Redacted overview capture | `90F8A2D39DBA78816FF089CDD79842F8EFC04EAB9A046C12F386724B024FCCD1` |
| `workbench-map-1920x1080.png` | Real map capture | `A0E5D47AE593D0DD1F5AF136012CEA5AFD4130296E578232276796BE01C73D31` |
| `workbench-lens-1920x1080.png` | Real context-lens capture | `F9470C87D96C5C1C569BCF9EA8B11AF28E3BE70E83DB85ECED2D2A1BBF5BDB95` |

The `workspace/` directory is the complete sanitized fixture. `frames/` contains every deterministic 1920x1080 source frame used in the two edits. `capture_atlas.py` and `build_demo_media.py` make the capture reproducible.

## Verification commands

```powershell
$Ffprobe = 'C:\Program Files\Shutter Encoder\Library\ffprobe.exe'

& $Ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration,size -of json .\index-verified-workspace-short-30s.mp4
& $Ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration,size -of json .\index-verified-workspace-full-118s.mp4

Get-FileHash -Algorithm SHA256 .\index-verified-workspace-short-30s.mp4, .\index-verified-workspace-full-118s.mp4, .\raw-terminal-sanitized.txt
```

Expected media facts:

- Short: H.264, 1920x1080, `yuv420p`, 30 fps, exactly 30.000 seconds.
- Full: H.264, 1920x1080, `yuv420p`, 30 fps, exactly 118.000 seconds.

## Sanitization gate

The terminal transcript was scanned for absolute user/workspace paths and credential-shaped strings. The final scan produced zero matches. No account, browser session, network service, remote repository, or secret was accessed for this capture.
