// districts.mjs: the road's content, district by district, built from the reference library's world (world.json).
// The library's path order is a greedy walk; these districts reshape it by hand for the journey, one theme each,
// descending through the strata within a district where the places allow. Each stop names:
//   lead    the world place it stands on (its stratum is the depth)     rule    the world rule drawn in force, if any
//   bridge  the bridge it rides; a "bridge" move walks it stone by stone  leave   bridges a junction offers onward
//   clock   the place's own time (a name, or a weighted mix such as { even: 0.3, hum: 0.7 }); steps: its held steps
//   form    the shape its element takes when it travels (lib/carry.js FORMS)
//   move    unravel | mosaic | sheets | bridge | junction | picture | law   (what it leads with)
//   plate   a public-domain or CC0 picture from the exhibit's cleared set (credits in the index), with its alt text
//   draw    the drawing for a stop without a picture (lib/laws-draw.js)   medium  thin | water | viscous (the FLOW ground)
//   text    one sentence; branches: [{ href, label }] at a junction
// Colours: ink and wall per district, accent as the one hot mark; tuned by eye.
const P = (slug) => `exhibit/assets/img/${slug}-s.webp`;

export const DISTRICT_DATA = [
  {
    id: "water", title: "Water and fluids", temperature: "cool", ink: "#1f3d5c", wall: "#e6ebe8", accent: "#3b7f8f", medium: "thin",
    stops: [
      { id: "ink", title: "Ink", clock: "sqrt", steps: 6, form: "drop", move: "unravel", lead: "ink", rule: "law-diffusion", bridge: "drop",
        text: "A drop lands and soaks outward; its ring grows as the square root of time.", labels: { motion: "The ribbon unrolling" } },
      { id: "ink-in-water", title: "Ink in water", clock: "even", steps: 6, form: "tile", move: "mosaic", lead: "surface-tension", rule: "rule-andamento-follows-form", bridge: "front",
        text: "Ink floated on water keeps every turn of the current; marbled paper is that water, lifted off.", labels: { motion: "Marbled paper seen through moving water, uncovered tile by tile" } },
      { id: "layers", title: "Layers of water", clock: "even", steps: 4, form: "stroke", move: "sheets", lead: "layering", rule: "law-overprint-absorption", bridge: "sheet",
        text: "Ground, current, picture and count, printed one over another; lift them to see each one.", plate: { src: P("cyanotype"), w: 475, h: 640, alt: "Anna Atkins's cyanotype of algae: pale water plants on Prussian blue." },
        labels: { ground: "The page's own water, as it stands now", motion: "Its current" } },
      { id: "tide-line", title: "Tide line", clock: "drying", steps: 8, form: "grain", move: "bridge", lead: "sedimentation", rule: "law-coffee-ring", bridge: "tide-line",
        text: "Where a liquid stops, it leaves its edge behind: a soak stain's rim, a bloom's border, the wrack on a beach.", labels: { motion: "A drop of pigment drying, its colour carried out to the rim" } },
      { id: "palimpsest", title: "Palimpsest", clock: "ratio", steps: 6, form: "glyph", move: "junction", lead: "archive-memory", rule: "law-weber-fechner", leave: ["tile", "sheet", "front"],
        text: "Water washed the first text off the leaf; the trace stayed under the new one.", labels: { motion: "The Archimedes leaf, uncovered tile by tile" },
        branches: [{ href: "place.html?n=palimpsest&from=layers", label: "Enter" }, { href: "place.html?n=listen&from=palimpsest", label: "Sound" }, { href: "floor.html#b-tile", label: "Tile" }, { href: "floor.html#b-sheet", label: "Sheet" }, { href: "floor.html#b-front", label: "Front" }, { href: "index.html?n=palimpsest", label: "The map" }, { href: "floor.html", label: "Index" }] },
    ],
  },
  {
    id: "glass", title: "Glass and light", temperature: "warm", ink: "#2a1d10", wall: "#f1e9dc", accent: "#c98a2a", medium: "thin",
    stops: [
      { id: "light", title: "Light", clock: "even", steps: 6, form: "grain", move: "picture", lead: "light", rule: "law-beer-absorption",
        text: "Earth from six billion kilometres: less than one pixel, caught in a scattered sunbeam inside the camera.", plate: { src: P("pale-blue-dot"), w: 453, h: 614, alt: "Voyager 1's Pale Blue Dot: a band of scattered sunlight with Earth a single pale point inside it." } },
      { id: "refraction", title: "Refraction", clock: "sqrt", steps: 12, form: "stroke", move: "law", lead: "refraction", rule: "law-snell", draw: "law-snell",
        text: "Light bends where it enters water; from below, the whole sky squeezes into a circle about 97 degrees across." },
      { id: "thin-film", title: "Thin film", clock: "even", steps: 8, form: "drop", move: "law", lead: "iridescence", rule: "law-thin-film", draw: "law-thin-film",
        text: "A soap film a few hundred nanometres thick reflects the colours that meet in step at its thickness; as it drains, the colours walk." },
      { id: "window", title: "Window", clock: "even", steps: 4, form: "ring", move: "bridge", lead: "aperture-eye", bridge: "window",
        text: "An opening that frames and bends what is seen: the eye, a telescope's dish, a frame within a frame.", plate: { src: P("fast-telescope"), w: 546, h: 411, alt: "The Five-hundred-metre Aperture Spherical Telescope in China: a dish filling a valley." } },
      { id: "glint", title: "Glint", clock: "even", steps: 6, form: "grain", move: "junction", lead: "gloss-reflectance", bridge: "glint", draw: "glint", leave: ["glint", "window"],
        text: "Each flash on the water is one small facet tilted just right between the sun and the eye.",
        branches: [{ href: "place.html?n=afterimage", label: "Afterimage" }, { href: "place.html?n=ebbinghaus", label: "Ebbinghaus" }, { href: "place.html?n=mirror", label: "Mirror" }, { href: "floor.html#b-glint", label: "Glint" }, { href: "index.html", label: "The map" }] },
    ],
  },
  {
    id: "type", title: "Type and lettering", temperature: "neutral", ink: "#1a1712", wall: "#ece6da", accent: "#8f3a19", medium: "water",
    stops: [
      { id: "type", title: "Type", clock: "even", steps: 6, form: "glyph", move: "picture", lead: "type", rule: "rule-two-type-families",
        text: "Rub-down letters on a carrier sheet: one face in many sizes, hierarchy from weight and size alone.", plate: { src: P("letraset-sheet"), w: 640, h: 480, alt: "A Letraset sheet of dry-transfer letters in rows of sizes." } },
      { id: "engraving", title: "Engraving", clock: "sqrt", steps: 6, form: "stroke", move: "picture", lead: "engraving-carving", rule: "rule-burin-tone-by-line",
        text: "In intaglio the tone is the lines: more and wider cuts make it darker, and there is no flat fill to lean on.", plate: { src: P("justice-etching"), w: 474, h: 640, alt: "An etching of Justice: a woman with a sword and a balance." } },
      { id: "erosion", title: "Erosion", clock: "even", steps: 8, form: "glyph", move: "law", lead: "erosion", rule: "rule-erosion-follows-stroke-width", draw: "rule-erosion-follows-stroke-width",
        text: "Wear a letter evenly and its hairlines go first; wear it by its own stroke width and the thin parts survive." },
      { id: "stroke", title: "Stroke", clock: "even", steps: 6, form: "stroke", move: "bridge", lead: "path-stroke", rule: "law-yield-stress", bridge: "stroke", draw: "law-yield-stress",
        text: "One continuous mark carried by a hand or a flow: a brush spiral, a burin cut, a line of thick paint that holds its ridges." },
      { id: "grain", title: "Grain", clock: "ratio", steps: 6, form: "grain", move: "junction", lead: "grain-texture", rule: "rule-imperfection-alive", bridge: "grain", leave: ["grain", "stroke"],
        text: "Paper tooth, a worn sort, an uneven inking: the small noise of a medium is part of what it says.", plate: { src: P("broadside-ballad"), w: 372, h: 640, alt: "A broadside ballad: worn black-letter type and a woodcut on rag paper." },
        branches: [{ href: "place.html?n=letter", label: "Letter" }, { href: "place.html?n=scripture", label: "Scripture" }, { href: "floor.html#b-grain", label: "Grain" }, { href: "floor.html#b-stroke", label: "Stroke" }, { href: "index.html", label: "The map" }] },
    ],
  },
  {
    id: "mosaic", title: "Mosaic and tile", temperature: "neutral", ink: "#151314", wall: "#e8e3d9", accent: "#c8322b", medium: "water",
    stops: [
      { id: "mosaic", title: "Mosaic", clock: "even", steps: 6, form: "tile", move: "mosaic", lead: "mosaic", rule: "rule-andamento-follows-form",
        text: "Tesserae laid in courses that follow the form: the flow of the tiles draws the shape before the colour does.", plate: { src: P("blue-marble"), w: 640, h: 640, alt: "NASA's Blue Marble: the whole Earth, clouds over the western hemisphere." } },
      { id: "halftone", title: "Halftone", clock: "even", steps: 6, form: "grain", move: "law", lead: "halftone-dither", rule: "rule-imperfection-alive", draw: "rule-imperfection-alive",
        text: "Tone from dots of one ink: bigger dots read darker, and a slipped second screen leaves the moiré that says it was printed." },
      { id: "tile", title: "Tile", clock: "even", steps: 5, form: "tile", move: "bridge", lead: "tessellation", rule: "rule-andamento-follows-form", bridge: "tile",
        text: "The unit that carries one piece of the whole: a ribbon tile, a tessera, a glyph cell, one beat of a story.", plate: { src: P("clay-floor"), w: 640, h: 640, alt: "A worn clay floor of square tiles." } },
      { id: "joint", title: "Joint", clock: "even", steps: 12, form: "tile", move: "bridge", lead: "decomposition-measure", rule: "rule-recombine-not-copy", bridge: "joint", draw: "rule-recombine-not-copy",
        text: "The cut between parts lets a whole be taken apart and rebuilt: a grout line, a seam, the turn between premises in an argument.", plate: { src: P("golem-loew"), w: 274, h: 477, alt: "Rabbi Loew and the Golem, an illustration." } },
      { id: "grid", title: "Grid", clock: "even", steps: 6, form: "tile", move: "junction", lead: "grid", rule: "rule-one-hot-mark", draw: "rule-one-hot-mark", leave: ["tile", "joint"],
        text: "A grid holds every cell equal until one mark turns hot; then the eye goes there first.",
        branches: [{ href: "place.html?n=labels", label: "Labels" }, { href: "place.html?n=lossy", label: "Lossy" }, { href: "place.html?n=static", label: "Static" }, { href: "floor.html#b-joint", label: "Joint" }, { href: "index.html", label: "The map" }] },
    ],
  },
  {
    id: "sound", title: "Sound", temperature: "warm", ink: "#24151c", wall: "#efe5df", accent: "#a33a5a", medium: "thin",
    stops: [
      { id: "sound", title: "Sound", clock: { even: 0.4, hum: 0.6 }, steps: 8, form: "ring", move: "picture", lead: "sound", rule: "music-dark-room",
        text: "Berliner's gramophone cut sound as a groove in a flat disc; a room's echo is the sound still arriving after it stops.", plate: { src: P("gramophone-berliner"), w: 640, h: 628, alt: "An early Berliner gramophone with its horn." } },
      { id: "resonance", title: "Resonance", clock: { even: 0.3, hum: 0.7 }, steps: 6, form: "grain", move: "law", lead: "resonance-pitch", rule: "law-kac-drum", draw: "law-kac-drum",
        text: "Sand on a bowed plate gathers on the lines that stay still; each pitch draws its own figure." },
      { id: "ducking", title: "The pad ducks", clock: "hum", steps: 16, form: "stroke", move: "law", lead: "tempo-rhythm", rule: "music-pad-ducks-kick", draw: "music-pad-ducks-kick",
        text: "Two bars of the theme: the pad dips under every kick, so the two never cover each other." },
      { id: "ring", title: "Ring", clock: { even: 0.5, hum: 0.5 }, steps: 9, form: "ring", move: "bridge", lead: "ring-orbit", rule: "music-third-thin", bridge: "ring", draw: "ring",
        text: "A closed loop that spreads or holds: a ripple, a drum's nodal circle, an iris, a halo." },
      { id: "cycle", title: "The cycle", clock: "hum", steps: 6, form: "ring", move: "junction", lead: "sound-as-shape", rule: "music-b6-colour", draw: "music-b6-colour", leave: ["ring"],
        text: "The theme turns on the flat sixth: the tonic, then the sixth over the same low note, again and again.", plate: { src: P("golden-record"), w: 640, h: 360, alt: "The Voyager Golden Record's cover, engraved with instructions for playing it." },
        branches: [{ href: "place.html?n=listen", label: "Listen" }, { href: "place.html?n=groove", label: "Groove" }, { href: "place.html?n=lullaby", label: "Lullaby" }, { href: "place.html?n=anempathetic", label: "Anempathetic" }, { href: "floor.html#b-ring", label: "Ring" }] },
    ],
  },
  {
    id: "tools", title: "Tools", temperature: "cool", ink: "#16130f", wall: "#e8e3d9", accent: "#0a6b61", medium: "viscous",
    stops: [
      { id: "ticker", title: "Ticker", clock: "even", steps: 6, form: "tile", move: "picture", lead: "data",
        text: "Edison's ticker printed prices on paper tape as they arrived: data as a ribbon, read in order.", plate: { src: P("ticker-engr"), w: 569, h: 640, alt: "An engraving of Edison's stock ticker under its glass dome." } },
      { id: "telegraph", title: "Telegraph", clock: "even", steps: 6, form: "glyph", move: "picture", lead: "code",
        text: "A key, a code and a wire: every message cut into marks and spaces before it could travel.", plate: { src: P("telegrapher"), w: 516, h: 640, alt: "A telegraph operator at a key." } },
      { id: "grid-of-time", title: "Grid of time", clock: "even", steps: 30, form: "tile", move: "bridge", lead: "held-frames-timing", rule: "rule-time-boxed-practice", bridge: "grid-of-time", draw: "rule-time-boxed-practice",
        text: "Time laid out as cells: a contact sheet, a timed study, a fixed half hour that makes the work finish." },
      { id: "switchboard", title: "Switchboard", clock: "even", steps: 12, form: "stroke", move: "junction", lead: "transformation", rule: "rule-recombine-not-copy", leave: ["grid-of-time"],
        text: "An operator joins any line to any other by hand; the tools here do that work for checks, words, sources and code.", plate: { src: P("operator"), w: 632, h: 640, alt: "Ethel Wakefield at a Western Union switchboard." },
        branches: [{ href: "place.html?n=flywheel", label: "Flywheel" }, { href: "place.html?n=articulate", label: "Articulate" }, { href: "place.html?n=daylight", label: "Daylight" }, { href: "place.html?n=buildlang", label: "BuildLang" }, { href: "place.html?n=raw", label: "raw-native" }] },
    ],
  },
  {
    id: "investigations", title: "Investigations", temperature: "neutral", ink: "#16130f", wall: "#e4e0d8", accent: "#4e4d85", medium: "viscous",
    stops: [
      { id: "redaction", title: "Redaction", clock: "ratio", steps: 6, form: "tile", move: "picture", lead: "witness-transparency",
        text: "A redacted page shows exactly where something was taken out; the black bar is a record too.", plate: { src: P("redacted-cia"), w: 493, h: 640, alt: "A typed government page with lines blacked out." } },
      { id: "argument", title: "Argument", clock: "even", steps: 6, form: "glyph", move: "law", lead: "argument-structure", rule: "rule-argument-movements", draw: "rule-argument-movements",
        text: "Split a claim into premises, presuppositions and a conclusion, and every 'so' and 'but' becomes a turn you can check." },
      { id: "thread", title: "Thread", clock: "even", steps: 13, form: "stroke", move: "bridge", lead: "network-graph", bridge: "thread", draw: "network",
        text: "A line that joins: a sewing thread, a network edge, a rope strand; here, every bridge in the world drawn between its places." },
      { id: "weighing", title: "The weighing", clock: "ratio", steps: 6, form: "glyph", move: "junction", lead: "checking-as-craft", leave: ["thread", "joint"],
        text: "In the Papyrus of Hunefer the heart is weighed against a feather and a scribe writes the result down: a check, with a record.", plate: { src: P("heart-hunefer"), w: 640, h: 524, alt: "The weighing of the heart from the Papyrus of Hunefer." },
        branches: [{ href: "place.html?n=who-knew-first", label: "Who knew first" }, { href: "place.html?n=no-receipt-no-accept", label: "No receipt, no accept" }, { href: "place.html?n=witnessing-spine", label: "The witnessing spine" }, { href: "index.html", label: "The map" }, { href: "floor.html", label: "Index" }] },
    ],
  },
];
