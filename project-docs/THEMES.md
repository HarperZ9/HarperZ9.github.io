# Themes: the worlds the site moves between

Written 2026-10-28 with the performance budget (PERFORMANCE-BUDGET.md). The author, the same day: the site
should have no centerpiece; it should hold themes and change between them, light and dark as two characters.

## What exists now

- **Registry:** `world/site/themes/registry.js`. Three worlds, each with a name, two characters (light and dark),
  type, motion, sound and slots:

  | World | Light character | Dark character | Display face | Motif |
  |---|---|---|---|---|
  | `night-garden` | Dusk after rain | Streetlight | Accession Burin | rain lines and a sodium glow |
  | `newsprint` | Morning edition | Underground press | Accession Super | two-ink halftone |
  | `instrument` | Bench | Scope | Accession Divisumma | measuring grid |

- **Tokens:** `world/site/themes/themes.css`, keyed by `<html data-world>` and the lamp (`data-theme` or the
  system scheme). Each character sets wall, ink, soft, line, accent, a second accent and a glow, and the faces.
  Ink on wall holds 7:1 or better in all six characters. Motifs are static CSS paint: switching costs one style
  recalculation and no frames.
- **Choosing a world:** the visitor's own choice (remembered) first, then a link's `?world=`, then a weather
  signal if a provider sets one (`signals.weather`; nothing asks for location), then the hour (19:00 to 06:00 is
  the night garden), then the visit count (each return shows the next world). The head of `index.html` runs the
  same order inline so the first paint is already in the right world.
- **Switching:** `world/site/themes/switch.js` puts one button per world in the hand, where the strip of stop
  squares was. A press applies the tokens at once and swaps the arrival loop.
- **Slots:** each world names its arrival loop (`slots.arrival.loop`), an ambient module (`slots.ambient.module`)
  and a score (`slots.score.src`). An ambient module exports `mount(host, { theme, signals })` and returns an
  unmount function; it is imported the first time its world is shown, never before.

## What the other phases fill

| Slot | Today | Wanted |
|---|---|---|
| arrival loop | name-art loops at 1280 and 1920 px | engine renders per world, with a 3840 px master |
| ambient module | none | rain and streetlight (night garden), print-run motion (newsprint), live instrument (instrument) |
| score | none (Hum v4 plays on press for every world) | one theme per world, still on press only |
| place leads | the bazaar's loops and stills, `data-slot="render"` on the two living stills | renders, demos, characters |

## Rules a theme keeps

- It stays inside the performance budget: its ambient module shares the three live canvases, so it draws on the
  stage (`world/site/stage.js`) or replaces a slot's video, never adds a canvas of its own.
- Heavy assets load on first show, not with the page.
- Reduced motion gets a settled still; sound never starts by itself.
- Contrast holds in both characters.
