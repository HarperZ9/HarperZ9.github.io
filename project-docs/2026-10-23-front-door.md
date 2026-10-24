# The front door, 23 October 2026

Internal record. The home page was a long React page of twelve sections (mission, recent work,
Flywheel table, product list, evidence board, pilot routes, figures, live board, graphics,
security, hiring). It is now one entrance: the name, one line, five routes, a generated form and
eight facets. Every other page stays at its address.

## Direction, in the author's words

- 2026-10-23, on Kat the Poet Engineer's gemstone site: "the website design could be really
  improved upon, and we could do something similar but unique and different. it would
  streamline the clutter somewhat as well."
- "Does not have to be a full redesign, it can improve and put everything we already have into
  an interactive multimedia container that can be toyed with by users."
- "Yes, the front door. make the front door open ended, yet streamlined; and artistic and
  immersive."
- "I think the implementation could be made much better, and more interactive, and fun for
  users to play with. The immersiveness, and wackiness should be dialed up considerably. I love
  art, and media." and "I like stuff that is more outlandish, and artisitc/esoteric."
- "I am definitely a surrealistic, supergraphic ultramodern, art deco, and brutalism inspired
  visual thinker."

Kat's site was not studied in detail (the feed note had not landed); nothing of its layout or
gem was copied, and the gem variant lost partly because it sat too close to her idea.

## What shipped

- `home/index.html`: static markup. Without JavaScript it reads as a plain list: name, line,
  routes, eight facets, every panel open, every demo state shown, controls hidden.
- `home/src/*.ts`: about 10 KB gzipped. The facet list becomes a tablist (arrow keys, Home, End),
  one panel opens at a time, deep links (`/#engine`) open a facet in place.
- The form (`form-astrolabe.ts`): an orrery of eight moons, one per facet, on their own rings;
  a rete of glyphs; eccentric almucantar circles; an art-deco sunburst of stepped wedges; a
  brutalist band cut by one notch per facet; an eye at the centre that follows the cursor; the
  chosen moon opens its own eye and looks back.
- Behaviours (`stage-input.ts`, `effects.ts`, `stage.ts`): drag turns the rete and settles on the
  nearest facet; click a moon or glyph to open it; click empty space for a ripple; move fast and
  the scan tears; hold and the rings come apart, release and they reassemble; scroll spins the
  rings; leave it alone and an eight-pointed star draws itself while the eye half-closes; Low
  Water raises a waterline over the form. Hidden mode: click the eye five times, or type
  "eclipse". A generative drone (`sound.ts`) stays off until the visitor presses Sound.
- Supergraphic: room-scale stepped bands sweep in behind the entrance (`front-door.css`).
- Panels reuse existing media and real outputs: Flywheel's captured checker reports (three
  answers, three verdicts), Articulate's example check, Daylight Commons' demo findings (cropped
  from the repo's `docs/demo`, every account invented), BuildLang's `buildc check` output,
  raw-native's reference and shortcut AO frames on a wipe slider, the "Claiming got cheap" film.
- Panel headlines reuse the plain-copy branch (PR #481) where it had them.
- Reduced motion: no drift, no tearing, no ripples, no hold; selections snap; the loop stops when
  settled (0 animation frames while idle, measured).

## Variants and scores

Each variant scored 1 to 5 by rendering it at 1440 by 900 and 375 by 812 in light and dark,
exercising hold, fast cursor, ripple, idle and eclipse in Playwright, and measuring frame rate and
main-thread share under 4x CPU throttle on a phone viewport. Screenshots: `D:/fd-shots/proto`
(local, not committed).

| Criterion | A aperture | B crystal | C astrolabe (shipped) |
|:--|:--|:--|:--|
| Position on the author's axes | ultramodern line and aperture | art-deco facets | surreal, esoteric, deco sunburst, brutalist band, supergraphic |
| Pillars legible at a glance | 3 (opened arc and halftone) | 4 (lit face) | 4 (moon, glyph, beam to the notch) |
| First-time comprehension in 5 s | 4 | 4 | 4 |
| Performance (main-thread share, 4x throttle) | 2 (0.90) | 4 (0.38) | 5 (0.19 to 0.30) |
| Fidelity to the visual DNA | 4 | 2 (a gem, close to Kat's) | 5 |
| Accessibility (same index and tabs) | 5 | 5 | 5 |
| Delight as a toy | 3 | 3 | 5 |
| Total | 21 | 22 | 28 |

All three hold 60 frames per second in headless Chrome. A and B stay in the bundle behind
`?form=aperture` and `?form=crystal` for comparison.

## Measurements

Lighthouse 12, local server, three mobile runs each (simulated slow 4G) and one desktop run.

| | Performance | Accessibility | Best practices | SEO | LCP | Bytes |
|:--|:--|:--|:--|:--|:--|:--|
| Before, mobile | 57 to 62 | 100 | 100 | 100 | 8.3 to 10.0 s | 1,484 KiB |
| After, mobile | 97 | 100 | 100 | 100 | 2.3 to 2.4 s | 209 KiB |
| Before, desktop | 87 | 100 | 100 | 100 | 2.4 s | 1,562 KiB |
| After, desktop | 100 | 100 | 100 | 100 | 0.5 s | 209 KiB |

Home script: 168 KB gzipped before, 10 KB after. axe-core 4: 0 violations in 36 runs (eight
facets, light and dark, 1440 and 375 wide, plus the page with scripts blocked); before: 40
(label-content-name-mismatch). Mobile LCP misses the 2 s target by about 0.3 s; the remaining
cost is the site-wide `tokens.css` and `plate.css` blocking render. Inlining the home sheet moved
it by less than run-to-run noise.

## Tests changed

The old home contracts asserted the twelve sections. They now assert the front door:
`tests/test_portfolio_visual_contract.py` (rewritten), and dated edits in the constellation,
career, deploy sanity, ident, discoverability, copy ground truth, board note, shared release,
sitewide, guides and release-spine tests. `tests/test_home_marketing_funnel.py` and
`tests/test_home_security_platform_parity.py` were removed: the security platforms and figures
live on `catalog.html`, `security.html` and `analytics/`, one click from the Tools route.

## The phase map (facet 00, open on arrival)

Direction relayed from the author, 2026-10-23: "Perhaps more design ideas and concepts could occur
based on this principle... we want the best design, voice, tooling, marketing materials, and
graphics, and to deeply improve upon what has been released. Possibly introduce new aesthetics
entirely." The principle is Tegmark's chart of spacetime dimensions (arXiv gr-qc/9702052, Fig. 1).
Source: `C:/dev/mission-control/2026-10-23-phase-design/` (CONCEPT.md and the index.html prototype).

- Built as `home/src/phase-map.ts`: the prototype's fields, wavy world edge, stamps and grid; the
  eight pillars as dots in the white cell (each opens its facet); four travellers drifting in from
  Trust me, Hype, Too costly and Too simple (half frame rate, static under reduced motion); a
  region click or Enter shows its example with a link to the page it comes from; the sound bell
  answers when Sound is on. The caption carries its own source strip.
- Changed from the prototype: the examples are the site's own outputs (Articulate's blocked
  sentence, Flywheel's uncited and failed answers, BuildLang's lifetime error, the explainer films,
  Articulate's fairness run). The prototype's case-file quotes name real people (a reply author, a
  researcher, a company co-founder) and put them in Hype or Trust me; that needs the author's
  approval per post, so it waits. The stamps use the system serif instead of a Google font, so the
  page loads no third-party font. "Daylight reads a 500-reply thread in 48 ms" was left out: no
  measurement in the repo supports it yet.
- Without JavaScript the panel is a definition list of the eight regions and their examples.
- Measured after the change: Lighthouse mobile 95 to 98 (LCP 2.0 to 2.5 s), desktop 100 (LCP
  0.5 s); axe 0 violations in 40 runs; home script 12.8 KB gzipped.
- Not done from CONCEPT.md: the figure-plate, vanishing-ink and selection-effect aesthetics, and
  the named guides (Ocellus, Still, Rete, Murmur) as travellers; their art is not in this repo.

## Archive collage and the exhibit hall (later the same day)

Author, 2026-10-23, relayed: "the visualization and artwork can be further improved, and made more
explosive, abstract, and creative. Quality, and visual fidelity are massive focuses, as well as the
crossover between digital<->analog". And: "they feel light, low on resource cost, generic, and
lacking original materials and assets from inspirations and reference material media; we have
access to the entire web archive."

- Material, gathered with open-archives on 23 October 2026 (receipts in `E:/archive-library/receipts`,
  shared copies and the full credit records in `C:/dev/mission-control/2026-10-23-phase-design/archive/`),
  all public domain or CC0, credited in `media/front-door/CREDITS.md` and in the page footer:
  - Regiomontanus's brass astrolabe, 1462 (Met, CC0): the scan sits under the line-work form,
    duotoned to ink in light mode and inverted to bone in dark.
  - Ostendorfer's dragon volvelle from the Astronomicum Caesareum, 1540 (Met, CC0): it turns slowly
    behind the form when the visitor leaves it alone; the page's blank margin is the paper the phase
    map is printed on.
  - NASA's 2017 diamond-ring eclipse (public domain): the hidden eclipse mode.
  - Heavenly Bodies, 1920 (Prelinger, public domain): a seven-second low-tide loop for Low Water.
  - Concrete Layers 02 (Poly Haven, CC0): the supergraphic bands, a deco sunrise under the form.
- Left out: a "public domain" paper texture on Commons credited to an image generator (not a scan),
  and every NC, ND, no-known-restrictions or unknown item (the tool held them back).
- Loading: the astrolabe scan loads after the page has painted; the volvelle, the eye and the eclipse
  load only when a visitor first reaches the state that shows them; phones get the 640 px cut.
- Exhibit hall: `home/src/exhibit.ts` registers the rooms (We are here is open; The false balance,
  Palimpsest, Powers of ten and Mirror wait for their sources to be checked and the author's
  approval, so they are not drawn). `loadMedium(name)` imports `/system/mediums/<name>.js` from the
  mediums library once it is vendored and listed in `<html data-mediums>`; the library was not in
  `phase-design/media/` when this shipped, so the phase map uses a local riso pass (wobbled ink edge,
  a misregistered magenta stamp layer, the 1540 paper).
- Voice: the phase map opens on an analogy ("A claim is like a creature: it only survives where the
  conditions let it") and each region asks the visitor a question ("Would you pass it on without the
  source?").
- Measured after the change, Lighthouse mobile 92 to 94, desktop 100; mobile LCP is now 2.6 to 2.9 s
  because the astrolabe scan fading in becomes the largest paint (the text paints by about 1.5 s);
  desktop LCP 0.6 s; 385 KiB on a phone. axe: 0 violations in 40 runs.

## The one emblem

Author, 2026-10-23, relayed: "the emblems do not have to recur everywhere; we want to use them
thoughtfully, and artfully ~ telling subtle stories behind the scenes painted by our words, videos,
and audio". One emblem from SYMBOLS.md is placed on the front door, in the sound only: the drone sits
14 cents flat, the sonic form of the scale with a wedge. Intent: the instrument reads true and sits on
something; a listener who turns Sound on hears it is slightly off without being told why, which is the
phase map's point about checks. No favicon, loader, divider or hover note carries an emblem.

## Grounding pass (CONTRASTS.md section F)

Author, 2026-10-23, relayed: the work must not read as conspiratorial or occult, which "will
dissuade readers from being moved, and allow mistrust or doubt over merit".

- The eye at the centre of the dial is gone. The centre is now the astrolabe's own hub and pin.
  The chosen moon no longer opens an eye, and the 1624 eye engraving is removed from the page and
  the credits.
- The rete's procedural glyphs are now plain numerals, 00 to 08, matching the facet list.
- The eight-pointed star that idle time drew is removed. Idle time now shows Apian's dial, with a
  visible caption naming it.
- Every layer that appears says what it is in a visible caption (the 1540 dial; the 2017 eclipse,
  with its date and photographer). The hidden mode is printed in a "How it plays" list under the
  dial, so nothing reads as a hidden message.
- The phase map, the supergraphic bands and the flat drone were checked against the same rule and
  kept: each is data, a print texture or a sound, and none is presented as a sign.

## Next steps (not shipped)

- Playable demos from the coordinator's list not built here: Daylight "semantic rain" through
  the Reading lens, Articulate's drag between model default and your voice, BuildLang's two
  combat traces with a constant slider, a live painterly raw-native render, Low Water's sacks
  that slow the cursor, the illuminated case page.
- Low Water has no public plate: its repository is private, so the facet uses the form's
  waterline. A spoiler-free still needs the author's pick.
- `https://harperz9.github.io/daylight-commons/` answers 404; `install.html` there works, so the
  facet links to it.
- The form could move to pillar pages as a small header; the stage module is self-contained.
