# cleanroom review

Verifier inputs:
- `spec.json`: the original thesis spec with claims and falsification conditions.
- `run.json`: the witnessed run record and integrity checks.
- `report.md`: the human-readable assessment artifact.

Verifier boundary:
- Use only the original spec and the artifact in this packet.
- Do not use worker context, reasoning trace, intermediate steps, prior chat, or notes.
- If success cannot be evaluated from this minimal state, mark the spec not checkable yet.
