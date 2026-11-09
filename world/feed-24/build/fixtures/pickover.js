// fixtures/pickover.js: private test fixture, never shipped on a page. The exact reproduction of the
// reference image's framing (feed set 24, item 1.9), kept so tests can check the field against a fit.
// The window that best explains the reference (blurred-colour R^2 0.82 against a linear map of h,
// frames/hamming_fit3.json): X = x + 288, Y = y + 65, one coordinate per pixel. Its mirror
// { x0: 735, sx: -1, y0: 65 } fits equally, because 735 - x = 1023 - (x + 288) complements 10 bits.
export const FITTED_VIEW = Object.freeze({ x0: 288, y0: 65 });

// Palettes are lists of [r, g, b], indexed by h. PICKOVER_ESTIMATE is the median colour per value measured
// from the lossy reference in the fitted view: an estimate of 11 of his 16 colours, not his palette file.
export const PICKOVER_ESTIMATE = [
  [0x55, 0x71, 0x68], [0xbb, 0x59, 0x89], [0x94, 0x01, 0x3f], [0x96, 0x1a, 0x41], [0xa2, 0x57, 0x5e],
  [0xcc, 0xad, 0xab], [0x60, 0x56, 0x72], [0x5c, 0x70, 0x96], [0x8f, 0xd7, 0xe8], [0x87, 0xfb, 0xe4], [0x53, 0xb1, 0x94],
];

