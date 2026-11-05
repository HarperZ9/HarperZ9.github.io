# Portfolio site design rules

## Intent

Everything renders together, in one field. The author, 2026-11-02: "I mean, the idea was that there was going to be
less rules to begin with. I guess rules, constraints, structure, form, and function dictate design, but we wanted
everything to kind of render together." Type is dynamic (the author, 2026-10-26: "remember that accession is not the
rule ~ dynamic is."), with Hanken Grotesk and Conso as the still faces.

## Limits that protect people and the truth

- Accessibility: AA contrast for all text, including text over moving art; full keyboard use; text alternatives
  for anything drawn; reduced motion shows a settled still; content never depends on motion.
- No em dashes. No local paths or internal gate language on public pages.
- Honest nulls stay. Claims are evidence-bound, and publications carry a Verified line saying what was checked, by
  what, and with what result.
- Third-party rights: reference thumbnails ship small, credited and linked, with a removal contact on
  `credits.html`; third-party media is never copied into our outputs. Accession and its families ship under the
  SIL Open Font License 1.1 with `OFL.txt` beside them.
- The non-extractive end: nothing that pays out for staying, no autoplaying sound, no dark patterns or false urgency.

## Where the rendering lives

- The field and the hand: `world/ui/shell/` (shell, organic hand, living-type hook in `world/site/living-hook.js`).
- The road and its ground: `world/universe/` (`proto/path.js`, `lib/ground-start.js`).
- The water medium: `world/superframe/lib/medium/` (GPU top view, `topview.mjs`).
- Living type: `world/typeengine/` (`web/living-gl.mjs`).
- The alive layer (living stills, loops on one clock): `world/alive/`.
- Glass and water, a place of its own: `world/site/glass-water.js`.
- Drawn marks and colour studies: `scripts/marks/`, written by `scripts/build-marks.mjs` and placed by
  `scripts/place-marks.mjs`. Every ink and overlap colour comes from `tools/crossover/icon_palette.py`.
- Standalone tool pages: `system/kit/`.
- Older pages: `system/generative-field.js` and `system/system.css`.

`scripts/import-mission-control.mjs` brings the workshop's pieces in; `scripts/build-world.mjs` rebuilds every page
made from them.

History: the 2026-09-06 editorial-workshop rules and the 2026-10-26 opened-limits section are in this file's git
history (origin/main before 2026-11-02).
