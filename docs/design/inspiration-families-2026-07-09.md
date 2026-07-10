# Wave-2 style brief: full inspiration corpus, art-mag register

Register: ART MAG, image-led. Plates are heroes; text = captions/standfirsts. No serif-editorial moves.

BOLDNESS MANDATE (operator, 2026-07-09): "make the art even more out there, and exciting."
Do not merely transcribe recipes - COMPOSE them into showstoppers:
- Composite plates: run 2-3 families in one composition (e.g. caustic-veils base + star caustics + databend finisher; obsidian-burst + aurora-leak rim; dendrite-field grown over riso-moire ground).
- The databend-collage treatment is a FINISHER any plate can pass through - use it to destroy/rebuild the strongest compositions.
- Scale: full-bleed plates, one per viewport, not timid strips.
- Interactivity where cheap and deterministic: reseed controls on gallery tiles (draw once per click, no loops); a route+date-seeded "today's plate".
- Motion stays optional texture: slow drift on at most ONE hero plate per page, fully disabled under prefers-reduced-motion, content never gated.
DETERMINISM RELAXED (operator): renders do NOT have to be deterministic - "they can be all sorts."
- Seeded/reproducible plates remain a TOOL (nice for captions like "seed 581543" and the daily plate), not a rule.
- LIVE PLATES are sanctioned: true-random one-offs that never draw the same twice; reseed buttons; plates that respond to pointer/scroll; slow-evolving pieces.
- VARIETY IS THE POINT: the corpus covers many themes and motifs - spread them. Different pages/sections may carry different family moods (pale caustic interstitials vs pulp-nocturne covers vs acid duotone tabs); implement broadly across the 29 families rather than curating down to one look.
Hard constraints that DO remain: AA text contrast, no gradient text, no copied assets, prefers-reduced-motion honored (static frame, never blank), content never gated on art, and no runaway per-frame cost (pause offscreen/hidden; budget rAF loops).


## databend-collage
- members: 8 images
- palette: Per piece one dominant heat + neutrals: oxblood red + sage/bone (skeleton), signal orange + acid lime + B/W (lion), crimson/magenta blocks on black (anatomy head), ink B/W + prismatic CMYK smear (industrial), newsprint grey + sunset orange + storm teal (drift-away pair), candy red + teal stripes (smokestacks), saturated cobalt/orange mirrored (eye-of-creation).
- forms: A single source image (engraving, photo, render) shredded on a coarse rectangular grid: displaced copy-blocks, pixel-sort streaks, plaid fax-noise patches, posterized islands; eye-of-creation adds 4-fold mirror symmetry turning the shred into a mandala.
- texture: Hard block seams, horizontal smear streaks, halftone/fax dither patches, RGB channel fringes, print grain.
- recipe: Self-cannibalize an already-rendered plate (metaball wash, orbit field, or a photo texture): 1) lay a coarse 8x40 grid, for 20-60 random cells drawImage the canvas onto itself from an offset rect; 2) pixel-sort streaks = grab 1px-wide slices at random rows and stretch-blit them horizontally with 'lighter' or source-over at full alpha; 3) fax-noise patches = ordered-dither a noise field into 2-3 small rects; 4) channel fringe = redraw 2 shifted copies clipped to red/cyan via globalCompositeOperation 'lighter' with tinted fills; 5) drop 1-3 flat hot-accent rects; optional finisher: lamp-symmetry 4-fold blit for the mandala variant. ~1-3k ops.
- editorial use: Full-bleed spread dividers and feature openers; the house 'destroyed image' treatment for any photographic asset so photos and generative plates share one voice.

## caustic-veils
- members: 9 images
- palette: Three modes of one fractal-flame language: (a) true black + additive white/cyan/amber/red veils (8un8a0 cross); (b) monochrome black with liquid white loops, spikes and 4-point star caustics (g0m7, 6gcrf4, onvaqzz); (c) inverted paper-white fields with 1-3% grey wisps, almost blank (l1esny, nt2na46, p2z5mha); plus a planet-limb render: black space, cobalt-to-cyan atmosphere glow over ice-white marbled cloud deck, thin white spires (ebfpy7hb, ggcffn1c).
- forms: Long folded light-veils crossing at cusp singularities that bloom into 4-point stars; extreme negative space in every mode; horizon arc in the planet variant.
- texture: Additive glow, silk-smooth gradients, hairline filaments, zero grain.
- recipe: Additive stroke bundles: 30-80 quadratic-bezier ribbons, each ribbon = 20-60 near-parallel 1px strokes at 2-6% alpha with 'lighter', slight angular fan so overlaps read as folded silk; at 2-5 crossings stamp a star caustic (two crossed narrow triangles + radial-gradient bloom, reuse crystal-fragment flare math). Paper mode: same geometry drawn at 2-4% grey-blue on white. Planet mode: huge off-canvas circle; stroke its rim with 20-40 blurred 'lighter' arcs ramping cobalt-cyan-white (shockwave arcs oversized); below the rim, metaball wash in white/ice + ordered dither for cloud marble; pierce with 3-5 tall thin white triangles. 3-8k ops.
- editorial use: Black mode: cover/hero plates. White mode: the breathing-room interstitials this magazine register needs, backing pull-quotes on pale pages. Planet mode: closing plate / back cover.

## chromatic-phantom
- members: 2 images
- palette: Blown-out warm paper (pale pink/grey, near-white) ground; the figure carries all the chroma as teal/amber/indigo and magenta/green aberration fringes.
- forms: A single human silhouette dissolving in motion blur: soft body mass, RGB-split edges, vertical smear; ghost-in-the-machine adds shredded scanline bands and circuit-dash glitch strips at the frame edges.
- texture: Film grain and dust specks on the light field, wet chromatic edge fringes, directional smear.
- recipe: Flat warm-grey ground + dust (sparse ordered-dither specks). Build the silhouette as a stack of metaball-wash blobs on a vertical armature; render the silhouette 3x with 3-8px offsets in teal/amber/indigo at ~40% alpha ('multiply' on light ground) so only edges show fringe; smear = 20-40 repeated 1px-shifted self-blits with decaying alpha (pointer-wake trail logic applied downward); optional glitch strips = one row of the databend block op. ~2k ops.
- editorial use: Full-page portrait plate facing an essay title; also the treatment for 'anonymous contributor' imagery.

## hue-poster-photo
- members: 3 images
- palette: Full false-color remaps: violet/periwinkle + mint dither (trees over building); red-to-yellow-to-green rainbow banding down a hallway; acid green sky + cobalt + red foliage + violet pavement (STOP path). Saturation pinned at gamut edge, hue banded by luminance.
- forms: One ordinary photograph (street trees, corridor, sidewalk) kept compositionally intact but re-mapped into 5-7 luminance-keyed hue bands; small block-glitch strips intrude at one edge.
- texture: Coarse dither between bands, heavy grain, posterization contours.
- recipe: Procedural stand-in when no photo: render any tonal scene (fluid-curl or metaball landscape), then posterize by drawing 5-7 stacked threshold masks each filled with an acid LUT color via 'source-in'; run ordered dither along each band boundary to eat the seams; finish with one strip of databend blocks. Same LUT pass applies directly to site screenshots/photography. ~1-4k ops plus per-band fills.
- editorial use: House treatment for photographic case-study material and full-bleed section wrappers; keeps real-world imagery inside the dark acid register.

## recursive-lattice
- members: 3 images
- palette: Near-black navy ground; cobalt-to-cyan-to-green ramps, one drifting into straw yellow (fractal-curve); pure blue/green on black in the group-table triptych.
- forms: Self-similar lattices: Kronecker-product / group-multiplication-table grids repeating a motif at 3-4 nested scales; Sierpinski-arrowhead triangle aggregates with curled spiral feet; presented as centered plates or triptychs.
- texture: Hard 1px pixel stipple, no AA, moiré shimmer from nested repetition.
- recipe: Kronecker self-blit: draw a 4x4-8x8 binary motif tiny, then for 3-4 levels drawImage the current canvas into each 'on' cell of the motif (hydra-tile recursion, hundreds of blits total); colorize per level with a cobalt-green-yellow gradient via 'source-atop'; ordered dither for stipple. Sierpinski variant: 3 self-blits per level at half scale arranged in the arrowhead transform. 0.5-2k ops, extremely cheap.
- editorial use: Endpapers, folio ornament strips, TOC backing; reads as the magazine's 'mathematical wallpaper'.

## riso-moire-overprint
- members: 2 images
- palette: Black ground overprinted with fluorescent riso inks: red, magenta, cobalt, green, yellow; white halftone dust corners (the eye piece adds a grey airbrush gradient).
- forms: Dense interference: concentric contour rings, arc fans and spiral ridge bundles at offset centers producing moiré beat patterns; dashed orbit rings; tiny scattered glyphs; am5 organizes it all into a giant eye with contour-line iris and pixel-shredded lashes.
- texture: Overprint multiply blends, hairline moiré shimmer, grain, dust-speck gradients.
- recipe: 3-4 'ink' layers: each layer picks one fluorescent color and strokes a family of concentric rings or arc fans (contour-ridge and orbit-field code with center + frequency offset per layer) at ~70% alpha with 'screen'/'lighter' on black; the inter-layer frequency mismatch produces the moiré for free; add setLineDash rings, 20-40 tiny fillText glyph stamps, and an ordered-dither dust gradient in one corner. 4-10k ops.
- editorial use: Chapter openers with gig-poster energy; the loudest plate family, use once per issue-section.

## aurora-leak
- members: 2 images
- palette: True black with one emerald-green light leak; sibling adds a cobalt-blue core. 90% of the frame is empty darkness.
- forms: A single off-center vertical wisp of light, curling like aurora/silk under long exposure; faint secondary haze arcs.
- texture: Soft additive bloom, filament strands inside the wisp, subtle sensor grain.
- recipe: 3-5 fluid-curl guided polylines, each rendered as 40-80 layered 1px strokes at 1-3% alpha 'lighter', width tapering along length, hue locked (emerald or cobalt); one large soft radial-gradient bloom behind the brightest node; leave everything else black. Composes fluid curl + pointer-wake trail rendering. 2-4k ops, the cheapest family here.
- editorial use: Full-bleed rest spreads and masthead/hero backdrops; the negative-space counterweight to the loud families.

## fiber-terrain
- members: 1 images
- palette: Deep plum/black ground; magenta-pink and straw-gold fiber strata; teal/green sea band at the foot; white hairline overlays.
- forms: Eroded canyon arches built from millions of flow-aligned fiber streaks; negative black voids punched through; loose white polyline contour meshes and jagged seismograph lines floating over the terrain.
- texture: Directional fiber grain (dry-brush feel), dense particle stipple, crisp 1px white wireframe on top.
- recipe: Advect thousands of short 1-2px strokes along a horizontally biased fluid-curl field, color ramp plum-pink-straw by depth band (fluid curl at high particle count); punch 1-2 arch voids with destination-out ellipses; overlay contour-ridge output drawn as jittered white polylines and sparse quad meshes; footer band = second curl pass in teal. 5-10k ops, top of budget.
- editorial use: Full-bleed spread divider; strong horizon logic leaves a clean top third for standfirst type.

## obsidian-burst
- members: 1 images
- palette: Achromatic: black ground, gunmetal greys, hard white shards.
- forms: Central radial explosion of glassy black debris and tendrils flying toward the corners; dotted circuit-trace lines and small mechanical rings embedded in the wreckage.
- texture: Wet-chrome speculars, motion streaks, fine dotted overlays.
- recipe: Shockwave field as destruction: emit 200-400 crystal fragments (existing fragment shapes) along radial velocity vectors from an off-center origin, scale/stretch by radius for motion smear, fill black with white edge-light on one side; add 10-20 dotted arc/line paths (setLineDash) and a few concentric ring stamps; final pass of 1px white specks along fragment edges. Composes crystal fragments + shockwaves. ~2-4k ops.
- editorial use: Single dramatic plate for a 'breaking/failure' themed feature; also a strong 404/error-page hero.

## isometric-megastructure
- members: 1 images
- palette: Periwinkle blue, gold/bronze filigree, orchid pink, cyan highlights, near-black shadow pockets.
- forms: Impossible isometric temple-city of stepped cuboids, every face wearing a different dense pattern (stripe waves, mazes, marble contours); one tiny human at a glowing arcade console as scale anchor.
- texture: Flat vector faces filled with micro-pattern; no gradients except the focal glow; ornamental horror vacui.
- recipe: Iso lattice walk: place stepped cuboid modules on an isometric grid (three parallelograms per box); clip-fill each face from a pattern library built from engine parts, hydra-tile truchet mazes, stripe fields, contour-ridge marble, ordered-dither speckle; darken faces by depth for AO; reserve one golden-section cell for a glowing focal sprite. 1-3k faces x cheap pattern fills stays in budget as a hero-only plate.
- editorial use: Cover plate or centerfold; the one maximalist 'world' image an issue can afford.

## plotter-plates
- members: 2 images
- palette: Cream/bone paper cards, single ink each: graphite-navy hairlines; pink-red radial spokes on ecru.
- forms: Contour-studies: a 3x3 grid of physical-looking cards, each with 80-120 horizontal hairlines displaced by one ridge/plateau bump (Joy-Division-adjacent but single-landform). Corona: a pure ring of 300+ radial spokes with interference shimmer around a clean hole.
- texture: Pen-plotter line weight, ink pooling where line slope steepens, paper white, drop shadow of the physical card.
- recipe: Direct extension of contour ridges: card = cream rounded-rect with soft shadow on the dark page; draw N horizontal 0.5px polylines, displace y by a single plateau/gauss kernel with per-line decay (lines above the ridge crest compress, below flow around); increase stroke alpha where |slope| is high to fake ink pooling. Spoke plate: 240-400 1px radial lines inner-radius to outer with tiny angular jitter, one warm ink. Batch 4-9 cards per sheet. 1-5k ops.
- editorial use: The most editorial family in the chunk: margin specimens, folio ornaments, contents-page figures, 'lab notebook' sidebars. Light plates that give the dark site its magazine paper moments.

## decalcomania-rust
- members: 1 images
- palette: Near-black ground, oxblood/rust reds, bone/parchment highlights, cold steel-grey passages, white dendrite frost in the corners.
- forms: Two facing skull-like masses pulled apart around a dark central seam; bilateral but imperfect; filament tendrils radiating outward like pulled paint.
- texture: Decalcomania/monoprint: stringy pulled-pigment filaments, blotting, heavy grain, crackle edges.
- recipe: Lamp-symmetry 2-fold (vertical axis with jitter so the mirror is imperfect): build the mass from metaball-wash blobs, then coat it with thousands of short 1-3px strokes advected by curl noise and colored rust/oxblood/bone by local density (fluid curl as bristle pass); vignette edge-darkening; corner dendrites = short DLA-style random-walk dot chains in white. 4-10k ops.
- editorial use: Frontispiece for the darkest chapter; obituary/post-mortem essay opener.

## acid-duotone-collage
- members: 10 images
- palette: Paired near-complements at full chroma: tangerine/mint (~#ff8a00 + #7dffc4, oklch 0.75 0.19 55 / 0.9 0.15 160), violet/acid-lime (#5b2fd6 + #b6ff2e), magenta/ember (#e0489a + #ff6a1f), salmon/spring-green (#f2917a + #6cff7e), sulfur yellow-green on black (#d6e33b + #0c0c05). Always exactly 2-3 inks per plate.
- forms: One-artist poster series: found-photo figures (Sisyphus with a globe, tug-of-war suits, horse and rider, seal, skull knight) posterized into a duotone, dominated by giant mirrored Celtic-knot/calligraphic monograms, type warped along arcs or stacked vertically, corner ornament stamps, one acid-tinted object scan (translucent PS2 jewel case). Symmetric emblem sits over a deep-perspective photo ground.
- texture: Coarse film grain everywhere, hard posterization banding, neon double-outline glow on knotwork (dark core + bright halo), drippy spray-paint edges on some emblems.
- recipe: Duotone gradient-map pass: render any existing field (metaball wash, contour ridges, orbit field) to luminance, quantize to 3-4 bands, map bands to the two-ink ramp; add ordered dither + random speckle (~1-2k ops) for grain. Knot emblem: 6-12 cubic bezier strands drawn through lamp-symmetry mirror ops (2-4 fold), each stroked 3x (wide dark, medium ink, thin bright halo) = a few hundred ops. Type-on-arc as stroked path text. Corner stamps = the same knot generator at small scale. Composition = emblem centered upper two-thirds over the banded field.
- editorial use: Cover plates and chapter openers — this is the loudest register; one per section. The knot-monogram generator doubles as a recurring folio ornament/brand mark in margins.

## stellated-lantern
- members: 14 images
- palette: Warm 2700K ivory/amber glow (oklch 0.9 0.08 85, #f4e3bd core to #c9a05a mid) with grey-blue translucent shadows (#9aa3ad), on absolute black void (#000). Single hairline cord in bone white.
- forms: Photographed 3D-printed pendant lamps: stellated polyhedra, hexagram bipyramids, rosette/flower balls, faceted pillows — every one built from a single wedge repeated by N-fold radial + mirror symmetry (N=4..8), with nested self-similar layer stacks and fringed sawtooth edges. One centered object, hung from a visible cord, vast black negative space.
- texture: Backlit translucent vellum layering — luminance rises toward the core and where fewer layers overlap; crisp die-cut edges; stair-step fringing at tips; soft bloom around brightest apertures.
- recipe: This is the engine's lamp-symmetry op as a hero object. Draw ONE wedge offscreen: 8-20 nested closed polylines (petal/chevron profiles shrinking inward), each filled at alpha 0.06-0.12 in warm white; rotate-copy/mirror N times around center (total ~1-3k ops). Add a radial point-light gradient multiplied from center, additive bloom on top 5% luminance, jittered sawtooth displacement on outer contours, and one vertical 1px cord line. Vignette to pure black. Vary the wedge profile + N per render for the series feel.
- editorial use: Specimen plates — object-on-velvet pages. Ideal chapter openers for the dark site register, or a repeating right-page 'plate' series with folio captions like a lighting catalog crossed with a mineral atlas.

## pixel-sort-ruin
- members: 8 images
- palette: Three keys: magenta-on-black (#e14bd2 sky, #f0a0c8 brick, #1a0a18 shadow); ember-vs-slate (#ffb43c / #f8e27a fire against #5a6b80 blue-grey lattice); and silver/ice/lilac monument on black (#dfe8ee, #a8c8d8, #c9b8ec, #0a0a0a).
- forms: Architecture dissolving into machine artifacts: Victorian facades and burning houses smeared into directional block-runs; the logic-plague variant folds the shredded raster into a bilaterally mirrored totem/cathedral floating on black.
- texture: Pixel-sorted runs, stair-step block quantization, scanline shred, JPEG-like chunk edges; luminance kept photographic underneath the damage.
- recipe: Seed a base field (metaball bands or a simple gradient 'facade' of rect windows, ~500 ops). Sort pass without sorting: march columns/rows and, wherever luminance crosses a threshold, draw an elongated rect (2-8px wide, 20-200px long) sampling the color at the run start — pointer-wake or shockwave displacement can drive where thresholds break (~2-4k rects). Stagger run lengths by noise for the smeared-brick look. Monument variant: render half, mirror horizontally, add a vertical silver core gradient. Keep exactly two hue axes per plate.
- editorial use: Full-bleed spread dividers between essays; the mirrored monument variant works as a section frontispiece. Ember/slate key pairs well with pull quotes knocked out in bone white.

## fiber-strand-fields
- members: 4 images
- palette: Near-black grounds; strand inks in periwinkle/cyan (#7f8fd8, #5fd8d8), marigold/amber (#e8a83c), violet (#7a5fd0), teal-to-scarlet thermal center (#48d8c8 -> #d83028); mainframe adds a bone-white quad net (#e8e4da) over brick red/teal ribbon striations.
- forms: Tens of thousands of hair-fine polyline trails: all-over scribble curtains with vertical gravity falls (kbo3), a radial density bloom with a hot core (wyf8), a shaped attractor sash with negative space (nqd928), and striated ribbon terrain caged under a coarse white wireframe quad-net (mainframe).
- texture: Additive hairline strokes, moiré interference from parallel falls, density-as-luminance; grain-free but optically vibrating.
- recipe: Extend fluid-curl: seed 1-4k particles, advect each 20-80 steps through a curl-noise field with a constant downward gravity term, stroke each trail at alpha 0.04-0.1, 0.5-1px (2-8k ops total). Color by field angle or by distance from a hot center (thermal LUT). Shaped variant: mask particle seeding to an attractor band (two lobes + a diagonal sash) and let trails fall off its silhouette. Wireframe variant: overlay a 20x30 quad lattice displaced by contour-ridge noise, stroked white 1px — instant 'mainframe' registers.
- editorial use: Deep background washes behind the feature well — text sits directly on the dark negative space. The wireframe variant is a natural fit behind technical/data essays; the thermal bloom crops beautifully into wide thin banners.

## woven-comb-lattice
- members: 2 images
- palette: Smooth vertical gradient amber -> olive -> sage (#d08a28 -> #a8a040 -> #9ab878), strokes in near-black ink (#151208).
- forms: All-over irregular basket weave: fat rounded-cap strokes stamped in a jittered grid, alternating horizontal/vertical with over/under gaps, wandering S-curves breaking the grid, small triangular shard debris in the gaps. No focal point — pure field.
- texture: Bold matte ink ribbons with paired parallel edges (comb-like double lines), chipped/torn shard flecks, clean smooth gradient showing through.
- recipe: Sibling of groove-marble's comb pass at 10x scale: lay the vertical gradient (1 op), then stamp ~600-1200 rounded-cap strokes on a jittered 30-40px grid — each stroke a short 2-4 segment polyline, orientation alternating H/V with 20% wandering diagonals, stroked twice (fat dark core + thin inner gap line) for the comb-tooth read. Skip cells randomly (15%) for weave gaps; scatter ~200 small black triangles along stroke ends. Works as a drop-in hydra-tile/CA-weave cousin.
- editorial use: Endpapers and wallpaper texture; margin filler behind pull quotes and tables of contents. Reads as woven cloth at page scale — a tactile counterpoint to the glossier families.

## deep-fractal-plates
- members: 4 images
- palette: Four keys: plum/rose satin with cobalt filaments (#c058a8, #e89a78, #4858c8) on black; bone-teal fog interior (#c8d8d4, #8aa8a0); slate-blue gothic city with white god-rays (#3a4a60, #e8f0f8); gold filigree on black-olive (#e8b820, #3a3a08).
- forms: Deep-zoom fractal renders with photographic depth: Mandelbrot satin spirals, a Mandelbulb bone-lattice interior with a glowing portal, an aerial fractal cathedral city under volumetric light shafts, and a golden spiderweb/gnarl of spiral rosettes. Recursive self-similar detail at every scale, strong atmospheric perspective.
- texture: Smooth satin shading, volumetric fog, glinting filament highlights — no grain, no strokes; rendered-3D surface quality.
- recipe: True Mandelbulb depth blows the op budget — treat these as raster backplates. Loose 2-10k-op emulation when needed: 3-5 nested orbit-field spiral bundles (log-spiral stroke bundles, 60-150 strokes each, satin = 3 parallel offset strokes light/mid/dark), a metaball-wash fog layer between depth bands, and ONE diagonal light shaft (low-alpha white triangle stack, ~100 ops) over contour-ridge 'city' silhouettes. Gold-web variant: circles-on-circles orbit field stroked in 2px gold with bloom on crossings.
- editorial use: Full-bleed 'establishing world' spreads and feature dividers — the cinematic register. Run one per feature max; caption like an expedition photograph to fit the magazine voice.

## ifs-light-veil
- members: 2 images
- palette: White/silver gauze (#f0f0ea at 2-6% alpha, accumulating to blown white) with faint prismatic fringes (rainbow chromatic noise: subtle #ffd0a0 / #a0c8ff / #c8ffb0 separations) on pure black; 70%+ of canvas stays empty.
- forms: A single vertical column or diagonal beam of folded translucent light sheets — long-exposure silk. Letterboxed, monolithic, centered; the low-rez variant is a grainy prismatic streak crossing the frame corner to corner.
- texture: Additive accumulation glow, silk-fold caustic ridges where sheets overlap, heavy sensor grain on the dim variant.
- recipe: Chaos-game IFS on the existing additive path: 3-4 affine contraction maps arranged to fold points into a tall column; iterate one point 30-80k times plotting 1px rects at alpha 0.02 (cheap ops), or budget version: 1-2k long vertical bezier strokes jittered inside the column envelope at alpha 0.03. Offset R/G/B passes by 1-2px in different directions for the prismatic fringe; add fine speckle grain for the low-rez variant. Composable with shockwaves as the beam's 'source event'.
- editorial use: Section dividers and the hero backdrop behind a single headline — the most typographically generous family (all that black). Also works as a repeating spine/gutter glow motif across a multi-page essay.

## dendrite-field
- members: 2 images
- palette: Deep navy/ink grounds (#0a1240, #05080e); thermal accretion ramp yellow core -> cyan -> deep blue (#f0e040 -> #40c8e8 -> #1a4a90) with scarlet drip streaks (#d02818); sparse variant in cyan/red anaglyph dust (#88c8e8 / #c84040).
- forms: Diffusion-limited-aggregation growth: a dense coral/fur cap radiating from a bright center with red streaks falling from its underside like roots; the sparse variant is a near-empty constellation of speckle clusters with one tiny six-fold dendrite seed at center.
- texture: Pixel-granular branch tips, stair-step aliasing (proudly low-res), vertical drip trails, blue-noise speckle.
- recipe: DLA-lite within budget: launch ~2-4k random walkers from a ring, stick on contact with the cluster (cap each walk at ~200 steps, grid-hash for contact), plot each stuck cell as a 2-3px rect colored by accretion age along the thermal LUT. Underside pass: from the cluster's lower silhouette drop 100-300 vertical polylines in scarlet with decay alpha. Sparse variant: scatter 400 blue-noise speckle clusters, draw R and B channels 1px apart, grow one 30-walker dendrite at center. Natural sibling of contour ridges + orbit fields.
- editorial use: Margin specimens and folio ornaments — reads as scientific plate (coral, frost, culture dish). The sparse anaglyph variant is a quiet full-page interleaf between dense spreads.

## riso-mascot
- members: 3 images
- palette: One flat spot-color ground per plate — cobalt violet-blue (#5058c8), billiard green (#1a6a30), warm bone (#e8e4d8) — plus burnt-orange display ink (#e87018) and a grey halftone photo layer (#b0aca4 range). Traffic-cone orange/white as recurring prop accent.
- forms: Single centered mascot (elephant seal) as a grainy photo cutout, one enormous 4-letter blocky headline (NEIL) behind or above it, traffic cones as props; poster series discipline — same type, same signature mark, rotating ground color.
- texture: Risograph grain: coarse dither on the photo, chalky eroded ink edges on the type, flat untextured ground.
- recipe: Riso pass as a reusable finisher: take any photo/shape layer to luminance, apply the engine's ordered dither at coarse cell size in ONE ink over the flat ground; erode the display type by multiplying it with a speckle mask (~500 ops); add 2-3 cone props as simple striped triangles with the same dither. The whole look is 3 layers: ground fill, dithered subject, giant type.
- editorial use: Humor interludes, back-cover plates, and merch/promo spots. Its flat-ground + giant-type grammar is also the template for the magazine's own section mastheads if you want one moment of warmth in the dark book.

## xerox-anatomy-collage
- members: 1 images
- palette: Bone/off-white ground (#ece8dc) with rust/coffee stains (#b06028 at low alpha), black engraving ink, and RGB neon contour scribbles (#e83048 / #30c848 / #3048e8) plus a CMYK-noise patch where the skull dissolves.
- forms: Bright-field collage: an annotated anatomical skull/jaw engraving (numbered callouts 5-13 with leader lines) colliding with a diagonal cascade of photocopied tile fragments; topographic contour doodles in RGB offsets bleed across the seam.
- texture: Xerox banding and moiré halftone inside each tile, threshold crunch, stain blotches, hand-drawn contour scribble.
- recipe: Tile-grid pass: dice a source field into 40-80 rects, re-render each with the ordered dither at a different threshold/scale (some inverted) and slight offsets — the misregistration IS the xerox look (~2-4k ops). Overlay contour ridges stroked thin and drawn 3x with R/G/B offsets. Stains = 2-3 rust metaball washes at alpha 0.08. Finish with numeral annotations + dotted leader lines. The only bright-field family — keep the ground paper-white, not grey.
- editorial use: Feature-well openers and in-body illustration — this is the most 'magazine' family of the chunk: it reads as an editorial diagram. Use as the light-page counterpoint that makes the dark spreads feel darker.

## acid-western-tableau
- members: 8 images
- palette: Acid pink sky #e888b8, teal cloud #2e8f8a, cobalt #1c50d8, oxblood/rust desert #7a2e1d/#b4551f, bone #e8dcc8, one plate in pure blood red + black + white (#c81414/#0a0a0a/#f5f0e5), giant sun orange #e86018
- forms: Low flat horizon, one lone silhouette (rider, walker, standing figures in water), one oversized celestial or cloud mass dominating the sky, occasional nested-frame tunnel (arch within arch within arch); extreme figure-to-void scale contrast
- texture: Film grain and halftone moiré over photographic tonality; woven-line sky shading on one plate; soft long-exposure ghosting on another; sun-bleached print fade
- recipe: COMPOSE: (1) horizon line at 70-80% height; below it, contour-ridge terrain in oxblood filled with ordered dither. (2) One giant disc (radial gradient orange-to-crimson, ~40% of canvas width) or a metaball-wash cumulus mass (30-60 metaballs, cream fill, dark under-shadow band). (3) Sky = two-stop duotone gradient (acid pink to teal) with the existing ordered-dither pass at coarse cell size for the moiré weave. (4) Stamp 1-3 black silhhouettes from a tiny path library (rider, hat-man, standing figures) with mirrored reflection strokes if water. (5) Optional nested-frame op: 3-4 concentric rounded-rect frames, each filled from the terrain palette, lamp-symmetry style, with the silhouette in the innermost window. (6) Finish: 1-2k grain specks + slight vignette. Total ~3-5k ops
- editorial use: Chapter openers and narrative pause plates; the lone-figure scale drama gives each section a cinematic establishing shot

## grain-veil-overlay
- members: 3 images
- palette: Teal #207878, hot pink #e06888, amber disc #e09030, muted forest gray-green #4a5a50, RGB stripe primaries at low luminance, prairie plate: teal night sky #1a5a60, coral pink #e0788a, golden field #d8a040, near-black vignette #101014
- forms: A photographic-feeling duotone scene (street, forest, prairie sunset) with exactly ONE oversized vector overlay: a giant circle plate that inverts/shifts the field inside it, a full-height mirror seam, or a hairline spiderweb; edges carry glitch-block damage; composition is scene + single geometric intervention
- texture: Heavy uniform film grain, dust specks and hairline scratches, RGB channel separation turning verticals into barcode stripes, corner datamosh crumble
- recipe: COMPOSE: (1) generate a banded landscape from metaball washes/bands + contour ridges, graded through a 2-3 stop duotone LUT (teal/pink/amber). (2) Channel-separation pass: re-stroke vertical features three times in pure R/G/B offsets at 2-6px, 'screen' composite (this is the quiet-error barcode look). (3) The single overlay op, one of: (a) giant circle mask inside which the same field is re-drawn hue-rotated or luminance-inverted; (b) vertical mirror: redraw left half flipped with slight tint drift; (c) hairline web/wireframe: 12-20 radial spokes + concentric sag curves in 1px bone-white, ~10% opacity edges. (4) Grain: 2-4k single-px specks + 20 long scratch strokes + corner block-shuffle damage. Total ~4-8k ops. Extends the existing ordered-dither and pointer-wake passes naturally
- editorial use: Margin specimen and half-page figure; the single-intervention grammar reads like an annotated plate, which suits the editorial register perfectly

## void-apparition
- members: 4 images
- palette: True black ground #000000, white bloom core #ffffff, spectral RGB fringe dispersion, electric blue halo #2060ff, hot orange sector #e07818, neutral gray shard debris #888888
- forms: One centered luminous phenomenon on an otherwise empty black field: a disc rendered as vertical dashed columns; a neon annulus/eclipse ring with a scanline horizon slicing through it; a starburst with a razor-thin vertical prism slit; ghostly additive rectangles threaded by an elliptical wire loop. Achromatic planar shard clusters orbit the light (kinship with neoexpressionist-facets)
- texture: Pure additive glow, hair-thin 1px spectral lines, particulate dissolve at the bloom edge, matte gray fills on the shards, zero grain on the black itself
- recipe: All 'lighter' composite on black: (1) radial-gradient bloom (2-3 stacked, white core to blue/orange rim). (2) Disc-of-dashes op: vertical 1-2px dashed columns clipped to a circle, dash density ramped by distance from core (~400-900 strokes) - a scanline-halftone disc pushed into pure additive glow. (3) Ring op: stroke a thick annulus with blurred multi-stop gradient (blue/white/orange sectors via arc segments). (4) Prism slit: 30-80 vertical 1px lines hue-stepped through the spectrum, tightly packed at center. (5) Horizon debris: one row of short RGB-offset horizontal dashes (reuse shockwave/scanline code). (6) 20-60 flat gray quads/shards from the crystal-fragment engine at 40-70% gray, plus one 1px ellipse wireframe. Total ~1.5-3k ops
- editorial use: Cover plate and dark section dividers; the emptiest, most confident register in the chunk - front-of-book material and full-screen loading/hero states

## pulp-cover-nocturne
- members: 3 images
- palette: Oxblood red #a02818 flooding to black #181214, violet-gray body #8a7a98, bone highlights #e8d8b8, warm white star flares; violet-neon variant: lavender glow #b070e8, pink core #e878b8, teal scratch accents #308878 on black
- forms: Portrait-ratio paperback plates: one celestial body or neon organism (tilted rings over a moon, a flaring spire, a coil-ring plus a ridge-line waveform creature) hovering over rippled water reflection; 4-point star sparkles at highlights; thin rectilinear circuit-trace frame lines hugging the edges
- texture: Coarse ordered dither / risograph dot lattice over every gradient (red pair), or dense film grain over additive neon (violet plate); horizontal ripple displacement in the reflection zone
- recipe: COMPOSE with the existing ordered-dither pass as the star: (1) radial red-to-black gradient ground, dithered at coarse cell. (2) Subject op, one of: (a) disc + 2 elliptical orbit rings (orbit-field code, stroked thick, dither-shaded); (b) vertical flare spire: tapered additive column with hyperbolic base curves (reuse shockwave falloff); (c) coil ring: 20-40 concentric ellipses tightly stepped + a contour-ridge bundle (30-60 horizontal ridgelines with a bell-curve envelope) forming the wave-creature. (3) Reflection: re-draw subject below the waterline through row-wise sine displacement, rows thinning with depth (~300-800 short strokes). (4) 3-6 four-point sparkles: two crossed tapered lines + small radial bloom. (5) 1px rectilinear frame traces with 2-3 right-angle jogs. Total ~2-5k ops
- editorial use: Folio ornament and margin specimen: run them small as faux paperback covers in a column, or as recurring end-of-article colophon plates

## nocturne-bokeh-frost
- members: 1 images
- palette: Indigo night #282050, violet wash #7858a8, warm bokeh gold #f0d890, neon smears in magenta/green/cyan, frost white #e8e8f0
- forms: Rain-soaked street receding to a bright center, storefront lights dissolved into stacked bokeh orbs, vertical neon smear columns, mirrored reflection field on wet ground; heavy white frost/scratch mottling closing in from the edges like a frozen window
- texture: Painterly wet-on-wet blur, vertical drip streaks, crystalline white speckle vignette, luminous core against crushed dark corners
- recipe: COMPOSE: (1) dark indigo gradient ground. (2) Bokeh field: 60-150 soft radial-gradient discs (metaball-wash code, 'lighter'), warm gold near center, colored at edges. (3) Vertical neon smears: ~200-400 thin translucent vertical strokes sampled from the bokeh colors, longer near center (pixel-sort kinship, soft variant). (4) Reflection: mirror the lower third with row-jitter and reduced alpha, then comb it with short horizontal wobble strokes (fluid-curl or pointer-wake pass works). (5) Frost vignette: threshold high-frequency noise near edges into 1-3px white specks and dendrite scratch polylines, ~1-2k specks, density falling toward center. Total ~3-5k ops
- editorial use: Full-bleed atmospheric spread behind an essay opener; the dark edges give generous safe zones for overlaid standfirst text

## moire-swirl
- members: 1 images
- palette: Black ground #000, magenta #d81878 through red-orange #e04818 to amber #f0a018, cream-yellow core #f8e8a0
- forms: Nested crescent ribbons spiraling into an off-center core, each ribbon a fine crosshatch mesh of two crossing line families; positive-negative gaps between crescents; comet-tail wisp exiting lower left
- texture: 1px hairline mesh, moiré shimmer where line families cross, additive brightness where mesh compresses, velvety black elsewhere
- recipe: EXTEND orbit fields: define a logarithmic spiral spine with 3-4 nested offsets. For each crescent, draw two families of ~60-120 hairline polylines: family A sweeps along the spine with sinusoidal normal offset, family B same but phase-shifted ~90 degrees and slightly different frequency so the crossing creates moiré. Hue = arc-length along spine (magenta at tail, yellow at core); 'lighter' composite at 15-30% alpha so crossings bloom. Taper stroke spacing toward the core for the hot center. ~2-6k strokes total, one pass, no fills
- editorial use: Chapter opener or dark folio ornament; also the natural candidate for a subtle animated version (phase-drift the B family) as a section hero

## caustic-bloom
- members: 1 images
- palette: Peach #e8c8a0, cream #f0e8d0, dusty pink #c890a8, slate teal glints #78a0a8, dark umber vignette #201810
- forms: 7-fold symmetric interference flower: standing-wave bands radiating from a heptagonal core, petal lobes where wavefronts reinforce, everything melting into a soft dark frame
- texture: Heavily defocused - every band is a soft gradient, no hard edge anywhere; faint chromatic fringing on band edges; museum-glass calm
- recipe: COMPOSE lamp symmetry + wave sum: in one 51-degree sector, evaluate a sum of 3-4 radial cosine waves (different frequencies/phases) along ~40-80 sampled contour bands; render each band as 4-6 overlapping low-alpha thick strokes (stacked strokes = free blur, no filter needed); tint by wave amplitude (cream peaks, pink troughs, teal at nodes). Mirror/rotate through the 7 sectors with the existing lamp-symmetry op. Dark radial vignette last. ~2-4k strokes. A defocused sibling of the contour-ridge engine
- editorial use: Quiet background wash behind mastheads and pull-quotes, or a small folio ornament; the only soft-focus voice in the chunk, useful for pacing between harsh plates


# Survey notes

- chunk1: Non-generative items and their design lessons: (1) critical-mass-by-frank-heiler-myself-oil-on-canvas-v0-mlais4s9knbh1.webp is a photographed OIL PAINTING; folded into neoexpressionist-facets as composition/palette reference only (light cone pinning a figure + planar architecture + single red vertical validates that family at painterly scale). (2) a-new-drawing-of-mine-v0-tapnda7w2w8h1.webp is an airbrushed graphite surreal figure drawing, not procedural; lesson: a grayscale figurative art plate with ONE hyper-rendered focal detail (the eye in the chest) reads as a fine-art interlude, ideal recurring guest-art slot, and is duotone-safe. (3) b5eghhqe5ybh1.png is a Lionel Messi sports poster, 

- chunk2: NON-GENERATIVE ITEMS AND THEIR LESSONS. (1) qiqksv4hahbh1.jpeg is a hand-painted neo-expressionist canvas (signed 'Heiridiane 26', acrylic on linen — two venetian-red figures with a black bird, white gesso outlines): not generative art. Its lesson feeds the in-flight neoexpressionist-facets family: one fully saturated figure color (venetian red) locked against a muted olive/ochre ground, all energy carried by white/black outline calligraphy — a concrete model for the 'one hot accent' rule and for stroke-jitter that looks handmade rather than noisy. (2) The 14 stellated-lantern images are PHOTOGRAPHS of physical parametric lamps, not canvas output — but they map 1:1 onto the engine's existing

- chunk3: Non-generative material and its lessons: (1) Several acid-western members are film stills or staged photography rather than code: pa79wacewvbh1 is a film frame (El Topo-register rider with umbrella and a framed portrait in the dunes), wu1sdxccwvbh1 is red-filtered figure photography, m41gigtfwvbh1 is a long-exposure ghost-rider photograph, lcql8l2fwvbh1 is a Magritte-style nested-arch photo collage, m3zwlvkgwvbh1 and m7sau9e6wvbh1 are posterized photo collage. Lesson: they contribute composition grammar, not texture - lone figure against void, tunnel framing via nested frames, one oversized sky object, horizon at extreme height; the family recipe translates that grammar procedurally. (2) zew
