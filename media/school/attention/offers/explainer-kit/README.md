# Offer: a 73-second segment for the attention lesson

This folder offers a short film segment to the Night School attention lesson. Nothing on a public
page changes here: the lesson's lead decides whether the segment goes in, and where.

## What the segment shows

How attention moves information between tokens, drawn from a model trained on a CPU: a two-layer
attention-only transformer on 64 random characters with one repeated stretch.

- The model's 1,048,576 final residual numbers, in a camera pass through them.
- The task: 64 characters, with the first copy and the repeat marked.
- Next-character probability at each position, rising only inside the repeat (95.8% right there,
  1.7% elsewhere, chance 1.6%).
- Step 1: a layer 0 head moves each character one position forward (0.51 of its attention on the
  previous token; switched off, repeat accuracy falls to 7.9%).
- Step 2: layer 1 finds the earlier copy and reads the character after it (0.85 for one head;
  both switched off, 1.7%). The columns fall when a head is switched off.

The film: `attention-explainer.mp4` (1080p, 73 s, narrated in the author's synthesized voice) with
captions in `attention-explainer.vtt`. Stills: `still-12.jpg`, `still-35.jpg`, `still-52.jpg`,
`still-58.jpg`.

It complements the lesson's own tinyformer film: the lesson teaches what attention computes; this
segment shows one learned circuit doing a job, with the ablations.

## Where it lives

The scene, its data and the model script are in raw-native (merged as pull request 159):

- `docs/explainer/attention.scene.mjs` and `docs/explainer/attention/` (scene, script, data)
- `tools/explainer/attention_model.py` (trains the model and writes the data; about 80 s on a CPU)
- `web/explainer/` (the kit the scene is built with)

Every number on screen is read from the data files at load time, and the files are checked
against their recorded hashes. The live version lets a reader pause and point at any number.

## To bring it in

1. Vendor raw-native at the merged commit as a new `media/raw-native/tree-<sha>/` (the lesson
   already vendors an older tree), including `web/explainer/` and `docs/explainer/`.
2. A 4K render is queued; until then the 1080p file here is the cut. The interactive version can be
   rendered with `tools/explainer/film/motion_tree.py`.
3. Captions: `docs/explainer/attention/captions.vtt` holds every line.

## Open

- Narration: the voice is synthesized from the author's fine-tuned model, and the author approved
  this narrated cut on 2026-10-16 after listening ("video sounds good"). Every surface that plays it
  should say the voice is synthesized, as the other films do.
- Type: Hanken Grotesk for text, Conso for data, as on the site. Conso's licence terms are not
  recorded in a file; its use follows the site's own (`system/fonts/FONTS.md`).
