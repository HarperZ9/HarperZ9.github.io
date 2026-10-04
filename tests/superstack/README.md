<!-- writing-profile: readme -->
# superstack v0.2.0, vendored

These files come byte for byte from the `v0.2.0` tag of [HarperZ9/superstack](https://github.com/HarperZ9/superstack), as its VENDORING.md describes. From v0.2.0 superstack is licensed under FSL-1.1-MIT (Functional Source License 1.1, MIT future licence); `LICENSE` here is the release's own copy. The public-domain notices for mulberry32 and xmur3 stay in the header of each file. The site around these files stays all rights reserved, and the same author holds both.

| Here | Upstream |
|---|---|
| `system/media-engine/contracts.mjs` | `superstack.mjs` |
| `tools/superstack.py` | `superstack.py` (pin in `tools/SUPERSTACK.sha256`) |
| `tests/superstack/SHA256SUMS` | `SHA256SUMS` |
| `tests/superstack/LICENSE` | `LICENSE` (FSL-1.1-MIT) |
| `tests/superstack/vectors/` | `vectors/` |
| `tests/superstack/tests/run_vectors.mjs` | `tests/run_vectors.mjs` |
| `tests/superstack/tests/run_vectors.py` | `tests/run_vectors.py` |
| `tests/superstack/tools/check_vendored.py` | `tools/check_vendored.py` |

`system/media-engine/SUPERSTACK.sha256` holds the pin. CI checks that the copy still has that hash, that it matches the release's `SHA256SUMS`, and that it passes every vector on the runner's Node:

```
python tests/superstack/tools/check_vendored.py system/media-engine/contracts.mjs --expect "$(cut -d' ' -f1 system/media-engine/SUPERSTACK.sha256)"
node tests/superstack/tests/run_vectors.mjs --impl system/media-engine/contracts.mjs
```

To upgrade, copy the new release's files over these in one commit and change the pin in the same commit. Never patch the copy here; a change goes to the superstack repository so all three languages move together.
