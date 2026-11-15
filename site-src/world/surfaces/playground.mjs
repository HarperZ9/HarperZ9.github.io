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
