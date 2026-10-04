<!-- writing-profile: readme -->
# Explainers

An explainer is a short figure in steps. One scene spec drives two renders: a video rebuilt to the same bytes with a receipt, and a live figure the media engine draws in the page. The reader can pause on a step, scrub, change a value the spec exposes and watch the figure follow. After each group of steps a short recall check asks two or three questions, run on Learn.

The video stays the version to share and cite. It is also what a reader gets without script, or before the live figure loads. With reduced motion, the live figure shows one still per step and never animates.

## Add one to a page

1. Write `media/explainers/<slug>/spec.json` (format below). Every line the narrator says and every mark on screen comes from the published text of the page it sits on. Do not add a claim the page does not make.
2. Write `media/explainers/<slug>/recall.json` (format below).
3. Render on Windows: `python -m tools.explainer.render media/explainers/<slug>`. This writes the video, captions, poster, aperture art and `receipt.json`.
4. Place the figure.
   - On a generated essay, add the slug to `EXPLAINERS` in `tools/render_legacy_essays.py`, keyed by the section anchor it closes.
   - On a hand-written page, put `<!-- BEGIN EXPLAINER <slug> -->` and `<!-- END EXPLAINER <slug> -->` where it belongs, add the slug to `HAND_PLACED` in `tools/explainer/embed.py`, and run `python -m tools.explainer.embed`.
5. Run `python -m pytest tests/test_explainers.py tests/test_explainer_parity.py tests/test_explainer_captions.py tests/test_explainer_live.py` and `node tests/explainer-live.cjs` against a local server (`python tools/serve.py`).

The figure markup loads `system/explainer/live.mjs` and `system/explainer/explainer.css`. Nothing else on the page changes.

## Spec format

```json
{
  "slug": "receipt-loop", "title": "From a proposed answer to a kept receipt", "seed": 20261005,
  "page": "flywheel.html#loop", "poster": { "scene": "receipt", "at": 0.8 },
  "params": [
    { "id": "budget", "label": "Attempt budget (candidates)", "kind": "range",
      "min": 1, "max": 6, "step": 1, "default": 4, "digits": 0, "scene": "check" }
  ],
  "derived": { "passed": { "if": { "le": [{ "param": "first_pass" }, { "param": "budget" }] }, "then": 1, "else": 0 } },
  "scenes": [
    { "key": "title", "layout": "title", "heading": "...", "say": "...", "min": 3.5 },
    { "key": "check", "heading": "...", "say": "...", "min": 5.0, "marks": [ ... ] },
    { "key": "close", "layout": "close", "heading": "...", "say": "...", "command": "python -m tools.explainer.render ..." }
  ]
}
```

A scene has a `key`, a `heading`, the narrated line `say` and a minimum length `min` in seconds. The first scene uses `"layout": "title"` and the last `"layout": "close"`. Each mark appears at its `at` fraction of the scene.

| Mark | Fields | Draws |
|---|---|---|
| `card` | `label`, `value`, optional `verdict` or `risk` | a labelled value; a verdict prints its word and liability level |
| `note` | `text`, optional `risk` | one line of small type |
| `bars` | `items` of `label`, `value`, optional `to`, `display`, `strong`, `carry`; `scale` | horizontal bars; a bar with `to` moves during its scene |
| `grid` | `count`, `filled`, `label` | one cell per item, the first `filled` cells filled |
| `tries` | `max`, `budget`, `first_pass` | one box per candidate: FAIL, PASS, not run, over budget |

Status marks follow the risk rule: each view draws only its highest-liability mark in colour, and every mark names its level in words.

### Parameters

A parameter is a `range` (`min`, `max`, `step`, `digits`) or a `choice` (`options` of `value` and `label`). `scene` names the step the figure jumps to when the reader moves it. The video renders every parameter at its `default`, so the default must reproduce what the narration says.

Any value in a scene can be a binding:

| Binding | Value |
|---|---|
| `{ "param": "id" }` | the parameter's value; add `"mul": k` or `"over": k` for value times k or k over value |
| `{ "if": COND, "then": A, "else": B }` | COND is `{ "le" \| "lt" \| "ge" \| "gt" \| "eq": [A, B] }` or `{ "all": [COND, ...] }` |
| `"text {id} text"` | a template; numbers print with the parameter's `digits` |

`derived` names values computed from the parameters, in order, for later bindings to use.

### Captions that follow the figure

When a scene's verdict or heading changes with the values, its caption must change with them. The scene gives `outcome`, a binding that computes an outcome word, and makes `say` one caption per word:

```json
{ "key": "split", "outcome": { "param": "verdict" },
  "say": { "DRIFT": "... The receipt holds, and the claim fails.", "MATCH": "... The receipt holds, and the claim holds." } }
```

Resolving the scene picks the caption for the computed outcome, in `scene.py` and `state.mjs` alike. The live stage draws that caption and sets it as the screen-reader text, so the words follow the verdict on screen. The video renders at the defaults, so it narrates the default outcome's caption. Take each variant's wording from the page's own text.

`tests/test_explainer_captions.py` walks a grid of values and fails when a branching scene has a fixed caption, when the caption shown is not the computed outcome's variant, when a computed verdict differs from the outcome, or when the caption asserts the other outcome. Controls with swapped and fixed captions must fail it.

When the reader changes a value, the page says that the stage and its caption follow it and the narrated video keeps the original values, and offers a reset.

On a phone (max-width 600px) the caption is set as text under the stage, and the stage leaves it out and grows its type with the stage width, up to 1.5 times the video's size. Text that would overrun its slot is fitted to the slot's width.

## Recall items

`recall.json` is a Learn item set (`learn-items/1`), with each item in Learn's choice format (`learn-choice/1`, documented in Learn's `docs/CHOICE-ITEMS.md`).

```json
{
  "schema": "learn-items/1", "topic": "...", "explainer": "receipt-loop",
  "checks": [ { "after": "receipt", "items": ["loop-who-accepts", "loop-receipt-name"] } ],
  "items": [
    { "id": "loop-who-accepts", "objective": "who-accepts",
      "prompt": "In the loop, which step can accept an answer?",
      "choices": [ { "id": "check", "text": "The external check" }, { "id": "model", "text": "The local model, when it is confident" } ],
      "answer": "check",
      "misconceptions": { "model": { "leaf": "misrecruited.self_grading", "note": "..." } },
      "source": { "ref": "flywheel.html#loop", "quote": "Only the external check can accept an answer" } }
  ]
}
```

- Each check follows the scene named in `after` and asks two or three items. The last check follows the closing scene. Every item is asked once.
- `source.quote` is copied word for word from the page at `source.ref`; a test fails otherwise.
- A misconception note explains the mistake without quoting the keyed answer; a test fails if it does.

On the page, a wrong choice is told which misconception it matches. After two wrong tries the reader can ask for the answer. The first attempt at each question per visit goes into Learn's spaced-review schedule, kept in this browser's `localStorage` under `explainer-recall/v1/<slug>`. When questions come due, the figure says so on the next visit. "Forget my answers" clears it. Nothing is sent anywhere.

Learn runs from a pinned copy in `system/vendor/learn/`, copied byte for byte from the commit named in `VENDOR.json`. To update it, copy the browser entry's files from a newer Learn commit and rewrite the hashes.

## Receipts

The video's `receipt.json` records the spec's SHA-256, the render code, fonts and toolchain, the hash of every output, the frame chain, the narrated timeline and the default parameter values. `--verify` rebuilds and compares; `--check` compares hashes only, which is what CI runs.

The live figure hashes the spec it loaded and compares it with the receipt's: MATCH, DRIFT, or UNVERIFIABLE when there is no receipt. "Save this frame's receipt" downloads a `superstack.receipt/1` for the frame on screen. Its scene carries the slug, the spec hash, the changed values and the time in flicks.

`narration.receipt.json` is the narration's own `superstack.receipt/1` (contract SPEC section 8.7). `python -m tools.explainer.narration <folder>` rebuilds the narration with the local voice, refuses to write unless the WAV matches `narration_wav_sha256`, and records the s16le PCM hash, the backend, model, OS build as the snapshot, voice, script hash, `reference: false`, `reproducible: true`, and the loudness from the contract's BS.1770 meter against the speech target. `--check` verifies the seal and ties the receipt to the spec and the video's receipt without the voice; CI runs it through `tests/test_explainers.py`.

Measured on 3 October 2026 (ffmpeg 7.1 `ebur128` agrees within 0.1 LU): all three narrations sit near -20.2 LUFS, about 4 LU under the -16 LUFS speech target, so each receipt reads `refuted`. Raising them changes every published video's hash, so it waits for a stated rebuild.

## What the parity check covers

`tools/explainer/scene.py` (the video) and `system/explainer/state.mjs` (the live figure) each compute what a frame shows. `tests/test_explainer_parity.py` runs both over 98 sampled frames of every explainer, at the defaults and with each parameter at its limits, and requires the same scene, text, verdicts, hot mark, alphas and bar values. It does not compare pixels: Pillow and the browser draw type differently, so the check is on what is drawn. The live stage does not draw the video's film grain.
