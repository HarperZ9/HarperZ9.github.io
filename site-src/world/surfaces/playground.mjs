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
  make: 'It is also a place to make things. Blend materials and watch one blend become colour, lettering, timing and pen lines. Mint a typeface and save the font file. Play one of five pieces of music and save it as a sound file. Write a shader, watch it run, and send its frame to the loom, the plotter and a relief. Build words from turning circles in the <a href="/playground/fourier.html">Fourier room</a>. More rooms are being moved onto this page from the pages listed under <a href="#instruments">instruments and study tools</a>.',
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
    press: ["well", "loom", "ridges", "voxels"],
    plain: "/elements.html",
  },
  // Rooms: creative pages folded into this one. Each is a registry module with a `room` anchor; rooms.mjs opens it.
  rooms: [
    { id: "forge", anchor: "type", demo: "playground-type-forge", heading: "Type: mint a face", open: "Open the forge", css: "world/site/surfaces/room-forge.css",
      say: "Zain Mint is a typeface drawn by rule. Six numbers set the pen and the proportions, the forge traces the alphabet again in your browser, and your own text is set in the result. Save the face as a font file or the line as an SVG. A weight too heavy to keep a counter open is refused by name, and no file is made.",
      exchange: "When the blend above is running, its colour inks the proof and the lettering letters your line, and this line says so each time.",
      takes: ["palette"], gives: ["text", "font", "svg"] },
    { id: "shader", anchor: "shader", demo: "playground-shader", heading: "Shaders: write one, watch it run", open: "Open the shader room", css: "world/site/surfaces/room-shader.css",
      say: "A fragment shader is a short program that decides the colour of every pixel, many times a second, on your graphics card. Write or change one here and it runs as you type. A mistake is marked at its line and the last working frame stays up. Start from four small shaders or from the 254 of the preset library. Save the source, the frame as a picture, or the frame as pen lines, plotter moves and a printable relief. The address carries the shader, so a link opens it. The Retro Engine moved in here whole: draw from a plate, a picture of yours, your own drawing or a scope, and put the frame through hardware palettes, dither, a CRT tube, 46 effects and feedback, with sound driving it if you like.",
      exchange: "When the blend above is running, its colours reach the shader as iPalette, the well's picture reaches it as iChannel0, and the loom, the plot map and the cubes draw the shader's frame. This line says so each time.",
      takes: ["palette", "image"], gives: ["image", "png", "svg", "gcode"] },
    { id: "sound", anchor: "sound", demo: "playground-sound", heading: "Sound: play a piece, keep the file", open: "Play the music", css: "world/site/surfaces/room-sound.css", heavy: true, audio: true,
      later: "The music starts with this press, which also loads {size} more at most: the instruments, which run apart from the page.",
      say: "Five pieces of jazz over sea, wind and open air, composed and synthesized in your browser while they play. The notes show as they play. Drag across them to change the tempo and how many notes play, move the key, raise or lower each instrument, and blend the first band into the second. A seed sets the order of the sections, the piano's rhythm, the fills and how the lead develops its theme, so one seed always gives the same performance. Save what you hear as a sound file at a measured loudness. Nothing plays until you press.",
      exchange: "When the blend above is running, its leading part chooses the piece. When the type forge is open, its line sets the seed. While it plays, the shader room can take its levels as iAudio. This line says so each time.",
      takes: ["blend", "text"], gives: ["score", "wav"] },
    { id: "field", anchor: "field", demo: "playground-field", heading: "The field: light, flow, measure and shape in one place", open: "Open the field", css: "world/site/surfaces/room-field.css",
      say: "Light crosses a Luneburg glass and a body of stirred water. Neither is a room: refraction, flow, measurement, shape, a voice, a map and a circuit are properties, and every element here can carry every one of them at any weight from 0 to 1. Each element's edge is a gradient, so where the glass meets the water the light bends by both at once. Choose an element, move its sliders, drag it or move it with the arrow keys. The probe reads the water and the CAD rule dimensions it, with a tolerance on every number. Every reading is simulated and says so.",
      exchange: "When the blend above is running, its mix colours the dye. After each change the field hands its readings on as numbers. This line says so each time.",
      takes: ["palette"], gives: ["numbers", "image"] },
    { id: "estuary", anchor: "estuary", demo: "playground-estuary", heading: "Estuary: continuous metamers, homology and Perret-lantern light", open: "Open the estuary", css: "world/site/surfaces/room-field.css",
      say: "Every capability is a continuous weight from 0 to 1, never a binary switch. Blend refraction, fluid, measurement, CAD and sound across a Perret-lantern lattice of spectral apertures, inspect live perceptual metamers, Betti numbers (beta0/beta1), monodromy winding, seams and negative space, and hear the opt-in harmonic metamer.",
      exchange: "When the blend above is running, its mix and palette flow straight into the estuary; estuary hands its field, palette and harmonic score back to sound, shader and plot.",
      takes: ["elements", "blend", "palette", "field", "numbers", "score"], gives: ["field", "palette", "score", "numbers", "json"] },
  ],
  placesHeading: "Instruments and study tools",
  places: [
    ["/playground/distill.html", "Distill", "Take any file, archive or folder apart and read what it is made of."],
    ["/gaussian-splats.html", "Gaussian Splats", "Provenance-locked 3D splat worlds built from source photography."],
    ["/studio.html", "The Studio", "A live media instrument for picture and sound."],
    ["/elements.html", "Elements", "Pigment, water, glass and paper on one bench, with state changes."],
    ["/glass-water.html", "Glass and water", "Glass lettering over a live sea in four spaces."],
    ["/world/sound/sound.html", "Sound", "Instruments and scores made in the browser."],
    ["/swatches.html", "Swatches", "Colour as measured material."],
    ["/accession.html", "Accession", "The type family and its living forms."],
  ],
};
