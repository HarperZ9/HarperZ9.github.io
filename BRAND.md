# Project Telos artwork

Use [DESIGN-RULES.md](DESIGN-RULES.md) for the site's visual system. The canonical
website is HarperZ9/HarperZ9.github.io. Neighboring repository artwork is updated
through that repository's own reviewed release, not automatically from here.

## Keep the artwork clear

Keep the product or article title and, when useful, one plain-language
description. Let the artwork carry the atmosphere. Do not add repeated
brand/category eyebrows, slash-separated keyword rails, or corner wordmarks.
Functional diagram labels, source attribution, and legends still belong.

The shared cards use the committed dark palette and halftone sphere.
Publication cards can use Hanken Grotesk for readable titles and descriptions.
The older ceramic card, ghost wordmark, and mandatory eyebrow/pipeline recipe
are retired. Do not use them as instructions for new artwork.

## Generate shared cards

- Template: [img/og/_card.html](img/og/_card.html), a 1200 by 630 card.
- Registry: [img/og/cards-data.js](img/og/cards-data.js).
- Renderer: [tools/render_cards.py](tools/render_cards.py).

Add a registry entry with `word` and `headline`. `publication: true` selects
readable publication typography. Glyphs render only when `showGlyph` is true.
Legacy `role` and `pipeline` fields do not render.

```sh
python tools/render_cards.py --force <key>
```

The renderer waits for fonts and artwork, then applies the existing 256-color
PNG optimization. Inspect the result and verify dimensions, file size, and
relevant media-manifest hashes before publishing. Byte identity across different
browser or font-rendering environments is not guaranteed.
