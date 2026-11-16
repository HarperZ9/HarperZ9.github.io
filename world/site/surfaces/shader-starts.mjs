// shader-starts.mjs: the shaders the shader room starts from. The first is the runner's own default
// (system/shader-runner.js). The other three are written for this room, one for each thing another tool can hand in:
// colours (iPalette), a picture (iChannel0) and the pointer (iMouse). Each one runs with nothing handed in, and says in
// its first comment what it does then. The contract is the runner's: void mainImage(out vec4, in vec2), WebGL 1 GLSL.
import { DEFAULT_FRAG } from '../../../system/shader-runner.js';

const PALETTE = `// Bands in the colours another room hands in (iPalette).
// With no colours handed in, it uses three of its own.
vec3 colour(float i){
  if (iPaletteSize < 1.0) {
    if (i < 1.0) return vec3(0.96, 0.93, 0.86);
    if (i < 2.0) return vec3(0.12, 0.27, 0.45);
    return vec3(0.83, 0.36, 0.22);
  }
  vec3 c = iPalette[0];
  for (int k = 1; k < 5; k++) if (float(k) <= i && float(k) < iPaletteSize) c = iPalette[k];
  return c;
}
void mainImage(out vec4 O, in vec2 U){
  vec2 p = U / iResolution.xy;
  float n = max(iPaletteSize, 3.0);
  // knob A sets how many bands, knob B how far they lean, knob C how soft the edges are
  float bands = floor(mix(3.0, 24.0, iKnobA));
  float lean = (iKnobB - 0.5) * 2.0;
  float x = p.x + lean * (p.y - 0.5) + 0.03 * sin(p.y * 9.0 + iTime * 0.6);
  float t = x * bands;
  float i = mod(floor(t), n);
  float j = mod(i + 1.0, n);
  float soft = mix(0.002, 0.5, iKnobC);
  float m = smoothstep(1.0 - soft, 1.0, fract(t));
  O = vec4(mix(colour(i), colour(j), m), 1.0);
}`;

const PICTURE = `// A picture from another room (iChannel0), seen through moving water.
// With no picture handed in, it draws a grid to bend.
vec3 source(vec2 uv){
  if (iChannelResolution.x <= 1.0) {
    vec2 g = abs(fract(uv * 8.0) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    return mix(vec3(0.07, 0.10, 0.16), vec3(0.93, 0.90, 0.82), line);
  }
  return texture2D(iChannel0, clamp(uv, 0.0, 1.0)).rgb;
}
void mainImage(out vec4 O, in vec2 U){
  vec2 uv = U / iResolution.xy;
  // knob A sets the height of the ripples, knob B their size, knob C how far red and blue part
  float amp = iKnobA * 0.05;
  float freq = mix(4.0, 40.0, iKnobB);
  vec2 d = amp * vec2(sin(uv.y * freq + iTime * 1.3), cos(uv.x * freq * 0.8 - iTime * 1.1));
  float split = iKnobC * 0.012;
  vec3 c = vec3(source(uv + d * (1.0 + split * 40.0)).r, source(uv + d).g, source(uv + d * (1.0 - split * 40.0)).b);
  O = vec4(c, 1.0);
}`;

const POINTER = `// A lamp that follows the pointer (iMouse) over a raised surface.
// With the pointer away, the lamp circles on its own.
float height(vec2 p){
  return 0.5 * sin(p.x * 7.0) * sin(p.y * 7.0) + 0.25 * sin(p.x * 17.0 + p.y * 13.0);
}
void mainImage(out vec4 O, in vec2 U){
  vec2 p = (U - 0.5 * iResolution.xy) / iResolution.y;
  vec2 lamp = iMouse.x + iMouse.y > 0.0 ? (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y : 0.35 * vec2(cos(iTime * 0.5), sin(iTime * 0.7));
  // knob A sets how raised the surface is, knob B the lamp's height, knob C its warmth
  float e = 0.004, k = mix(0.2, 2.0, iKnobA);
  vec3 n = normalize(vec3(-(height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0))) * k / (2.0 * e) * 0.02,
                          -(height(p + vec2(0.0, e)) - height(p - vec2(0.0, e))) * k / (2.0 * e) * 0.02, 1.0));
  vec3 l = normalize(vec3(lamp - p, mix(0.08, 0.6, iKnobB)));
  float lit = max(dot(n, l), 0.0) / (1.0 + 6.0 * dot(lamp - p, lamp - p));
  vec3 base = iPaletteSize >= 1.0 ? iPalette[0] : vec3(0.80, 0.74, 0.62);
  vec3 warm = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.82, 0.60), iKnobC);
  O = vec4(base * warm * (0.08 + 1.6 * lit), 1.0);
}`;

export const STARTS = Object.freeze([
  { id: 'interference', name: 'Interference', uses: 'time', glsl: DEFAULT_FRAG.replace('// edit me — a live fragment shader.', '// Seven waves crossing at even angles. Change a number and watch.') },
  { id: 'bands', name: 'Bands in the handed colours', uses: 'the palette', knobs: 'A: number of bands. B: lean. C: soft edges.', glsl: PALETTE },
  { id: 'water', name: 'A picture through water', uses: 'a picture', knobs: 'A: ripple height. B: ripple size. C: colour fringe.', glsl: PICTURE },
  { id: 'lamp', name: 'A lamp at the pointer', uses: 'the pointer', knobs: 'A: relief. B: lamp height. C: warmth.', glsl: POINTER },
]);
export const startOf = (id) => STARTS.find((s) => s.id === id) || null;
