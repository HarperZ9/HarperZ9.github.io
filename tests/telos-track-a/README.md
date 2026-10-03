# Telos measurement tests

These suites check the Telos layer text, the integer OKLab path, the receipts and the measurement
contract. Each rule they test is written in `PREREGISTRATION.md`, and each result file in `results/`
cites the SHA-256 of the rule block it was measured under.

## What CI runs

CI runs every `*.test.mjs` file here with Node 24 and Python 3.12, with numpy and scipy installed.
Four tests need data that the repository does not carry, so CI skips them and prints the reason:

| Test | Needs | Variable |
|---|---|---|
| T3.frames | the 36 audit frames, about 2 MB compressed | `TELOS_AUDIT_FRAMES` |
| T4.vendor | a Telos MCP checkout that carries `demo/vendor` | `TELOS_MCP_ROOT` |
| T5.det, T5.twin | the decoded image set, 686 MB of raw RGBA | `TELOS_TRACKA_WORK` |

The gates in `results/` re-derive from the recorded numbers on every run, with or without the data.

## Full local run

```bash
python -m pip install numpy scipy tokenizers
export TELOS_AUDIT_FRAMES=<audit frame directory with index.json>
export TELOS_TRACKA_WORK=<output directory of py/prep_t5t7.py, with index.json>
export TELOS_MCP_ROOT=<Telos MCP checkout>
node --test tests/telos-track-a/*.test.mjs
```

`tokenizers` and the Qwen3.5-2B `tokenizer.json`, named by `TELOS_QWEN35_TOKENIZER`, are needed only
to recount tokens with `py/tokens.py`. The tests read the recorded counts.

The mutation runner shows that each equality test fails when the code it guards is broken:

```bash
TELOS_WRITE_RESULTS=1 node tests/telos-track-a/mutation/run-mutations.mjs
```

With `TELOS_WRITE_RESULTS=1` it writes `results/mutation.json`, and test T0.3 checks that the last
run killed every registered equality test.
