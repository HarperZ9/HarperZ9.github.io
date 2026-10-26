// lib/medium/topview.mjs: the medium's top view, for browser pages: topView(canvas, opts) returns the GPU field
// (gpu/medium.js) whose add(kind, where, amount, props) is the same call as the tank's. Kept out of index.mjs, which
// Node also loads, because the top view needs WebGL2.
export { createMedium as topView, LAYERS } from './gpu/medium.js';
