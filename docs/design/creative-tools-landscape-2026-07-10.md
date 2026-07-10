# The small creative tools landscape - assessment (2026-07-10)

Read-only survey of the best small, browser-local generative/creative tools:
community favorites (the generative/plotter/creative-coding subreddit cluster)
plus the wider landscape. Each entry carries ONE borrowable mechanic and its
fit for this site. Compiled to make the site more enjoyable for every visitor.

## Community favorites

### Turtletoy
- url: https://turtletoy.net/
- what: Browser platform for hand-coded black-and-white turtle-graphics art; every piece is open source, renders progressively like a pen drawing, and exports SVG/GCODE for plotters. 8000+ users over five years; the closest thing r/plotterart has to a shared clubhouse (platform facts verified; subreddit-clubhouse claim moderate confidence).
- why loved: Severe constraint (one pen, square canvas, monochrome lines) plus radical openness: every gallery piece IS its source code, and watching the turtle draw is half the pleasure — it previews exactly what the physical plot will do.
- borrowable mechanic: Progressive draw-order replay: render the piece stroke-by-stroke in plot order rather than blitting the finished frame, so the viewer watches it being drawn.
- fit here: Plotter lane and gallery: animate each plate's SVG paths in pen order on hover or on a 'watch it plot' button. Zero server, pure client-side path animation, and it directly showcases that these plates are physically plottable.

### tixy.land
- url: https://tixy.land/
- what: 16x16 dot matrix driven by one JavaScript function of (t,i,x,y), input capped at 32 characters, code persisted in the URL.
- why loved: The entire system fits in your head in ten seconds; the 32-char cap turns making art into a golf game; and because state lives in the URL, every discovery is instantly a shareable link. It went viral in creative-coding circles for exactly these reasons (verified via bram.us and esolangs writeups).
- borrowable mechanic: One visible, editable formula directly under the artwork that re-renders on every keystroke, with the formula serialized into the share URL.
- fit here: Studio: add a 'microkernel' toy — one short expression driving a dot/line matrix in the site's dark plate aesthetic. The existing share-link plumbing already covers the URL-state half; this is the cheapest high-delight addition on this list.

### Sandspiel
- url: https://sandspiel.club/
- what: Max Bittker's falling-sand cellular automaton (Rust->WASM): pick an element, paint it onto a live simulation, watch sand/water/fire/plant/fungus interact. Free, no signup, open source.
- why loved: Painting into a RUNNING simulation gives authorship without skill — you never draw badly because physics finishes the drawing for you. The public GIF gallery means every visitor can leave something behind.
- borrowable mechanic: Paint-to-perturb: the cursor injects material/energy into an already-running system instead of drawing static marks.
- fit here: Print desk: let visitors brush directly into a live plate (inject flow-field turbulence, deposit particles) before freezing it to PNG. The plate stops being an artifact you look at and becomes a system you touched — then the existing PNG save captures 'their' version.

### WebGL Fluid Simulation (Pavel Dobryakov)
- url: https://paveldogreat.github.io/WebGL-Fluid-Simulation/
- what: GPU Navier-Stokes solver in the browser; pointer movement splats dye into swirling fluid. 16k+ GitHub stars, works on mobile, everything tweakable via a small control panel.
- why loved: It is gorgeous within 100ms of the first accidental mouse move, with zero UI to understand first. It is probably the most-reshared pure browser toy in these communities (star count verified; 'most-reshared' is moderate confidence).
- borrowable mechanic: Reward the very first pointer movement: the hero canvas responds beautifully before the visitor has read anything or clicked anything.
- fit here: Gallery landing: make the hero plate cursor-reactive (advect the plate's own field along pointer velocity). Costs one shader hook in the existing pipeline and converts every arriving visitor from reader to player in under a second. Mobile touch must work — half of this tool's fame is that it does.

### fieldplay (anvaka)
- url: https://anvaka.github.io/fieldplay/
- what: WebGL vector-field explorer: a GLSL formula defines the field, up to a million GPU particles flow through it, a Randomize button rerolls the formula, and the full field definition is serialized into the URL.
- why loved: The Randomize button makes exploration free — no blank-canvas paralysis — and URL-state means any lucky roll can be bookmarked and shared without an account.
- borrowable mechanic: Reroll + permalink pair: a one-click randomizer whose every output is immediately addressable as a URL.
- fit here: Print desk: the seed/layer state should have a big, satisfying 'reroll' affordance (spacebar, dice button) and every roll should silently update the share link. The site already has share links; the gap to close is making rerolling feel frictionless and consequence-free.

### Watabou's Medieval Fantasy City Generator
- url: https://watabou.itch.io/medieval-fantasy-city-generator
- what: One-click procedural city maps with district names, warp deformation, and PNG/SVG/JSON export. Created FOR r/proceduralgeneration monthly challenge #17 and still that community's flagship generator (origin verified from itch.io page).
- why loved: It respects partial attachment: right-click a district to regenerate just that piece while keeping the parts you like. Users curate rather than gamble — the generator becomes a collaborator.
- borrowable mechanic: Local reroll: click a region/layer of the output to regenerate only it, keeping everything else locked.
- fit here: Print desk layer mixing is 90% of the way there: add per-layer lock/reroll so a visitor can keep the composition they love and reroll only the texture layer (or click a region of the plate to disturb just that area). This is the single strongest upgrade to the existing seed+layer machinery.

### Townscaper web demo / Brick Block (Oskar Stålberg)
- url: https://oskarstalberg.com/Townscaper/
- what: Click-to-build town toys where a wave-function-collapse-style constraint solver interprets each click into architecture that always looks intentional. Stålberg explicitly frames them as 'toys, not games' — no goals, no failure.
- why loved: The algorithm meets you halfway: every input, however careless, produces a curated-feeling result. There is no way to make something ugly, which removes all performance anxiety.
- borrowable mechanic: Constraint-solved input: user clicks are suggestions the system resolves into guaranteed-good geometry, never raw edits that can break the aesthetic.
- fit here: Studio mesh viewport: let clicks add/remove structure through a rule set that keeps the mesh coherent (snap to the structure grammar rather than free vertex editing). Also a design principle for the whole print desk: no parameter combination should be able to produce a bad plate.

### Particle Life (browser implementations)
- url: https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html
- what: Point particles with an asymmetric type-to-type attraction/repulsion matrix; simple rules yield cell-like creatures that chase, orbit, and reproduce. Multiple WebGL/WebGPU browser versions circulate; rule sets are saveable as JSON and shareable as links.
- why loved: Maximum emergence per line of code — people share it saying 'look what appeared,' not 'look what I made.' Each reroll of the rule matrix is a new little universe (recurring on r/proceduralgeneration and r/generative: moderate confidence, from memory; mechanics verified from lisyarus post).
- borrowable mechanic: The editable interaction matrix as UI: a small colored grid of type-pair forces the user can poke, with the simulation reacting live.
- fit here: Studio: an emergence plate whose 'seed' IS a rule matrix, serialized into the existing share links. The tiny force-grid doubles as a legible, honest control surface — you can see exactly what system produced what you're watching, which matches the site's receipts sensibility.

### Shadertoy
- url: https://www.shadertoy.com/
- what: The canonical GLSL playground: 50k+ public shaders, all code open, in-browser editor with immediate feedback, fork/like/comment mechanics.
- why loved: Every stunning piece doubles as a lesson because the source is one click away, and forking makes building on someone else's work the default social gesture rather than theft.
- borrowable mechanic: Fork lineage: each piece records what it was derived from, forming a visible ancestry chain.
- fit here: Gallery: when a visitor remixes a plate at the print desk and shares it, encode the parent plate's seed in the share link and show 'derived from plate #N' on the result. Client-side provenance for artworks — this is the operator's receipts thesis expressed as a toy, essentially free given seeds already travel in links.

### Hydra (hydra.ojack.xyz)
- url: https://hydra.ojack.xyz/
- what: Olivia Jack's live-codeable video synth in the browser: chain oscillators, kaleidoscopes, feedback, and webcam feeds like modular synth patches; Ctrl+Enter re-evaluates live. Free, open source, a staple of r/creativecoding and the live-coding scene (staple claim moderate confidence; tool facts verified).
- why loved: The patch-chain syntax reads like the picture it makes — osc().kaleid().rotate() — so the code is legible even to non-coders, and live evaluation makes tweaking feel like performing rather than programming.
- borrowable mechanic: Show the small readable expression that generates the visuals, and let Ctrl+Enter (or an Apply button) hot-swap it without breaking the render loop.
- fit here: Studio audio-reactive lane: expose the current audio-to-visual mapping as a short editable chain instead of hidden config. Visitors who just watch lose nothing; visitors who edit get a live-coding instrument.

### plotterfun (mitxela)
- url: https://mitxela.com/plotterfun/
- what: Fully client-side image-to-plottable-SVG converter: drop a photo, choose among squiggle, spiral, weighted-voronoi stippling (with TSP path optimization), Delaunay and other algorithms, tune sliders with live preview, download SVG. Descended from SquiggleCam/StippleGen, widely used in the plotter community (usage breadth moderate confidence; tool facts verified).
- why loved: It gives non-coders a way INTO plotter art: bring your own photo, leave with a file your machine can draw. The algorithm dropdown with instant preview makes comparing vectorization styles a game.
- borrowable mechanic: Bring-your-own-input: user drops an image and the site's algorithms transform it, with an algorithm switcher that re-renders the same input live.
- fit here: Plotter lane: a 'feed the machine' page that runs the site's own line/hatching algorithms over a visitor's dropped image, all client-side, exporting SVG. It is the one page a plotter person would bookmark and send friends to, and it advertises the lane's actual algorithms.

### Reaction-Diffusion Playground (Jason Webb)
- url: https://jasonwebb.github.io/reaction-diffusion-playground/
- what: Interactive Gray-Scott reaction-diffusion sim with a clickable 2D parameter map for jumping straight to interesting regions of parameter space, image-based style maps, seed patterns (circle/text/image), and multiple render styles.
- why loved: The parameter map solves the universal generative-tool problem — sliders that mostly produce mush — by making the interesting subspace visible and directly clickable. From the author of the community-standard morphogenesis-resources list.
- borrowable mechanic: A 2D picker over parameter space (with thumbnails or labeled regions) instead of independent sliders; clicking teleports the system to that regime.
- fit here: Print desk: replace or augment layer-mix sliders with a small 2D pad where each corner is a known-good regime of the current plate's kernel. Visitors surf between guaranteed-interesting outputs instead of bisecting slider mush.

### Dwitter
- url: https://www.dwitter.net/
- what: Social feed of JavaScript canvas demos whose entire draw function must fit in 140 characters; every dweet has a remix button that opens the code pre-loaded in the editor; themed hashtag feeds and challenges.
- why loved: The 140-char cap makes every piece both astonishing ('THAT fits in a tweet?') and fully readable, and the remix button lowers the participation floor to 'change one number and see.'
- borrowable mechanic: Remix-opens-editor: the share/detail view of any piece has one button that drops its full generating code into a live editor.
- fit here: Gallery: for plates with compact kernels, a 'view kernel' panel showing the actual generating code, with editable constants that re-render live. It converts the gallery from exhibition to invitation and proves the plates are real code, not renders.

### Weave Silk
- url: http://weavesilk.com/
- what: Yuri Vishnevsky's drag-to-draw generative art toy: pointer strokes become luminous strands mirrored under 2- to 6-fold radial symmetry. A decade-plus of sustained love; still passed around as the canonical 'anyone can make something beautiful' link.
- why loved: Symmetry is a skill amplifier — one lazy stroke becomes an intricate mandala — so the gap between effort and result is enormous in the user's favor, on a dark background that makes everything glow.
- borrowable mechanic: N-fold symmetry multiplier on pointer input, toggleable live while drawing.
- fit here: Studio or a standalone interactive plate: visitor strokes rendered in the site's plate aesthetic (dark ground, fine luminous lines) under selectable symmetry, saveable via the existing PNG print path. Also plotter-relevant: symmetric strokes exported as SVG are inherently plottable.

### OpenProcessing remix culture
- url: https://openprocessing.org/
- what: 100k-coder p5.js/Processing sharing platform; a 2023 ACM DIS study of 1.2M sketches found 30% were involved in remixing, used not just to extend code but to curate, annotate ('changed how it renders to feel more stylized'), and tune variations.
- why loved: Forking is the community's love language: the study shows people remix to leave notes on what they changed and why — provenance and commentary fused with the artwork itself.
- borrowable mechanic: Fork-with-note: when saving a variation, capture a one-line 'what I changed' that travels with it.
- fit here: Print desk: when a visitor saves/shares a remixed plate, offer an optional caption stored in the share-link fragment ('cranked layer 3, killed the grid'). Costs nothing server-side and makes shared links feel authored rather than generated.

### neal.fun (as a pattern)
- url: https://neal.fun/
- what: Neal Agarwal's collection of tiny interactive pages (4M+ visits/month): each does one small delightful thing immediately, with restraint and polish and zero engagement machinery.
- why loved: As one analysis put it, it 'rarely asks you to admire the idea from a distance — it asks you to do something small immediately,' and it respects the visitor's intelligence: no signup, no tutorial, no dark patterns.
- borrowable mechanic: The one-second rule: something on the page responds to the visitor's input before any reading or instruction is required.
- fit here: Site-wide audit criterion rather than a feature: on every page (gallery, print desk, studio), what happens if the visitor just moves the mouse or taps in the first second? If the answer is 'nothing,' that page fails the toy test. The art-magazine register can keep text quiet precisely because the plates themselves answer touch.

### fxhash seed ritual (mechanic only — the marketplace needs a chain, the mechanic doesn't)
- url: https://www.fxhash.xyz/article/defining-long-form-generative-art
- what: Long-form generative art platform where each mint draws a unique seed the artist never curated; collectors can reroll disliked outputs, and fx(params) lets them tune artist-exposed parameters so 'their' output is theirs.
- why loved: The seed lottery creates genuine ownership stakes in a deterministic system: your seed, your variation, nobody else's. The reroll/keep decision is itself a pleasurable ritual of taste.
- borrowable mechanic: Claim-your-seed: derive a stable, human-readable edition label from the seed (e.g. 'plate 07 — edition #a3f9, 1 of 2^32') and stamp it on the saved PNG and share link.
- fit here: Print desk: stamp each saved print with its plate number, seed-derived edition hash, and date in a discreet corner — a client-side certificate of the exact variation. Pure determinism-as-provenance, no server, and it dignifies the PNG into a print.

### Chaos Equations (CodeParade lineage, web ports)
- url: https://github.com/jereddanielson/chaos-equations
- what: Random polynomial parameter equations animated over time t: the system continuously drifts through parameter space, occasionally erupting into spectacular structure. CodeParade's video went viral in procgen circles (viral claim moderate confidence); WebGL ports run client-side.
- why loved: The autonomous drift means the toy performs even for a completely passive viewer, and the intermittent-jackpot structure ('wait... there!') makes people want to catch and share specific moments.
- borrowable mechanic: Freeze-the-moment: a continuously self-evolving parameter with one button that bookmarks the current t into the share URL.
- fit here: Studio nD projection: let a projection parameter drift slowly on idle, with a 'hold' key freezing it and writing the exact t into the share link. Gives idle visitors a show and active visitors a hunting game — and idle-drift makes gallery plates feel alive at zero interaction cost.

**Patterns:** Every tool this cluster genuinely loves passes the one-second test: the fluid sim, Silk, Sandspiel, and Townscaper all reward the first accidental pointer movement before the visitor has read a word, so play begins prior to comprehension. Second, legible constraint beats infinite capability — tixy's 32 characters, Dwitter's 140, Turtletoy's single pen — because a system a visitor can hold in their head is a system they'll dare to poke, and the tight cap makes every good result feel like a magic trick. Third, state-in-URL is the community's distribution engine: fieldplay, tixy, hydra, and the site's existing share links all work because a lucky roll becomes a sendable artifact with no account or server, and rerolling is consequence-free so people gamble freely. Fourth, open code and remix are the social fabric — 30% of OpenProcessing's 1.2M sketches are forks, and Shadertoy/Turtletoy/Dwitter all make 'crack it open' a one-click default — so a gallery that exposes its kernels converts admirers into participants. Finally, ownership of a specific variation ('my seed, my edition, I was here') is what makes visitors return and share, which the print desk is already 80% built for; caveat: reddit was fetch-blocked in this environment, so per-subreddit reception claims are triangulated from platform sources and labeled with confidence inline rather than verified against live threads.

## The wider landscape

### tixy.land
- url: https://tixy.land/
- what: Write one JS expression of (t,i,x,y), max 32 characters, and a 16x16 dot grid animates it live.
- why loved: Zero setup, one input box, and the brutal 32-char limit means every example is readable in one glance yet produces motion that looks impossible for its size.
- borrowable mechanic: Click-to-advance curated examples: the canvas itself is the tutorial — tapping the artwork cycles through progressively wilder presets, teaching the parameter space before you ever type.
- fit here: Gallery idle-state: each gallery tile can be a live micro-function; clicking a tile before opening it cycles seed variants, so browsing is already playing.

### Dwitter
- url: https://www.dwitter.net/
- what: Community feed of JS canvas demos where u(t) runs at 60fps and the entire program must fit in 140 characters.
- why loved: The char counter (e.g. 135/140) turns every demo into a puzzle, and viewing/running/editing needs no login — the code IS the content.
- borrowable mechanic: Visible remix lineage: every piece shows 'remix of d/35814' with a live credit chain, so derivation is celebrated rather than hidden.
- fit here: Stamp each gallery piece with its byte count and its ancestry ('remixed from plate 07'), making the procedural corpus feel like a living family tree.

### Turtletoy
- url: https://turtletoy.net/
- what: JS turtle-graphics sketchbook where every sketch is a single pen line, exportable as plotter-ready SVG/GCODE.
- why loved: The one-pen constraint makes everything look like ink on paper, all sketches are open source, and the 'most loved turtles' wall is a Molnar-style museum you can fork.
- borrowable mechanic: Output-medium-as-constraint: because the target is a physical pen plotter, the tool only offers monochrome line operations — the limitation is the aesthetic.
- fit here: The print desk's backbone: pieces authored under a strict single-stroke/monochrome rule export straight to SVG for plotting, matching a dark-ink site register exactly.

### Shadertoy
- url: https://www.shadertoy.com/
- what: Browser GLSL editor and gallery: fragment shaders recompile as you type against iTime/iMouse uniforms, no login needed to browse and run.
- why loved: Sub-second recompile-on-edit gives the fastest idea-to-pixels loop in graphics, and the fork button made it the canon of raymarching culture.
- borrowable mechanic: Standardized uniforms contract (iTime, iMouse, iResolution): every piece speaks the same tiny input protocol, so any shader drops into any player.
- fit here: Define one uniform contract for all gallery pieces (time, pointer, seed, palette) so the site chrome can drive, thumbnail, and cross-fade every work identically.

### OpenProcessing
- url: https://openprocessing.org/
- what: Host and gallery for p5.js sketches; anyone can run, open the code beside the canvas, and fork.
- why loved: Code-next-to-canvas by default makes every artwork a lesson; over a million open sketches means any technique has a findable, runnable example.
- borrowable mechanic: Source-as-first-class-view: the toggle between 'watch it' and 'read it' is one click, never a separate page.
- fit here: Give every gallery plate a 'view source' flip — the code panel slides over the piece, styled as part of the artwork, reinforcing the procedural thesis.

### Bytebeat Composer (dollchan)
- url: https://dollchan.net/bytebeat/
- what: Type a single math expression of t and it becomes an 8-bit audio waveform playing live, with a library of classic formulas.
- why loved: One line of arithmetic produces surprisingly musical chiptune; the entire song serializes into the URL, so sharing a track is pasting a link.
- borrowable mechanic: The URL is the save file: full program state compresses into the address bar, giving shareable, forkable seeds with zero backend.
- fit here: Studio audio toy plus site-wide convention: encode every piece's seed+params in the URL hash so visitors can bookmark and trade exact states.

### Sandspiel
- url: https://sandspiel.club/
- what: WASM falling-sand cellular automata: paint sand, water, plant, fire, lava onto a canvas and watch the elements interact.
- why loved: Painting matter that immediately obeys physics is universally legible — no instructions needed — and the community upload wall shows strangers' worlds.
- borrowable mechanic: Paint-as-input: the brush is the only tool, and every element pair has a reaction, so exploration is combinatorial rather than menu-driven.
- fit here: Studio piece where visitors seed a simulation by drawing; their strokes become initial conditions for a dark, slow-burning CA that they can screenshot.

### copy.sh/life
- url: https://copy.sh/life/
- what: Hashlife-powered Game of Life simulator running mega-patterns (Tetris processor, Gemini) entirely client-side with zoom, step, and rewind.
- why loved: Infinite smooth zoom from single cells to million-cell machines, plus Backspace-to-rewind, makes emergence feel navigable like a map.
- borrowable mechanic: Time scrubbing on a deterministic system: step forward, rewind, and change generation stride — the timeline is an instrument, not just play/pause.
- fit here: Add a generation scrubber to gallery simulations; because pieces are seeded and deterministic, visitors can rewind to the exact frame they want to print.

### Reaction-Diffusion Playground (Jason Webb)
- url: https://jasonwebb.github.io/reaction-diffusion-playground/app.html
- what: GPU Gray-Scott reaction-diffusion sim where you click a Karl Sims-style parameter map to pick feed/kill regimes and draw to seed patterns.
- why loved: Instead of guessing slider values, you click a picture of the behavior space and instantly get corals, mazes, or mitosis — the map demystifies the math.
- borrowable mechanic: Parameter map as picker: a 2D image of the regime space replaces raw numeric sliders, so choosing behavior is visual and spatial.
- fit here: Print desk regime picker: expose each generator's parameter space as a clickable thumbnail map ('pick your texture') rather than a wall of sliders.

### Boids (Ben Eater)
- url: https://eater.net/boids
- what: Canonical flocking demo with sliders for coherence, separation, alignment, and visual range, plus a trace-paths toggle.
- why loved: Three rules produce lifelike murmuration, and the sliders are named after behaviors, so tweaking feels like directing animals rather than tuning constants.
- borrowable mechanic: Behavior-named controls: sliders labeled 'separation' and 'visual range' instead of k1/k2 make the parameter space self-explanatory.
- fit here: Ambient background flock for the site (trace-paths mode suits a dark theme); studio controls named after what they do, never after the math symbol.

### L-Systems Turtle Renderer (Kevin Roast)
- url: https://www.kevs3d.co.uk/dev/lsystems/
- what: Client-side L-system editor: axiom plus up to five rewrite rules, angle and iteration sliders, with 16+ one-click fractal presets.
- why loved: The iteration slider is the hook — dragging it watches a stick become a tree, making recursion viscerally understandable.
- borrowable mechanic: Presets that load full state: clicking an example populates every field, so the gallery of outcomes doubles as the tutorial for the input language.
- fit here: Every finished gallery piece should be loadable into the studio as a preset — the portfolio and the tool share one state format.

### Dithermark
- url: https://app.dithermark.com/
- what: Fully client-side image ditherer: drop an image, choose among dozens of BW/color dither algorithms and palettes, live WebGL preview, PNG export.
- why loved: Watching your own photo flip between Atkinson, Bayer, and error-diffusion in real time is instant retro-print gratification with no upload to any server.
- borrowable mechanic: Algorithm A/B on the user's own material: the comparison loop (same input, swap algorithm, instant diff) is the whole interface.
- fit here: Print desk finishing step: pipe any generated frame through a dither/halftone stage with live algorithm switching before SVG/PNG export — pure client-side.

### Fieldplay (Andrei Kashcha)
- url: https://anvaka.github.io/fieldplay/
- what: Edit vector-field equations (GLSL-style v.x/v.y expressions) and thousands of particles instantly flow along the new field; state lives in the URL.
- why loved: One line of math visibly commands ten thousand particles — the ratio of keystroke to consequence is enormous, and every discovery is a copyable link.
- borrowable mechanic: Tiny-equation, massive-response: a two-line editable formula drives the entire visual, keeping the edit surface small enough to invite non-programmers.
- fit here: Noise-field hero background whose formula is one click away from editable; 'share this field' links encode the exact state — the site's shareable-seed pattern.

### A Single Div (Lynn Fisher)
- url: https://a.singlediv.com/
- what: Gallery of illustrations each drawn with exactly one HTML div and pure CSS, source on GitHub, grown through annual #divtober.
- why loved: The absurd constraint (one element!) turns each piece into a magic trick, and view-source is the reveal — the constraint itself became the brand.
- borrowable mechanic: One public constraint as identity: stating the rule ('one div', 'one line', 'one formula') on every piece primes the viewer to be impressed by the how.
- fit here: Print each plate's constraint on its museum label ('one pen stroke', '140 bytes', 'no canvas — CSS only'); the constraint line is the site's signature.

### css-doodle
- url: https://css-doodle.com/
- what: Web component that generates a grid of cells styled by CSS-like rules with @rand/@pick randomness; live playground on the homepage, PNG export built in.
- why loved: Declarative randomness — every page refresh mints a new variation of the same rule set, so the pattern feels alive rather than authored frame by frame.
- borrowable mechanic: Reload-as-reroll: regeneration is bound to the most natural action there is (refresh/click), and the rules stay fixed while the instance varies.
- fit here: Site backgrounds and dividers as seeded css-doodle grids: every visit renders a fresh variation, with a small 'seed: 8f2a' stamp linking to that exact instance.

### Hydra
- url: https://hydra.ojack.xyz/
- what: Browser live-coding video synth: chain functions like osc().kaleid().modulate() and the fullscreen visual updates as you evaluate lines.
- why loved: Modular-synth semantics in code — patching oscillators into each other — and the render never goes black while you edit, so performing feels safe.
- borrowable mechanic: Fail-soft evaluation: broken code never kills the running visual; the last good state persists until a valid new one replaces it.
- fit here: Studio editor rule: the canvas never blanks on error — keep rendering the previous good program so visitors can fearlessly mangle the code.

### Strudel
- url: https://strudel.cc/
- what: TidalCycles ported to the browser: write rhythmic pattern mini-notation in a REPL and hot-swap the running music with one keystroke.
- why loved: The mini-notation ('bd sd [hh hh] sd') reads like a drum tab, and ctrl+enter swaps patterns on the beat — editing is performing.
- borrowable mechanic: Hot-swap on a musical boundary: changes apply at the next cycle, never mid-glitch, so live edits always land gracefully.
- fit here: Studio audio corner; more broadly, apply parameter changes to visual pieces on loop boundaries so tweaks feel composed instead of jarring.

### twigl
- url: https://twigl.app/
- what: GLSL golfing editor with escalating shorthand modes (classic to geekest), live char count, URL sharing without accounts, and built-in GIF/WebM export up to 2048px.
- why loved: The geekest mode's extreme shorthands make 200-char shaders possible, and the one-button animated export turns any sketch into a postable artifact.
- borrowable mechanic: Export-to-artifact built into the toy: GIF/WebM/still export at chosen resolution and frame count is a first-class button, not a screen recording.
- fit here: Every gallery piece gets 'export: PNG / SVG / 4s loop' — the print desk generalized to motion artifacts, all rendered client-side.

### Silk (weavesilk)
- url: http://weavesilk.com/
- what: Drag the mouse and symmetric luminous strands bloom across a dark canvas, by Yuri Vishnevsky with sound by Mat Jarvis.
- why loved: Mirror symmetry plus glow guarantees that any random gesture looks deliberate and beautiful — the tool flatters the visitor within two seconds.
- borrowable mechanic: Symmetry as a skill amplifier: mirroring/rotating every input stroke N ways makes unskilled gestures produce gallery-grade output instantly.
- fit here: The studio's on-ramp toy: dark-background, glowing symmetric drawing with a 'save your plate' export — visitors leave with something they made.

### Medieval Fantasy City Generator (watabou)
- url: https://watabou.itch.io/medieval-fantasy-city-generator
- what: Press Enter and a complete stylized city map generates in-browser, with right-click customization, style presets, and PNG/SVG/JSON export; free for commercial use.
- why loved: The artifact arrives whole in one keypress — you edit a finished thing rather than build from blank, and 3,500+ ratings at 4.8/5 show it stuck.
- borrowable mechanic: Generate-first, customize-second: the tool always shows a complete result immediately, and all controls are contextual edits on that result.
- fit here: Print desk flow: landing on any generator page instantly shows a finished seeded piece; the visitor's first act is refining, not configuring.

### Glyph Drawing Club
- url: https://glyphdrawing.club/
- what: Grid-based text-art and modular typography editor: place, rotate (r), flip (f), and invert (i) glyphs from any font to build type designs and ASCII-style illustrations.
- why loved: It resurrects modular type and teletext art with any font you load, output is license-free, and the keyboard verbs make composing glyphs feel like a game.
- borrowable mechanic: Single-key transform verbs on grid cells (rotate/flip/invert): a tiny fixed verb set over a grid yields huge expressive range with no menus.
- fit here: Generative typography lane: build the site's headers/specimens from modular glyph grids, and expose the r/f/i verb set in a studio type-toy.

**Patterns:** The best of these share six traits. (1) Time-to-first-delight under ~5 seconds: something is already moving before the visitor touches anything — tixy, Fieldplay, Watabou, and Shadertoy all load with a running canonical example; blank-canvas tools are the exception and they compensate with guaranteed-pretty output (Silk). (2) One tiny public constraint that creates depth and identity: 32 chars (tixy), 140 chars (Dwitter), one div (Lynn Fisher), one pen line (Turtletoy), one formula (bytebeat). The constraint is printed on the work like a museum label and does double duty as brand. (3) Immediate parameter feedback with no run button: recompile-on-keystroke (Shadertoy), particles obeying a changed equation instantly (Fieldplay), live algorithm swap on your own image (Dithermark). Where instant is impossible, changes land on a graceful boundary (Strudel's cycle-aligned hot-swap) and errors never blank the render (Hydra's fail-soft evaluation). (4) The URL is the save file: full state serialized into the address bar (bytebeat, twigl, Fieldplay) gives shareable seeds, remixing, and bookmarkable exact instances with zero backend — the single most important pattern for a no-account site. (5) Remix lineage as culture: fork buttons and visible 'remix of' chains (Dwitter, Shadertoy, Turtletoy, OpenProcessing) turn a gallery into a family tree; presets that load complete state (Kevs3d L-systems, Watabou) are the single-player version of the same idea — every output doubles as an input. (6) Export-to-artifact as a first-class button: plotter SVG (Turtletoy), GIF/WebM (twigl), PNG (css-doodle, Dithermark, Watabou). The toys that people love hand you something to keep; that is precisely the print desk. Secondary patterns worth stealing: behavior-named controls instead of math symbols (Eater's boids), a clickable picture of the parameter space instead of sliders (Webb's reaction-diffusion map), deterministic time scrubbing with rewind (copy.sh/life), generate-first-customize-second (Watabou), and symmetry/quantization tricks that guarantee a novice's gesture looks intentional (Silk, Glyph Drawing Club). For this site specifically: adopt one shared uniforms contract across all pieces (Shadertoy's iTime/iMouse lesson) so the gallery chrome can drive, thumbnail, scrub, and export every work through one pipeline, and stamp every rendered instance with its seed so 'the exact thing you saw' is always a link away. All 20 entries were confirmed live in July 2026; none require login or a server for their core loop (Dwitter/Shadertoy/OpenProcessing/Turtletoy need accounts only to publish, not to view, run, or tweak)."

## Applied so far (2026-07-10)
- Turtletoy's plot-order replay -> the print desk's "plot it" (700-stroke pen
  replay on the plate, then a plotter-ready SVG download) and the Studio's
  "SVG plot" export.
- fieldplay's reroll+permalink -> already live (redraw + share links).

## Next quick wins (ranked)
1. Watabou's LOCAL REROLL: per-layer lock/reroll at the print desk (keep the
   composition, reroll one instrument).
2. tixy's 32-char formula toy: a "microkernel" plate driven by one visible
   expression, state in the URL.
3. Fluid-sim's first-move reward: make the gallery hero plate pointer-reactive.
4. Sandspiel's paint-to-perturb: brush turbulence into a live plate before
   freezing it.
5. Particle Life's rule-matrix-as-UI: an emergence plate whose seed IS a small
   editable force grid.
