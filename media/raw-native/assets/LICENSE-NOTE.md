# Licence of this directory

`raw-hall` and `raw-hero` are the engine's owned assets, written by `raw_native_cli export-assets` from the code in
https://github.com/HarperZ9/superframe (`native/src/tools/owned_hall.cpp`, `owned_hero.cpp`) at commit cac34166, under
FSL-1.1-MIT. No third-party geometry or texture went into them (`native/assets/PROVENANCE.md`). The SHA-256 of each file
equals the hash the engine commits in `native/evidence/m3-assets.json`; `SHA256SUMS` lists them and the live renderer
refuses a file that differs.
