<!-- writing-profile: readme -->
# superstack v0.1.0, vendored

These files come byte for byte from the `v0.1.0` tag of [HarperZ9/superstack](https://github.com/HarperZ9/superstack) (MIT), as its VENDORING.md describes:

| Here | Upstream |
|---|---|
| `system/media-engine/contracts.mjs` | `superstack.mjs` |
| `tests/superstack/SHA256SUMS` | `SHA256SUMS` |
| `tests/superstack/vectors/` | `vectors/` |
| `tests/superstack/tests/run_vectors.mjs` | `tests/run_vectors.mjs` |
| `tests/superstack/tools/check_vendored.py` | `tools/check_vendored.py` |

`system/media-engine/SUPERSTACK.sha256` holds the pin. CI checks that the copy still has that hash, that it matches the release's `SHA256SUMS`, and that it passes every vector on the runner's Node:

```
python tests/superstack/tools/check_vendored.py system/media-engine/contracts.mjs --expect "$(cut -d' ' -f1 system/media-engine/SUPERSTACK.sha256)"
node tests/superstack/tests/run_vectors.mjs --impl system/media-engine/contracts.mjs
```

To upgrade, copy the new release's files over these in one commit and change the pin in the same commit. Never patch the copy here; a change goes to the superstack repository so all three languages move together.
