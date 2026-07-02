// studio-loop.js: pure decision helpers for the Studio live perception loop and fullscreen backing.
// Zero dependencies, no DOM. Extracted from studio.js so the loop's halting invariant and the
// fullscreen backing ceiling can be unit-tested in node (studio.js itself is DOM-coupled and not
// importable under node). ASCII only.

// Which sources keep changing the canvas on their own and therefore must NEVER let the live
// perception loop self-terminate on a static perceptual hash:
//   - fractal3d : the GL orbit repaints every rAF frame
//   - ndim      : the n-dim animation repaints every rAF frame
//   - music     : the reactive engine draws over the canvas every rAF frame
//   - watch     : screen / camera capture is blitted each tick
//   - byo       : ONLY while a dropped video is actually playing
// Static sources (atelier, 2D fractal, a still image) hold one frame, so the loop is free to idle.
//
// state: { canvasIsGL, byoPlaying, watchActive }
//   canvasIsGL: a GL canvas (3D orbit OR 2D GPU fractal) is currently mounted. We do NOT treat a
//               2D GPU fractal as animated; only activeSource decides that, so this flag is unused
//               by the animated test below and is kept only for callers that want it. The
//               activeSource check is authoritative.
export function sourceIsAnimated(activeSource, state) {
  const s = state || {};
  switch (activeSource) {
    case "fractal3d":
    case "ndim":
    case "music":
    case "watch":
    case "discovery":   // the physics renderer evolves the system every frame
      return true;
    case "showcase":
      // The First Integral scene animates through states 1 to 3 (seed, motion, law) and then
      // settles on the witness frame; once settled the loop is free to idle. With no state
      // supplied we err animated, matching the other animated sources' no-state behavior.
      return !s.showcaseSettled;
    case "byo":
      return !!s.byoPlaying;   // a still image is static; a playing video is animated
    default:
      return false;            // atelier, 2D fractal, still image
  }
}

// The loop halts ONLY when the frame is static AND the source is not animated. This is the missing
// invariant: an animated source whose hash briefly repeats (e.g. a slow orbit, a quiet music beat)
// must keep being read instead of freezing the readout.
export function shouldHaltOnStatic(hashIsStatic, animated) {
  return !!hashIsStatic && !animated;
}

// Fullscreen / large-display backing ceiling. The real driver of backing resolution is the display
// size times devicePixelRatio; the flat windowed ceiling (e.g. 1600) is too low to stay crisp when
// the canvas is blown up to fill a 4K hi-DPI screen. Gate on the longer screen edge * dpr, clamped
// to a GPU-safe ceiling. CPU-bound per-pixel sources (the 2D fractal) pass a lower hardCap to avoid
// jank; GPU / blit / music paths pass the full 4096.
//   screenW, screenH : screen.width / screen.height (CSS px)
//   dpr              : devicePixelRatio
//   opts.hardCap     : absolute ceiling (default 4096)
//   opts.floor       : never go below this (default 1600, the windowed standard)
export function fullscreenMaxBacking(screenW, screenH, dpr, opts) {
  const o = opts || {};
  const hardCap = o.hardCap || 4096;
  const floor = o.floor || 1600;
  const longer = Math.max(1, screenW || 0, screenH || 0) * (dpr || 1);
  const target = Math.round(longer);
  return Math.max(floor, Math.min(hardCap, target));
}
