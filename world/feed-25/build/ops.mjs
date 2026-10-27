// ops.mjs: the operator table the chain is built from. Tone operators work per pixel; glitch operators
// move pixels. Every operator has the shape (layer, options) and replaces the layer's pixels.
import { TONE } from './tone.mjs';
import { GLITCH } from './glitch.mjs';

export const OPS = Object.freeze({ ...TONE, ...GLITCH });
export * from './tone.mjs';
export * from './glitch.mjs';
