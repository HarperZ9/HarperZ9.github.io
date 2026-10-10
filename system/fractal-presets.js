// fractal-presets.js: the Studio's named fractal views.
//
// Data only. Coordinates from project-docs/research/fractal-studio/fractal-math.md §4 (Mandelbrot
// deep-zoom targets) and §5/§6 (Julia constants, Burning Ship). Exact values preserved; confidence
// labels live in that source file. Split out of fractal.js so the renderer file is the renderer.

export const PRESETS = [
  // Mandelbrot
  {
    name: "Full Overview",
    type: "mandelbrot",
    cx: -0.75, cy: 0.0,
    scale: 3.5,
    maxIter: 500,
    palette: "ocean",
  },
  {
    name: "Seahorse Valley",
    type: "mandelbrot",
    cx: -0.745067, cy: 0.118346,
    scale: 0.0007,
    maxIter: 800,
    palette: "dusk",
  },
  {
    name: "Seahorse Deep (minibrot)",
    type: "mandelbrot",
    cx: -0.744539761, cy: 0.121724001,
    scale: 6.25e-6,
    maxIter: 2000,
    palette: "ember",
  },
  {
    name: "Elephant Valley",
    type: "mandelbrot",
    cx: 0.2765, cy: -0.0065,
    scale: 0.0003,
    maxIter: 1000,
    palette: "ocean",
  },
  {
    name: "Misiurewicz Hub",
    type: "mandelbrot",
    cx: -0.7436438870371587, cy: 0.1318259042053119,
    scale: 1e-4,
    maxIter: 1500,
    palette: "dusk",
  },
  {
    name: "Feigenbaum Point",
    type: "mandelbrot",
    // Framed to SHOW the period-doubling cascade accumulating at the Feigenbaum point. The
    // original framing (scale 1e-6 at the point itself) rendered solid black: a window that deep
    // on the boundary is essentially all non-escaping at any budget, and the piecewise preset
    // sweep (2026-08-04) measured 0% lit pixels. Presets are views, and a view that shows
    // nothing is a defect regardless of how famous its coordinates are.
    cx: -1.401155189, cy: 0.0,
    scale: 6e-3,
    maxIter: 900,
    palette: "ember",
  },
  {
    name: "Period-3 Bulb",
    type: "mandelbrot",
    // The whole bulb with its boundary filaments. The original scale (0.005) sat entirely INSIDE
    // the bulb — interior renders black by design, so the preset was a solid black frame
    // (measured 0% lit in the 2026-08-04 preset sweep).
    cx: -0.125, cy: 0.744,
    scale: 0.55,
    maxIter: 700,
    palette: "dusk",
  },
  {
    name: "Triple Spiral",
    type: "mandelbrot",
    cx: -0.088, cy: 0.654,
    scale: 0.004,
    maxIter: 1000,
    palette: "ember",
  },
  {
    name: "Period-2 Minibrot",
    type: "mandelbrot",
    cx: -1.7499892, cy: 0.0,
    scale: 0.0001,
    maxIter: 2000,
    palette: "ocean",
  },
  {
    name: "Double Spiral",
    type: "mandelbrot",
    cx: -0.74543, cy: 0.11301,
    scale: 5e-5,
    maxIter: 1500,
    palette: "dusk",
  },
  // Deep zoom (9 October 2026). Past 1e-16 a double cannot hold the centre, so these carry it as
  // decimal strings (re, im); cx/cy are the nearest doubles for display. Found by zooming toward the
  // longest-lived pixel of each frame; drawn by perturbation (fractal-gl-deep.js).
  {
    name: "Deep: Spiral Field (2e-38)",
    type: "mandelbrot",
    re: "-0.7436227627792091903930625607721105561797006142687856921130208924",
    im: "0.1318305311337870112915195543947448074486402760798047827036608098",
    cx: -0.7436227627792092, cy: 0.131830531133787,
    scale: 2e-38,
    maxIter: 12000,
    palette: "ember",
  },
  {
    name: "Deep: Seahorse Tail (1e-150)",
    type: "mandelbrot",
    re: "-0.7436297108068149238641325645257763748151975409563090363549016381635416548956679926139737642246077493440431294103029241581097769872221393760302035629656002720600904888665708397502623345426216845718575255878890109145340921980042513045915678208132096765732941297235405155513117648582567969581550859934997583",
    im: "0.13179037348492778857499863122829328753718721359953548960719304643371887523795737082411405884833132274071063210366741652146215110766349394536962035781770676794890237986971127860569783512781903532462248451189646528671485547191899510555794486220620700127547613240584893758833459112932403289697064048771100777",
    cx: -0.743629710806815, cy: 0.13179037348492778,
    scale: 1e-150,
    maxIter: 40000,
    palette: "ocean",
  },
  {
    name: "Deep: Floor of the Double (3e-279)",
    type: "mandelbrot",
    re: "-0.7436297108068149238641325645257763748151975409563090363549016381635416548956679926139737642246077493440431294103029241581097769872221393760302035629656002720600904888665708397502623345426216845718575255878890109145340921980042513045915678208132096765732941297235405155513117648582567969581550859934997583",
    im: "0.13179037348492778857499863122829328753718721359953548960719304643371887523795737082411405884833132274071063210366741652146215110766349394536962035781770676794890237986971127860569783512781903532462248451189646528671485547191899510555794486220620700127547613240584893758833459112932403289697064048771100777",
    cx: -0.743629710806815, cy: 0.13179037348492778,
    scale: 3e-279,
    maxIter: 40000,
    palette: "dusk",
  },
  // Julia sets: c values from fractal-math.md §5 (MathWorld + Wikibooks)
  {
    name: "Julia: Douady Rabbit",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -0.122561166876654, jy: 0.744861766619744,
    palette: "dusk",
  },
  {
    name: "Julia: San Marco",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -0.75, jy: 0.0,
    palette: "ocean",
  },
  {
    name: "Julia: Basilica",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -1.0, jy: 0.0,
    palette: "ember",
  },
  {
    name: "Julia: Airplane",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -1.75487766624669276, jy: 0.0,
    palette: "ocean",
  },
  {
    name: "Julia: Siegel Disk",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 500,
    jx: -0.3905407802, jy: -0.5867879073,
    palette: "dusk",
  },
  {
    name: "Julia: Dendrite",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: 0.0, jy: 1.0,
    palette: "terminal",
  },
  // Burning Ship: fractal-math.md §6
  {
    name: "Burning Ship: Hull",
    type: "burningship",
    // The ship's main body with the small replica to port. The original framing (cx -0.5,
    // cy -0.5, scale 0.5) was a fully non-escaping window — a solid black frame, measured 0%
    // lit in the 2026-08-04 preset sweep, which also made the Burning Ship TYPE look broken
    // since this preset is its default.
    cx: -1.0, cy: -0.35,
    scale: 1.8,
    maxIter: 500,
    palette: "bone",
  },
  {
    name: "Burning Ship: Sails",
    type: "burningship",
    cx: -1.762, cy: -0.028,
    scale: 0.002,
    maxIter: 1000,
    palette: "ember",
  },
  {
    name: "Burning Ship: Deep Rigging (1e-30)",
    type: "burningship",
    re: "-1.76192523161224415271162957800471045173625355569470020816",
    im: "-0.027245702174466752640748790580713249759395229786944866636",
    cx: -1.7619252316122442, cy: -0.027245702174466754,
    scale: 1e-30,
    maxIter: 2000,
    palette: "bone",
  },
];
