// Words for raw.html, the native renderer of The Playground (scripts/product-raw.mjs renders them).
// Every number here was read from the live renderer on this site (media/raw-native/live/) or from the engine's
// own evidence files, and the sentence beside it says where.

export const INTRO = {
  title: "The native renderer",
  lede: "The Playground's renderer, live at the size of your window. The engine's own ambient occlusion, reflections and anti-aliasing run on its own scenes, beside a path-traced reference, and the page measures what each pass gets wrong while you watch.",
  note: "It needs a browser with WebGPU. Without it, the pictures below are frames from the same page, and the certificate check further down still runs on your CPU.",
};

export const LIVE = {
  title: "Render it here",
  lede: "Pick a scene. It opens full-window and draws every frame on your GPU: the engine's GTAO, SSR and TAA passes, sun and sky, light in the air, and a tilted lens. Hold the camera still and two references gather behind it, a ray-traced one for occlusion and mirrors and a path-traced one for the whole frame. Each pass in the panel says how far the frame is from the reference with that pass on and with it off.",
  starts: [
    { id: "hall", go: "Open the hall", bytes: 15034614, cap: "The hall from the nave: 586,424 triangles, 12 bays, a gallery, drapery and an open atrium. The engine's own asset.", alt: "A long hall of fluted columns under round arches, red drapery in the gallery, lanterns on the piers, a chequered stone floor in sun and shade, the sky open above." },
    { id: "hero", go: "Open the hero", bytes: 2713508, cap: "The hero asset on the test ground: a clearcoated metal shell, a visor and vents, 111,136 triangles.", alt: "A metal helmet shell with a dark visor on a pale ground, its shadow cast long to the left." },
    { id: "test", go: "Open the test scene", bytes: 0, cap: "The engine's test scene: a ground plane and a box, the scene its certificates are written for.", alt: "" },
  ],
  stateIdle: "With scripts and WebGPU on, each picture opens the renderer full-window. A scene downloads only when you press.",
  keys: "Drag to look. W A S D or the arrows move, Q and E sink and rise, the wheel goes forward, Shift is faster. The panel at the right sets the scene, the camera, what is shown, each pass, the sun, the air, the lens, the display transform and the pixel count. Esc, or Back to the page, leaves.",
  split: { cap: "The same frame of the hall, with the real-time image on the left and the path-traced reference on the right, after 761 samples a pixel. The reference carries the light that bounces off the sunlit floor and walls; the real-time sky light comes from the sky alone, so its shade stays blue.", alt: "The hall split down the middle: on the left the real-time frame, cool and blue in the shade; on the right the path-traced frame, warm where light bounces from the sunlit floor." },
  error: { cap: "The error between them, each pixel the mean distance in display values, from black (none) through violet to pale gold (a quarter of the full scale or more).", alt: "A dark frame of the hall where the columns, the arches and the far wall glow violet to gold, brightest in the shade the bounce light fills in the reference." },
  postersSource: "The pictures are the renderer's own canvas, drawn on an RTX 4090 at 1600 x 900 from the code and scenes this page loads.",
};

// read from the live page on an RTX 4090 (Chrome 142, D3D12), the hall from the nave at 1280 x 800, after 500 or
// more reference samples a pixel; each row is the frame's RMSE against the path-traced reference in display values
export const MEASURED = {
  setup: "The hall from the nave at 1280 x 800, after 577 reference samples a pixel, on an RTX 4090.",
  rows: [
    ["GTAO, the engine's", "0.104", "0.114"],
    ["SSR, the engine's", "0.104", "0.122"],
    ["TAA, the engine's", "0.104", "0.109"],
    ["Sky light, ambient cube", "0.104", "0.101"],
    ["Light in the air", "0.104", "0.126"],
  ],
  says: "Every row is the same frame with one pass turned on or off, measured against the same path-traced reference. Four passes bring the frame closer. The sky light makes it slightly worse, because its ambient cube has no idea the hall has a roof; the reference does.",
  passes: "GTAO against ray-traced occlusion within the same 1.2 m: RMSE 0.064, inside the engine's 0.12 tolerance; with no occlusion at all, 0.150. SSR against the traced mirror over 343,234 pixels: 0.107; the sky probe alone: 0.210.",
  cost: "On the same card the real-time passes took 4.0 ms of GPU time a frame at 1280 x 800, 13.1 ms at 2560 x 1440 and 37.1 ms at 3840 x 2160, where the engine's GTAO took 14.9 ms and its SSR 9.8 ms. The references run only while the camera holds still: at 4K one sample of each costs another 70 ms.",
};

export const WHAT_RUNS = {
  title: "What runs, and whose it is",
  engine: [
    "GTAO, mirror SSR and the TAA resolve: the engine's WGSL (post.wgsl), the GPU forms of the passes its CPU reference checks.",
    "Every ray: the engine's watertight triangle test and its BVH walk (passes.wgsl), on the engine's node layout.",
    "The display transform: the engine's colour pipeline (colour.wgsl) with its ACES 2.0 tables, or AgX, PBR Neutral or clip.",
    "The sky: the engine's Preetham clear sky and sun, ported line for line from sky.cpp.",
    "The scenes: raw-hall and raw-hero, the engine's owned assets, byte for byte as its exporter writes them.",
  ],
  page: [
    "The G-buffer: the browser's rasterizer draws it. The engine's own raster pass walks every triangle per pixel, which is too slow to move through 586,424 triangles at window size.",
    "The sun and sky shading, the light in the air, the tilt-shift blur, the tree build and both references are written for this page.",
    "Transmission is not refracted on either side: the hero's visor is drawn as dark glass.",
  ],
  pins: "Each engine file is carried unchanged from superframe at commit cac34166 and checked against its SHA-256 before it compiles; each scene is checked against the hash the engine commits for it. A file that does not match stops the page.",
};

export const ENGINE_ONLY = {
  title: "In the engine, not yet in your browser",
  lede: "The engine draws more than this page can carry yet. These are its own frames, with the record each came from.",
  tilt: [
    { f: "town-plain", cap: "The town, painted with no lens.", alt: "A painted town from above: boxy buildings along a street in late light, lamps and people, everything equally sharp." },
    { f: "town-ours", cap: "The same frame through the engine's tilt-shift lens: the plane of focus tilted in the world to follow the street, and out of focus repainted coarser rather than blurred.", alt: "The same town where the street and its people stay crisp and the roofs near and far dissolve into broader paint." },
    { f: "town-look-night", cap: "The night look over the same lens.", alt: "The town at night under the same lens: dark blue paint, lamps glowing along the street." },
  ],
  tiltSource: "960 x 540 frames from the CPU stage of the engine's tilt-shift lens, evidence/tiltshift at superframe commit c1f85d50. The GPU chain costs about 0.86 ms at 1080p on an RTX 4090 (Direct3D 12 median; Vulkan about 0.85 ms). Two of its checks are recorded misses: out of focus the ink does not fall off as far as the bound asks (1.32 against at most 0.5), and the art scene's measure is 0.474 against at least 0.5.",
  more: "Also in the engine and not on this page: ReSTIR direct lighting over many lights (unbiased against the exact tracer on two scenes, its records in evidence/restir-di), the material model with clearcoat, sheen, anisotropy, iridescence and transmission (checked against a float64 reference), and the Direct3D 12 and Vulkan paths.",
};

export const CERT = {
  title: "The certificate, live",
  lede: "The renderer's first check, still running here on your CPU: one camera on the test scene, its occlusion lit twice, once with the cheap method and once ray-traced, and a JSON certificate saying whether the cheap one held. This is the 0.4.0 browser build; the release is 0.8.0, and the downloads below are from it.",
};
