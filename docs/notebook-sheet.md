# The notebook sheet

This guide describes the shared design layer of the site: the tokens, the page components and the figure sheet. Read it before you add a page, a table or a chart. Every rule here exists so a reader finds the point of a page first, and finds the checking detail when they want it.

## Files

| File | What it holds |
|:--|:--|
| `system/tokens.css` | Every color, type and spacing token, both type families, and the light, dark, forced-color and print values. |
| `system/notebook-sheet.css` | The figure sheet, its chart marks, the key, the notes and "How we know". It imports the next two files, so one link loads all three. |
| `system/notebook-diagram.css` | Drawn diagrams and the chain of custody: nodes, connectors, edge labels, lanes, boundaries, callouts and key swatches. |
| `system/page-components.css` | The reader components around a sheet: masthead, hero, lists, cards, buttons, tables, footnotes and the page footer. |
| `system/reading.css` | The reading type scale and the older page families, now read from the tokens. |
| `system/nav.css` | The site navigation and the route header. |

`reading.css` and `figure.css` import `tokens.css`. A page that loads neither links it directly. Link `notebook-sheet.css` after the page family stylesheet so its components sit later in the cascade. The shared navigation script loads it on pages that do not.

## Tokens

The page ground is a calm off-white in light mode and a deep slate in dark mode. Text is ink. Color means a verdict and nothing else.

| Token | Light | Dark | Use |
|:--|:--|:--|:--|
| `--paper` | `#fafaf8` | `#101416` | Page ground |
| `--panel` | `#f0f3f2` | `#1b2528` | A quiet panel, the body of "How we know" |
| `--ink` | `#19272b` | `#eaf5f6` | Text, links, rules and the primary button |
| `--soft` | `#42575d` | `#b4c5c9` | Dek, meta line and labels |
| `--line` | `#ccd3d3` | `#42555a` | Hairlines |
| `--line-strong` | `#6f7f83` | `#7d949a` | Borders of controls |
| `--verified` | `#08766b` | `#63d4ce` | Verified marks and words |
| `--drift` | `#96401d` | `#e29472` | Drift marks |
| `--unverifiable` | `#55548f` | `#b3b1e6` | Marks and words for claims nobody can check |

A figure sheet has its own ground: a cool paper in light mode and a deep navy in dark mode, with `--sheet-ink`, `--sheet-soft`, `--sheet-hair` and `--sheet-frame` derived from its ink.

The theme works without JavaScript. Light values sit on the root. Dark values apply when the system asks for dark and the reader has not picked Light, and again when the reader picks Dark in the theme menu. Forced colors map every token to a system color. Print uses white paper, black ink and a print verdict set.

## Type

Two families: Hanken Grotesk for words and Conso for code, digests and numbers in table cells. Conso never sets a label, a caption or a breadcrumb.

| Role | Size | Weight |
|:--|:--|:--|
| Page title | `clamp(2.25rem, 1.6rem + 2.6vw, 3.5rem)` | 500 |
| Section heading | `clamp(1.5rem, 1.25rem + 1vw, 2rem)` | 560 |
| Subheading | 1.25rem | 600 |
| Dek | 1.25rem | 400 |
| Body | 1.0625rem (17px) | 400 |
| Takeaway | 1.1875rem (19px) | 500 |
| Label | 0.875rem (14px) at least | 500 or 600 |

Labels use sentence case. Wide-tracked capitals do not appear anywhere. Hanken Grotesk has no arrow glyph, so draw an arrow as an inline SVG in `currentColor`, and write "about" in place of an approximately-equal sign.

## Page components

### Masthead

```html
<header class="masthead">
  <nav class="masthead-path" aria-label="Breadcrumb"><a href="research.html">Research</a> / Who Knew First</nav>
  <h1>Who Knew First</h1>
  <p class="dek">One sentence that says what the reader gets from this page.</p>
  <p class="meta"><span>By Zain Dana Harper</span><span>23 September 2026</span><span>14 minute read</span></p>
</header>
```

The meta line draws a middle dot between its spans, so write each item as a span and leave the dots out. A page with a masthead shows one breadcrumb: the navigation script leaves its own route header off that page.

### Hero

`.page-hero` holds `.hero-copy` and, on a product page, `.hero-art`. Give it one primary action (`.btn-primary`), at most two text links (`.text-link`) and, when the product runs from a command, a `.command-block` with a `.copy-button`.

### Lists, cards and verdicts

A `.row-list` is the default: a title, one sentence and at most one status. Use a `.card-grid` only when each card is a destination; the card title link covers the whole card. Write a status as `<span class="verdict-mark" data-verdict="verified">Verified</span>`. The values are `verified`, `drift`, `missed`, `unverifiable` and `stated`. The glyph carries the verdict in grayscale: solid, hatch, crosshatch, stipple with a dashed edge, and scanlines.

### Tables

```html
<div class="table-wrap" role="region" aria-labelledby="t1-cap" tabindex="0">
  <table class="data-table" data-stack>
    <caption id="t1-cap">One sentence that says what the table shows.</caption>
    <thead><tr><th scope="col">Model</th><th scope="col" class="num">Passed</th></tr></thead>
    <tbody><tr><th scope="row">Model A</th><td class="num" data-label="Passed">141 of 164</td></tr></tbody>
  </table>
</div>
```

Under 40rem a table with `data-stack` shows one record per row. The row header becomes the record title, and each cell shows its `data-label` beside the value, so write each label as a plain word. A table with more than six numeric columns may keep its grid and scroll inside its wrapper; put `<p class="scroll-note">Scroll sideways for more columns.</p>` above it.

### Footnotes, sources and the footer

Cite with `<sup class="fn"><a href="#s3">3</a></sup>`. List sources in `ol.sources` with the title as the link text and `.source-meta` for the publisher and a plain date. End the page with `footer.page-footer` and a `.page-footer-line`; the save-or-print control mounts there.

## "How we know"

Everything a checker needs and a first-time reader does not goes into a closed disclosure.

```html
<details class="how-we-know">
  <summary>How we know</summary>
  <dl class="hwk-list">
    <dt>Does not prove</dt><dd>...</dd>
    <dt>Limits</dt><dd>...</dd>
    <dt>Method</dt><dd>...</dd>
    <dt>Tally</dt><dd>...</dd>
    <dt>Sources</dt><dd>...</dd>
    <dt>Check it yourself</dt><dd><code class="digest">sha256 ...</code></dd>
  </dl>
</details>
```

"Does not prove" always comes first and never leaves the page. Digests, commit ids, seeds, model tags, run ids, file names and timestamps belong in "Check it yourself". The print style opens every disclosure.

The summary "How we know" belongs to a figure or to the page's one evidence record. Any other disclosure takes a name that says what it holds, such as "Release details and fingerprint" or "Why we retired it", so a reader can tell the disclosures apart without opening them.

## Figure sheets

A figure sits on an `article.ns-sheet`. Inside it, in this order:

1. The sheet title, `.ns-title`.
2. The takeaway, `p.takeaway`: one plain sentence that states the finding with its size or count.
3. The key, only when direct labels cannot carry the marks.
4. The figure.
5. A limit line, `p.limit-line`, only when the figure would mislead without it.
6. Numbered notes, `ol.dg-notes`, when the figure has callouts.
7. "How we know".
8. The stamp: the seal, the sheet's real place in its set ("Sheet 1 of 2", or "Figure 6 of 7 in the briefing" with a link to the set) and a plain date such as "Retrieved 26 August 2026". A page with one sheet prints the date alone. The stamp prints no figure id, seed or timestamp.

One figure per sheet, and one hot mark: the aperture ring on the point the takeaway names. A marked line under the figure, `p.ns-marked`, names what the ring marks in a few words, such as "Ringed: the external check.", with the ring as its key; the takeaway already states the finding. A chart whose ringed mark is the only mark of its kind, such as the one model in a comparison, drops the marked line. The ring alone marks the point: a ringed node keeps the same border as its neighbors. The stamp's seal draws its inner rings and open pupil in soft ink, so the ink ring around a dot belongs only to the hot mark. Dark sheets carry no glow around the seal. The ring never sits on a node's corner or border: set it clear of the node on a short leader.

Keep one "How we know" per figure. When a page also needs a record of its own, give that disclosure a name that says what it holds, such as "The full record", and never print the same paragraph in both.

### Charts

Draw a bar as an SVG strip beside an HTML label, so text never scales. Put the value at the bar end, label every reference line in words, and keep color for verdict marks. The 95 percent interval is a capped line in soft ink. When a figure draws several intervals, each one names its low end beside its left cap ("61%"), and a one-item key gives the definition: "the range likely to hold the true score". Every tick label centres on its position, end labels included, over a short tick mark; on a phone the strip and its axis sit in from both edges so the end labels stay inside the sheet. A signed difference is a dot against a full-height zero line labelled "no change"; draw no line between them unless the record holds an interval. Axis captions stay visible at every width, above the ticks on a phone. The mark classes are `m-held`, `m-mixed`, `m-missed` and `m-unk` for verdicts, `m-scan` for a stated quantity, `m-ci` and `m-est` for a rate with its interval, `m-ref` for a reference line and `m-zero` or `m-day0` for a zero line. Pie charts, 3D, dual axes and pictures of tables have no place on a sheet.

### Diagrams

Draw a diagram as inline SVG inside a `figure.dg-figure`, from these parts:

| Part | Class |
|:--|:--|
| Station node (actor, system, record, outside, decision) | `g.dg-node[data-kind]` with `.dg-label` and `.dg-sub` |
| Connector with an arrowhead | `path.dg-edge[data-state]` with `marker-end="url(#dg-arrow)"` |
| Connector label | `text.dg-edge-label` |
| Swimlane | `g.dg-lane` with `.dg-lane-band` and `.dg-lane-label` |
| Boundary region | `g.dg-boundary` with `.dg-boundary-fill`, `.dg-boundary-edge` and `.dg-boundary-label` |
| Numbered callout | `g.dg-callout` with `.dg-leader`, keyed to `ol.dg-notes` |
| Dimension line | `g.dg-dim` with `.dg-dim-line`, `.dg-ext` and `.dg-dim-label` |
| Hot ring | `g.ns-hot` |

The ruling runs under a drawing as it runs under a chart: nodes fill with paper and edge labels sit on paper plates, so no dot crosses a word. Callout numbers run in reading order in both the wide and the tall drawing. Every box keeps at least 25 percent slack over its longest line, so a reader who widens letter and word spacing still sees each label inside its box. Connectors run only horizontally and vertically, and the state of every link is also a word. A process arrow carries no `data-state`; only an evidence link takes a verdict state. A state the source does not define, such as "caution", takes no verdict hue: draw it with a 6:4 dashed ink edge and an ink hatch beside its word, so the only color on the drawing marks a real verdict. Callouts sit clear of the node they number, never on a folded corner or a top rule. An `outside` node draws a double hairline. Each edge label sits on a paper plate, `rect.dg-label-bg`, above or beside its run, never on it. Draw text at 14px or more at the size the drawing renders. Give the wide drawing its natural width in its `width` attribute and the class `dg-wide`, and add a tall drawing, `dg-tall`, drawn at the width it renders on a 360px phone. On the tall drawing, give every side rail its own track at least 24px from the boxes, and set a rail link's words inside the box it reaches. Both drawings carry their own title and description; the sheet shows one at a time, so a screen reader meets one. A drawing whose parts take keyboard focus uses `role="graphics-document"`, because an `img` hides its children; a static drawing keeps `role="img"`. Key only the codes a node's name does not already carry, and put one plain line in the key for any state word the drawing prints. Every node and link also appears in the accessible table or the notes, so the figure reads with the image hidden.

## Checks

Pages with sheets must pass these checks at 390px in light and dark, in forced colors and in print:

- No text below 14px.
- No horizontal scroll inside a sheet.
- Every verdict still reads in grayscale.
- No identifier in the default view.

A passing check shows that the layout holds. It does not show that a figure tells the truth; that rests on the source data and the "How we know" record beside it.
