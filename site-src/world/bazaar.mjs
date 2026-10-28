// bazaar.mjs: the places after the road. Each speciality is a place with its own laws; crossing between places
// is free (the author, 2026-10-26: "the individual elements have rules and laws, but the shared space does not").
// Each place leads with its motion: a loop or a live medium first, the still as the fallback.
//   lead.kind  "loop"   a muted loop (WebM AV1 and MP4) with a WebP poster; still under reduced motion
//              "hum"    the theme itself: the record plays Hum v4 (the calm loop under reduced motion)
//              "living" a living still from the alive layer over a cleared archival plate
//              "image"  a still uncovered by the stop grammar's mosaic as the visitor arrives
//   form       how this place's element travels when it crosses to the next (universe lib/carry.js FORMS)
//   laws       world.json rule ids, shown as this place's laws
//   living     the living-type states the heading walks through (typeengine lib/living), Hanken underneath
export const PLACES = [
  {
    id: "light", title: "Light and glass", form: "grain", medium: "thin", living: ["ink", "engraved", "ink"],
    lead: { kind: "loop", src: "/media/world/name-art/glass-tubes", alt: "The name drawn as glass rods at a low sun, light bending through each letter." },
    laws: ["law-snell", "law-thin-film", "law-beer-absorption"],
    ways: [["/world/glass/index.html", "Glass, liquid and tube"], ["/world/playbook/examples/caustic.html", "Caustic"], ["/world/ui/directions/cs-max/flywheel.html", "Flywheel in light"]],
  },
  {
    id: "type", title: "Type and lettering", form: "glyph", medium: "medium", living: ["ink", "charcoal", "plant", "paint"],
    lead: { kind: "loop", src: "/media/world/name-art/deco-arc", alt: "The name set in a sunburst of stepped deco strokes, the rays turning slowly." },
    laws: ["rule-burin-tone-by-line", "rule-erosion-follows-stroke-width", "rule-readability-is-king"],
    ways: [["/world/typeengine/living/index.html", "Living type"], ["/world/typeengine/room/index.html", "The type room"], ["/world/typeengine/specimens/index.html", "Families"], ["/accession.html", "Accession"]],
  },
  {
    id: "mosaic", title: "Mosaic", form: "tile", medium: "medium", living: ["engraved", "ink", "charcoal"],
    lead: { kind: "loop", src: "/media/world/name-art/mosaic-smalti", alt: "The name laid in glass smalti, the courses of tiles following each stroke." },
    laws: ["rule-andamento-follows-form", "rule-deco-motif-set"],
    ways: [["/world/playbook/examples/mosaic.html", "Scatter"], ["/elements.html", "The element table"], ["/world/feed-25/build/index.html", "Plates"]],
  },
  {
    id: "water", title: "Ink and water", form: "drop", medium: "thin", living: ["ink", "charcoal", "plant", "paint"],
    lead: { kind: "loop", src: "/media/world/name-art/pearls", alt: "The name strung in nacre, its sheen moving like water over the beads." },
    laws: ["law-diffusion", "law-coffee-ring", "law-yield-stress"],
    ways: [["#s-ink", "Back to the road"], ["/world/exhibit/palimpsest.html", "Palimpsest"], ["/world/universe/proto/index.html", "The map"]],
  },
  {
    id: "sound", title: "Sound", form: "stroke", medium: "thin", living: ["ink", "charcoal", "plant"],
    lead: { kind: "hum", alt: "Hum v4, the site's theme: 112 beats a minute, felt in half time." },
    laws: ["music-pad-ducks-kick", "music-third-thin", "music-b6-colour", "music-dark-room"],
    ways: [["/world/sound/theme/index.html", "The theme"], ["/world/visualizer/web/grid.html", "The score on a grid"], ["/world/exhibit/listen.html", "Three sounds that lie"]],
  },
  {
    id: "data", title: "Data and the visualizer", form: "tile", medium: "medium", living: ["engraved", "ink", "charcoal"],
    lead: { kind: "image", src: "/media/world/library/concept-layers.webp", w: 2600, h: 1900, alt: "The reference library's concepts in seven translucent strata, from materials down to meaning." },
    laws: ["law-weber-fechner", "law-kac-drum", "law-overprint-absorption"],
    ways: [["/world/visualizer/web/index.html", "Seabed"], ["/swatches.html", "The swatch library"], ["/elements.html", "The element table"]],
  },
  {
    id: "motion", title: "Motion and film", form: "stroke", medium: "medium", living: ["ink", "charcoal", "ink"],
    lead: { kind: "living", src: "/world/ui/assets/muybridge-758-720.webp", w: 720, h: 406, alt: "Muybridge's horse in motion, plate 758, held as a living still." },
    laws: ["rule-imperfection-alive", "rule-colour-grade-in-post"],
    ways: [["/explainers.html", "Films"], ["/world/playbook/examples/cadence.html", "Weather, on twos"], ["/night-school.html", "Night School"]],
  },
  {
    id: "exhibit", title: "The exhibit", form: "grain", medium: "viscous", living: ["engraved", "ink", "charcoal"],
    lead: { kind: "living", src: "/world/ui/assets/goya-nobody-720.webp", w: 720, h: 1044, alt: "Goya's Nobody knows himself: masked figures, held as a living still." },
    laws: ["rule-argument-movements", "rule-depth-planes-have-jobs"],
    ways: [["/world/exhibit/index.html", "We are here"], ["/world/exhibit/balance.html", "The false balance"], ["/world/ui/directions/cs-max/exhibit.html", "The Baron's room"]],
  },
  {
    id: "engine", title: "The engine", form: "glyph", medium: "medium", living: ["code", "illustration", "plant"],
    lead: { kind: "loop", src: "/media/world/name-art/monogram-orb", alt: "The ZDH mark turning in a glass orb." },
    laws: ["rule-recombine-not-copy"],
    ways: [["/world/superframe/room/index.html", "The assistive room"], ["/world/feed-22/build/index.html", "Chladni sand"], ["/world/feed-23/build/index.html", "Brush"], ["/world/feed-29/build/index.html", "Print and spot"]],
  },
  {
    id: "tools", title: "Tools", form: "tile", medium: "viscous", living: ["ink", "engraved", "ink"],
    lead: { kind: "image", src: "/media/world/name-art/intaglio-lines-1920.webp", w: 1920, h: 1080, alt: "The name engraved in intaglio lines, tone made only by line width under a raking light." },
    laws: [],
    ways: [["/flywheel.html", "Flywheel"], ["/cmmns.html", "CMMNS"], ["/articulate.html", "Articulate"], ["/emet.html", "EMET"], ["/buildlang.html", "BuildLang"], ["/raw.html", "raw-native"], ["/learn.html", "learn"], ["/workshop.html", "The workshop"]],
  },
];
