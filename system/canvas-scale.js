// canvas-scale.js, hi-DPI backing store helper for the Studio.
// Zero dependencies. Exported as ES module; node-testable (no DOM required beyond what's
// passed in, so tests stub the canvas object with {width, height, getBoundingClientRect}).
//
// sizeToDisplay(canvas, opts) → { w, h }
//   Sets canvas.width / canvas.height to the device-pixel backing resolution,
//   clamped so the longer side ≤ maxBacking.  CSS keeps the canvas at its layout
//   (display) size; the backing store matches real device pixels so the image is crisp.
//
// The clamp formula (keeping aspect):
//   rawW = round(cssW * dpr * quality)
//   rawH = round(cssH * dpr * quality)
//   longer = max(rawW, rawH)
//   if longer > maxBacking: scale both by maxBacking / longer
//   w = max(1, round(rawW * scale))
//   h = max(1, round(rawH * scale))

export function sizeToDisplay(canvas, opts) {
  const {
    maxBacking = 1600,
    dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1,
    quality = 1,
  } = opts || {};

  const rect = canvas.getBoundingClientRect
    ? canvas.getBoundingClientRect()
    : { width: canvas.width, height: canvas.height };

  const cssW = Math.max(1, rect.width  || canvas.width  || 1);
  const cssH = Math.max(1, rect.height || canvas.height || 1);

  let rawW = Math.round(cssW * dpr * quality);
  let rawH = Math.round(cssH * dpr * quality);

  const longer = Math.max(rawW, rawH);
  if (longer > maxBacking) {
    const scale = maxBacking / longer;
    rawW = Math.max(1, Math.round(rawW * scale));
    rawH = Math.max(1, Math.round(rawH * scale));
  }

  canvas.width  = rawW;
  canvas.height = rawH;

  return { w: rawW, h: rawH };
}
