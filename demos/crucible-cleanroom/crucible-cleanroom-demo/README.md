# Cleanroom Verdict Packet Demo

This README is designed to be published beside the generated cleanroom bundle after the operator confirms the public destination.

## What This Shows

This artifact demonstrates a small verifier packet where the verdicts are re-derived from the record instead of accepted from prose.

The demo thesis has three claims:

- one claim that matches its measurement
- one claim that drifts from its measurement
- one claim that is not measurable enough and stays `UNVERIFIABLE`

The useful part is not the binary-search example itself. The useful part is the review boundary: a packet should be able to fail, drift, or say it cannot verify the claim.

## Regenerate

From a fresh clone of `HarperZ9/crucible`:

```bash
pip install -e ".[dev]"
python -m crucible run examples/thesis-binary-search.json \
  --measurements examples/measurements-binary-search.json \
  --registry .crucible-demo-registry \
  --bundle .crucible-demo-bundle
```

Expected summary:

```text
MATCH 1  DRIFT 1  UNVERIFIABLE 1
re-derived from disk: True
```

Review the cleanroom bundle:

```bash
python -m crucible review .crucible-demo-bundle
```

Expected result:

```text
cleanroom bundle PASS
```

## What To Critique

I am looking for feedback on the verifier boundary:

- Does the packet include enough to re-check the verdict?
- What fields imply more trust than they should?
- Where should signatures, attestations, or provenance anchors fit?
- What should stay outside this packet?
- Is `UNVERIFIABLE` represented clearly enough for reviewers?

## Non-Claims

This artifact does not certify code, safety, compliance, or correctness beyond the tiny demo. It is a small example of a review packet that can say `MATCH`, `DRIFT`, or `UNVERIFIABLE`.

## Related Project

Project Telos is the broader local-first proof-surface work around AI-assisted workflows:

https://github.com/HarperZ9
