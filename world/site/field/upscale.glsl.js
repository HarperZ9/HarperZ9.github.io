// upscale.glsl.js: the passes between the scene's own resolution and the screen's pixels. The scene is drawn at a
// scale the frame budget picks (field.js); these passes bring the finished picture to the canvas at device pixels:
// a settle pass for the moving picture, a Catmull-Rom resample, then a contrast-adaptive sharpen. Each one is held
// inside the range of the pixels it reads, so none of them can ring or draw a halo.

// settle: the moving picture's running mean. The history is first held inside the range of this frame's 3 by 3
// neighbourhood, so what the camera has moved off cannot trail behind it, then `uKeep` of it is kept
export const SETTLE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uCur, uHist; uniform float uKeep;
in vec2 v; out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy), hi = textureSize(uCur, 0) - 1;
  vec3 c = texelFetch(uCur, p, 0).rgb, mn = c, mx = c;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec3 n = texelFetch(uCur, clamp(p + ivec2(i, j), ivec2(0), hi), 0).rgb; mn = min(mn, n); mx = max(mx, n); }
  o = vec4(mix(c, clamp(texture(uHist, v).rgb, mn, mx), uKeep), 1.0);
}`;

// resample: bicubic Catmull-Rom from the scene's size (uSrc texels, uPx = 1 / uSrc) to the canvas, as nine bilinear
// reads (the two centre taps of each axis fold into one read between them). The result is clamped to the four texels
// round the sample, which removes the kernel's overshoot at hard edges. A scene drawn larger than the canvas (uDown)
// is averaged down by the texture filter instead
export const UPSCALE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg; uniform vec2 uSrc, uPx; uniform float uDown;
in vec2 v; out vec4 o;
void main() {
  if (uDown > 0.5) { o = vec4(texture(uImg, v).rgb, 1.0); return; }
  vec2 p = v * uSrc, c = floor(p - 0.5) + 0.5, f = p - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  // w1 + w2 = 1 + f (1 - f) / 2, never below 1
  vec2 w12 = w1 + w2, t0 = (c - 1.0) * uPx, t3 = (c + 2.0) * uPx, t12 = (c + w2 / max(w12, 1.0)) * uPx;
  vec3 s = texture(uImg, vec2(t0.x, t0.y)).rgb * (w0.x * w0.y) + texture(uImg, vec2(t12.x, t0.y)).rgb * (w12.x * w0.y) + texture(uImg, vec2(t3.x, t0.y)).rgb * (w3.x * w0.y)
    + texture(uImg, vec2(t0.x, t12.y)).rgb * (w0.x * w12.y) + texture(uImg, vec2(t12.x, t12.y)).rgb * (w12.x * w12.y) + texture(uImg, vec2(t3.x, t12.y)).rgb * (w3.x * w12.y)
    + texture(uImg, vec2(t0.x, t3.y)).rgb * (w0.x * w3.y) + texture(uImg, vec2(t12.x, t3.y)).rgb * (w12.x * w3.y) + texture(uImg, vec2(t3.x, t3.y)).rgb * (w3.x * w3.y);
  ivec2 q = ivec2(c), hi = textureSize(uImg, 0) - 1;
  vec3 a = texelFetch(uImg, clamp(q, ivec2(0), hi), 0).rgb, b = texelFetch(uImg, clamp(q + ivec2(1, 0), ivec2(0), hi), 0).rgb;
  vec3 d = texelFetch(uImg, clamp(q + ivec2(0, 1), ivec2(0), hi), 0).rgb, e = texelFetch(uImg, clamp(q + ivec2(1, 1), ivec2(0), hi), 0).rgb;
  o = vec4(clamp(s, min(min(a, b), min(d, e)), max(max(a, b), max(d, e))), 1.0);
}`;

// sharpen: contrast-adaptive (after Lottes, "FidelityFX Contrast Adaptive Sharpening", AMD 2019). A pixel is pushed
// away from the mean of its four neighbours by at most `uSharp`; the push is weaker where the neighbourhood is
// already near black, near white or at full contrast, and the result stays inside the neighbourhood's own range, so
// a slope gets steeper and nothing overshoots. The display dither (as in the display pass) goes on last, at the
// canvas's own pixels
export const SHARPEN_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg; uniform float uSharp, uFrame;
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy), hi = textureSize(uImg, 0) - 1;
  vec3 c = texelFetch(uImg, p, 0).rgb;
  vec3 n = texelFetch(uImg, clamp(p + ivec2(0, 1), ivec2(0), hi), 0).rgb, s = texelFetch(uImg, clamp(p - ivec2(0, 1), ivec2(0), hi), 0).rgb;
  vec3 e = texelFetch(uImg, clamp(p + ivec2(1, 0), ivec2(0), hi), 0).rgb, w = texelFetch(uImg, clamp(p - ivec2(1, 0), ivec2(0), hi), 0).rgb;
  vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
  vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1.0e-3)), 0.0, 1.0)), k = -amp * uSharp;
  vec3 r = clamp((c + (n + s + e + w) * k) / max(1.0 + 4.0 * k, vec3(0.2)), mn, mx);
  vec2 g = gl_FragCoord.xy + uFrame;
  o = vec4(r + (hash(g) + hash(g + 17.3) - 1.0) / 255.0, 1.0);
}`;
