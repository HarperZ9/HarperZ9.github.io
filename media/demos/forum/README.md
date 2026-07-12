# Forum recorded workflow demo

This package is an evidence-driven recording of Forum 1.13.0 routing, planning,
executing, validating, checkpointing, and verifying one bounded workflow.

It was captured from the public Forum repository at commit
`448a2e160a4cae3006005900c5232e30f416fa2b` on branch
`feat/flight-recorder`. The Forum repository was not edited.

## Finished media

- `forum-demo-short.mp4`: 26.83 seconds, 1920x1080, H.264, 30 fps.
- `forum-demo-full.mp4`: 104.57 seconds, 1920x1080, H.264, 30 fps.
- `forum-demo-short-poster.png` and `forum-demo-full-poster.png`: public poster frames from the rendered cuts.

The films use Project Telos' current dark, precise presentation language. They
are documentary-style workflow recordings: commands, task outputs, verdicts,
metrics, receipt state, and success state are all drawn from the captured run.

## What actually ran

The request was:

```text
Build the backend API endpoint and database schema; review the code and write technical docs.
```

Forum's current CLI ran these commands:

```powershell
$env:PYTHONPATH = '<FORUM_SOURCE>/src'

python -m forum route --json "Build the backend API endpoint and database schema; review the code and write technical docs."

python -m forum submit "Build the backend API endpoint and database schema; review the code and write technical docs." `
  --cmd "python <DEMO_DIR>/mock_forum_model.py" `
  --ledger "<DEMO_DIR>/ledger" `
  --checkpoint-each-wave `
  --delivery-profile engineer `
  --max-model-calls 12 `
  --json

python -m forum ledger show --ledger "<DEMO_DIR>/ledger" --limit 30
python -m forum ledger summary --ledger "<DEMO_DIR>/ledger" --json
python -m forum ledger verify --ledger "<DEMO_DIR>/ledger"
python -m forum ledger room --ledger "<DEMO_DIR>/ledger" --brief
```

`<DEMO_DIR>` is the directory containing this README. The capture wrapper uses
the absolute path internally and replaces it in the transcript so the package
does not disclose machine-private paths.

## Evidence

The run produced:

- route: `backend`, confidence `0.6`, no escalation required;
- plan: 3 tasks across 3 dependency waves;
- execution: 3 task results, 0 failed results;
- validation: 3 passing verdicts, 0 failing verdicts;
- delivery profile: `engineer`, 0 profile flags;
- ledger: 19 entries and 3 checkpoints;
- verification: chain `true`, deep payload verification `true`;
- operator room: `Status: Complete`, no blocking signals.

Primary receipts:

- `forum-workflow-transcript.txt`: exact sanitized command transcript with exit codes.
- `forum-workflow-evidence.json`: structured route, plan, task, result, verdict,
  receipt, summary, operator-room, and assertion evidence.
- `ledger/entries.jsonl` and `ledger/payloads.jsonl`: Forum's raw
  content-addressed ledger artifacts.
- `verification.json`: media metadata, hashes, dimension checks, transcript
  scan, and final verification gates.

## Fixture boundary

`mock_forum_model.py` is a disclosed deterministic offline subprocess fixture.
It supplies coordinator, task, validator, and synthesizer responses so the run
does not require a network, account, API key, or external model. Forum itself
performs the routing, DAG scheduling, causal ledger writes, data-edge
injection, checkpoints, validation calls, synthesis, delivery checks, receipt
construction, summary, run-room projection, and deep verification.

The demo proves those orchestration and evidence mechanics. It does not claim
to benchmark model quality.

## Reproduce

From this directory:

```powershell
python capture_workflow.py
python -m pip install --disable-pip-version-check --target vendor -r requirements-render.txt
python render_forum_demo.py
python -m pytest -q test_capture_workflow.py test_render_forum_demo.py
python verify_artifacts.py
```

`capture_workflow.py` clears only this package's generated `ledger/` directory,
runs the workflow, saves the transcript and structured evidence, and fails if
any success assertion is false. `render_forum_demo.py` reads the structured
evidence rather than inventing output.
