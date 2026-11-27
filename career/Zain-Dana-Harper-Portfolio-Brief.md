# Zain Dana Harper: Portfolio Brief

Kent, Washington | zaindharper@gmail.com | harperz9.github.io/portfolio.html | github.com/HarperZ9

Updated November 25, 2026. Accepted external work first, then the five consolidated open-source platforms, then public research and utilities.

## Accepted External Open-Source Work

Maintainers of 34 external open-source projects have merged 41 of my pull requests, counted November 14, 2026 (38 engineering changes in 31 repositories and 3 list entries; 17 engineering pull requests closed without merge and 13 open are listed publicly on harperz9.github.io/portfolio.html):

- python-grimp/grimp #303, #304, #305 (merged July 3, 2026): raised ModuleNotPresent on absent modules, replaced a Rust panic with ValueError on duplicate layer assignments, and fixed ruff and clippy CI failures on main.
- confident-ai/deepeval #2822 (merged July 2, 2026): fixed unhashable tool-output and nested-parameter TypeError crashes in tool-correctness evaluation with regression tests.
- pydantic/pydantic-ai #6205 (merged July 6, 2026): preserved FileUrl.force_download across UI message round-trips.
- simonw/datasette #2815 and #2861 (merged July 7 and September 8, 2026): returned HTTP 400 on malformed composite primary-key row URLs and assigned distinct task IDs to non-blocking writes.
- python-poetry/tomlkit #549 (merged July 14, 2026): preserved following sibling keys when replacing a dotted key with an array of tables.
- biomejs/biome #11518 (merged August 29, 2026): fixed TypeScript formatter ordering of declare before accessibility modifiers.
- Free Law Project #820, Hebbian Robotics #157, and Voxwire #44: runnable database-free fast-test docs, bidirectional schema drift test, and offline WebSocket replay regression coverage.

## Five Consolidated Open-Source Platforms

Compressed from 206 exploratory repositories down to 88 live owned repositories and 99 archived super-project predecessors:

1. The Playground (HarperZ9/superframe v0.3.0 + HarperZ9/raw + Elder ENB): Multi-backend C++23 renderer (CPU/D3D12/Vulkan/WebGPU byte parity), live moving-camera Skyrim SE DX12 compute pipeline (96 of 96 passing checks across 384 1080p frames, 19 GPU solvers ~1.57 ms, 0 D3D12 errors, 522/522 runtime tests), spectral Megascans-replacement material and 64v/126t flora meshlet forge, SI rigid-body physai (30,670 steps/s), NOH-1 nested organism hierarchy (1,149.9x), 91/91 float64 optics/physics kernels, native CLAP/VST3 DAW plugins, Low Water 3D game, and Elder ENB (1,004,693 downloads, 179,218 unique).
2. BuildLang (HarperZ9/buildlang v1.15.0 on crates.io): Self-hosting capability-effect systems and GPU compiler written in BuildLang (Stage-2 zero-C 5-ISA, Stage-0 Rust bootstrap) (C, HLSL/GLSL, experimental Wasm and x86-64 PE/ELF), 147/147 repeatable build hashes, BDB v2 embedded SQL (2.89 MB paging, 0/500 silent fuzz corruptions, 176/176 crash points, 2,000/2,000 SQLite oracle), compiled native kernels (procgen_forge.bld 2,132.3x, aerospace_ai_kernels.bld 1,008.5x, kcore_fast.bld 356.5x), 8-tool workstation_mcp.bld (69.92 us), RV64 toolchain, and BuildTeX.
3. The Flywheel (HarperZ9/flywheel v2.0.0 on PyPI as flywheel-verify): 31 consolidated AI verification and coding-harness packages (Articulate 0.19.1 with 2,096 tests, unsafe-free Rust EMET 1.3.1, fail-closed Accountable Surface control plane with 563 tests, FlagshipAgentSDK, gather/deconstruct multimodal pipeline), Three-Plate Verification Oracle (115/115 recall, 0/115 false accepts), IDF-Gated Federated Recall (91.25% hit@5 in 2.00 ms at 95.6 tokens), and live RTX 4090 Arm C lifting a local 14B model from 16.67% to 95.83% (p=4e-6).
4. The Commons (HarperZ9/cmmns v3.10.0, AGPL-3.0): Local-first source-provenance browser extension across nine social platforms with Web Crypto capture receipts, 1,726 passing tests, and 91.0% pooled slur-marker precision (range 34.0% to 95.3%, recall unmeasured).
5. Public Research and Utilities (harperz9.github.io, Calibrate Pro 2.0.1, Phantom 1.1.1): 30 reproducible empirical findings (12 published nulls), 13 DOI-indexed preprints (not peer reviewed), 148/148 findings charts with data-driven accessible descriptions, Windows display calibration (884 tests), reversible hardware-identity auditing in Rust (273 tests, 0 production unwraps), and Brender Archival / Engine Revival.

## Claim Boundaries

Independent engineering work conducted as a Washington sole proprietor (Zain Dana Harper, no paid software client engagements or paid software employment to date). Source ledger and full CV: harperz9.github.io/cv.html
