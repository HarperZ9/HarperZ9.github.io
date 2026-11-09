// demo-canvas.js: canvas helpers shared by the page modules.
// R5: every 2D art canvas is display-p3. Pixels are written as sRGB ImageData (and drawn in sRGB CSS colours), which
// the browser converts on put, so sRGB maths is never mislabelled as P3, and an sRGB screen shows the same colours.
export const ctx2d = (cv) => cv.getContext('2d', { colorSpace: 'display-p3' });
export const srgbImage = (data, w, h) => new ImageData(data, w, h, { colorSpace: 'srgb' });
