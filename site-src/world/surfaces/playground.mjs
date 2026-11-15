// playground.mjs: the manifest of The Playground's surface, /playground/. scripts/build-surfaces.mjs builds the page
// from it. A surface is one of the six platform pages; a module is a row in world/site/surfaces/registry.mjs.
//
// The page opens as words and a still, and loads no module. One press starts the exchange: the blend table hands
// its blend and its palette to the other modules through the bus (world/site/surfaces/bus.mjs), and the page shows
// each hand-over. A heavy module starts on its own press, with its size stated.
export default {
  id: "playground",
  file: "playground/index.html",
  title: "The Playground",
  description: "The Playground is a rendering engine that turns one description into picture, type and sound: the native renderer, Superframe, the instruments and study tools, and Low Water.",
  lede: 'The Playground is a rendering engine that turns one description into picture, type and sound. It has four parts: the <a href="/raw.html">native renderer</a>, <a href="/superframe.html">Superframe</a> at the core, the <a href="#instruments">instruments and study tools</a>, and <a href="/low-water.html">Low Water</a>, the game made with it.',
  make: 'It is also a place to make things. Blend materials and watch one blend become colour, lettering, timing and pen lines. Mint a typeface and save the font file. Play one of five pieces of music and save it as a sound file. More rooms are being moved onto this page from the pages listed under <a href="#instruments">instruments and study tools</a>.',
  parts: [
    ["/raw.html", "The native renderer", "Renders frames in C++ on Direct3D 12, Vulkan and WebGPU, and checks each one against a reference. Released as raw-native."],
    ["/superframe.html", "Superframe, the core", "One seeded recipe rendered as picture, line, surface, type and sound."],
    ["/low-water.html", "Low Water", "The game made with The Playground."],
  ],
  // The exchange: which modules start together, what the first one sends, and the heavy module that waits for a press.
  exchange: {
    anchor: "m-exchange",
    demo: "playground-exchange",
    heading: "One blend, read three ways",
    say: "Three materials from the element table are blended by share. The blend table works out the mix and hands it on. The lettering sets the blend's name in the technique of its leading part, the motion curve draws the timing the blend moves on, and the pen study inks its pens with the blend's colours. Change a share and all three follow.",
    elements: ["ink", "glass", "type"],
    modules: ["blend", "lettering", "motion", "plot"],
    sends: [["blend", "blend"], ["blend", "palette"]],
    press: ["well"],
    plain: "/elements.html",
  },
  // Rooms: creative pages folded into this one. Each is a registry module with a `room` anchor; rooms.mjs opens it.
  rooms: [
    { id: "forge", anchor: "type", demo: "playground-type-forge", heading: "Type: mint a face", open: "Open the forge", css: "world/site/surfaces/room-forge.css",
      say: "Zain Mint is a typeface drawn by rule. Six numbers set the pen and the proportions, the forge traces the alphabet again in your browser, and your own text is set in the result. Save the face as a font file or the line as an SVG. A weight too heavy to keep a counter open is refused by name, and no file is made.",
      exchange: "When the blend above is running, its colour inks the proof and the lettering letters your line, and this line says so each time.",
      takes: ["palette"], gives: ["text", "font", "svg"] },
    { id: "sound", anchor: "sound", demo: "playground-sound", heading: "Sound: play a piece, keep the file", open: "Open the sound room", css: "world/site/surfaces/room-sound.css", heavy: true,
      later: "The first Play or the first file loads {size} more at most: the instruments, which run apart from the page.",
      say: "Five pieces of jazz over sea, wind and open air, composed and synthesized in your browser while they play. A seed sets the order of the sections, the piano's rhythm, the fills and how the lead develops its theme, so one piece has many performances and one seed always gives the same one. Choose a piece, a band and a length, and save the result as a sound file at a measured loudness. Nothing plays until you press Play.",
      exchange: "When the blend above is running, its leading part chooses the piece. When the type forge is open, its line sets the seed. This line says so each time.",
      takes: ["blend", "text"], gives: ["score", "wav"] },
  ],
  placesHeading: "Instruments and study tools",
  places: [
    ["/playground/distill.html", "Distill", "Take any file, archive or folder apart and read what it is made of."],
    ["/studio.html", "The Studio", "A live media instrument for picture and sound."],
    ["/elements.html", "Elements", "Pigment, water, glass and paper on one bench, with state changes."],
    ["/glass-water.html", "Glass and water", "Glass lettering over a live sea in four spaces."],
    ["/world/sound/sound.html", "Sound", "Instruments and scores made in the browser."],
    ["/swatches.html", "Swatches", "Colour as measured material."],
    ["/accession.html", "Accession", "The type family and its living forms."],
  ],
};
