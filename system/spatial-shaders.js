// system/spatial-shaders.js
// GLSL sources for the spatial (hybrid world) renderer. WebGL1-compatible on
// purpose: the session's v1.3 proof landed on the broad-support surface after
// the WebGL2-only prototypes kept failing in the field. ASCII only.

export const BACKDROP_VS = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){ vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0.9999, 1.0); }
`;

// The calm ground: near-black with one slow radial breath. Ink on a quiet
// field; the veils and splats carry all the light.
export const BACKDROP_FS = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
void main(){
  vec2 c = vUv - vec2(.5, .42);
  float r = length(c);
  float breath = .012 * (0.5 + 0.5 * sin(uTime * .11));
  vec3 ground = vec3(.010, .012, .022) + (0.030 + breath) * exp(-r * r * 5.0) * vec3(.66, .58, .72);
  gl_FragColor = vec4(ground, 1.0);
}
`;

// Veil surfaces: a shared UV grid displaced to the layer's depth plane. The
// fragment draws folded additive light analytically from the seed-derived
// parameters, so no textures ship with the authored scene.
export const VEIL_VS = `
attribute vec2 aUv;
uniform mat4 uView, uProj;
uniform float uDepth;
uniform float uAspect;
uniform float uTime, uFoldFreq, uFoldPhase, uFoldTilt, uDriftRate, uDrift;
uniform float uRibbonWidth, uRibbonOffset, uWarpAmp, uTwist;
uniform float uApertureFreq, uAperturePhase, uApertureSoft, uVerticalBow, uSurfaceScale;
varying vec2 vUv;
varying float vRibbon, vHole, vFold, vCross, vAxis;
void main(){
  vUv = aUv;
  vec2 plane = (aUv * 2.0 - 1.0);
  float ca = cos(uFoldTilt);
  float sa = sin(uFoldTilt);
  float axis = plane.x * ca + plane.y * sa + uRibbonOffset;
  float crossAxis = -plane.x * sa + plane.y * ca;
  float breath = uTime * uDriftRate * (0.35 + uDrift);
  float fold = sin(axis * uFoldFreq + uFoldPhase + breath);
  float minor = sin(axis * uFoldFreq * 0.43 - uFoldPhase * 0.7 + crossAxis * 3.4);
  float crossWarp = crossAxis + minor * 0.055 + fold * uTwist * 0.045;
  float ribbon = 1.0 - smoothstep(uRibbonWidth * 0.35, uRibbonWidth, abs(crossWarp));
  float core = 1.0 - smoothstep(uRibbonWidth * 0.10, uRibbonWidth * 0.36, abs(crossWarp));
  float apertureWave = sin(axis * uApertureFreq + uAperturePhase + minor * 0.4) * 0.5 + 0.5;
  float hole = smoothstep(0.52 - uApertureSoft * 0.16, 0.80, apertureWave) * core;
  float sculptAxis = axis + minor * 0.035;
  float sculptCross = crossWarp + fold * uTwist * 0.055;
  float rx = sculptAxis * ca - sculptCross * sa;
  float ry = sculptAxis * sa + sculptCross * ca;
  float spread = mix(1.02, 1.56, uDepth) * uSurfaceScale;
  float bow = uVerticalBow * (1.0 - plane.y * plane.y);
  float relief = (fold * uWarpAmp + minor * uWarpAmp * 0.35) * (0.25 + ribbon * 0.75);
  vec3 world = vec3(rx * spread * uAspect, ry * spread + bow + fold * 0.025, -(1.2 + uDepth * 4.0) + relief);
  vRibbon = ribbon;
  vHole = hole;
  vFold = fold;
  vCross = crossWarp;
  vAxis = axis;
  gl_Position = uProj * uView * vec4(world, 1.0);
}
`;

export const VEIL_FS = `
precision highp float;
varying vec2 vUv;
varying float vRibbon, vHole, vFold, vCross, vAxis;
uniform float uTime, uDepth, uFoldFreq, uRidgeFreq, uFoldPhase, uFoldTilt, uDriftRate, uEdgeSoft, uGlow, uDrift;
uniform float uRibbonWidth, uRibbonOffset, uTwist, uApertureFreq, uAperturePhase, uApertureSoft;
uniform vec3 uTint;
uniform int uDepthOnly;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float ca = cos(uFoldTilt);
  float sa = sin(uFoldTilt);
  float axis = p.x * ca + p.y * sa + uRibbonOffset;
  float crossAxis = -p.x * sa + p.y * ca;
  float breath = uTime * uDriftRate * (0.35 + uDrift);
  float rawFold = sin(axis * uFoldFreq + uFoldPhase + breath);
  float minor = sin(axis * uFoldFreq * 0.43 - uFoldPhase * 0.7 + crossAxis * 3.4);
  float crossWarp = crossAxis + minor * 0.055 + rawFold * uTwist * 0.045;
  float ribbon = 1.0 - smoothstep(uRibbonWidth * 0.35, uRibbonWidth, abs(crossWarp));
  float core = 1.0 - smoothstep(uRibbonWidth * 0.10, uRibbonWidth * 0.36, abs(crossWarp));
  float apertureWave = sin(axis * uApertureFreq + uAperturePhase + minor * 0.4) * 0.5 + 0.5;
  float hole = smoothstep(0.52 - uApertureSoft * 0.16, 0.80, apertureWave) * core;
  float focal = length(vec2(p.x * 1.05, (p.y + 0.02 + (uDepth - 0.55) * 0.14) * 0.86));
  float focalCore = 1.0 - smoothstep(0.16, 0.36, focal);
  float focalRim = (1.0 - smoothstep(0.026, 0.110, abs(focal - 0.36))) * ribbon;
  float axisLimit = 0.88 + uDepth * 0.22;
  float axisTaper = 1.0 - smoothstep(axisLimit, axisLimit + 0.38, abs(axis));
  float edge = (1.0 - smoothstep(0.90, 1.0, abs(p.x))) *
               (1.0 - smoothstep(0.90, 1.0, abs(p.y)));
  float visible = clamp(ribbon * axisTaper * (1.0 - hole * 0.28) * (1.0 - focalCore * 0.60), 0.0, 1.0) * edge;
  if (visible < 0.0015 && focalRim < 0.004) discard;
  float fold = abs(rawFold);
  float ridge = pow(fold, 5.0);
  float knife = smoothstep(0.93, 1.0, fold);
  float holeRim = smoothstep(0.08, 0.42, hole) * (1.0 - smoothstep(0.72, 0.98, hole)) * smoothstep(0.16, 0.72, ribbon);
  float apertureRim = max(holeRim, focalRim * 0.82);
  float contour = exp(-abs(crossWarp) * 6.0) * (0.18 + ridge * 0.82);
  float edgeRim = smoothstep(uRibbonWidth * .44, uRibbonWidth * .82, abs(crossWarp)) *
                  (1.0 - smoothstep(uRibbonWidth * .82, uRibbonWidth, abs(crossWarp)));
  float thread = pow(0.5 + 0.5 * sin(axis * uRidgeFreq + minor * 1.8 + uFoldPhase * 0.37), 8.0);
  float flow = exp(-abs(p.y - (p.x * .26 + .02 + sin(p.x * 2.7 + uFoldPhase) * .055)) * 7.5) *
               (1.0 - smoothstep(.74, 1.16, abs(p.x)));
  float lum = (.055 + ridge * .34 + knife * .28 + edgeRim * .24 + apertureRim * .20 + contour * .16 + thread * .13 + flow * .42) *
              visible * mix(1.25, .68, uDepth);
  lum += focalRim * mix(.17, .075, uDepth);
  if (uDepthOnly == 1) { if (lum < 0.17) discard; gl_FragColor = vec4(0.0); return; }
  // Alpha ceiling below 1.0 so a charged glow brightens the folds without
  // fusing them into clipped white sheets (piecewise sweep finding).
  float alpha = clamp((lum * .88 + visible * .018) * (0.70 + uGlow * .40), 0.0, 0.66);
  vec3 rimWarmth = vec3(.24, .17, .09) * apertureRim * (visible + focalRim * .34);
  vec3 color = (uTint * lum + rimWarmth) * (1.0 + uGlow * .70);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

// Selective Gaussian material. Ten-float records; the kind drives the
// spatiotemporal behavior in the vertex stage, and structure never ships as
// points. Kind ids match spatial-core.js KIND_IDS.
export const POINT_VS = `
attribute vec3 iPosition;
attribute vec3 iColor;
attribute float iSize, iAlpha, iKind, iSeed;
uniform mat4 uView, uProj;
uniform float uTime, uAspect, uDrift, uWater, uGlow, uPixelScale, uMaxPoint, uProceduralVeils;
varying vec3 vColor;
varying float vAlpha, vKind;
void main(){
  vec3 p = iPosition;
  float phase = iSeed * 6.28318;
  if (iKind == 0.0) {                    /* dust: slow inhabited drift */
    p.x += sin(uTime * .13 + phase) * .028 * uDrift;
    p.y += sin(uTime * .09 + phase * 1.7) * .022 * uDrift;
  } else if (iKind == 1.0) {             /* beam: current along the fold */
    p.x += sin(uTime * .5 + phase) * .010 * (.3 + uDrift);
    p.y += cos(uTime * .4 + phase) * .010 * (.3 + uDrift);
  } else if (iKind == 2.0) {             /* water: horizontal shimmer */
    p.x += sin(uTime * .8 + phase + p.x * 3.0) * .016 * uWater;
  } else if (iKind == 5.0) {             /* bokeh: near slow bob */
    p.y += sin(uTime * .07 + phase) * .030 * uDrift;
  }
  if (uProceduralVeils > 0.5 && (iKind == 1.0 || iKind == 4.0)) {
    float along = clamp((p.x + .82) / 1.50, 0.0, 1.0);
    float spine = mix(-.15, .13, along)
                + sin(p.x * 5.1 + phase * .23) * .045
                + sin(p.x * 10.5 + phase) * .018;
    float pull = iKind == 4.0 ? .78 : .56;
    p.y = mix(p.y, spine, pull);
    p.x += sin(phase + p.x * 4.0) * .018;
    p.z = clamp(p.z + sin(p.x * 4.6 + phase) * .030, .18, .82);
  }
  vec3 world = vec3(p.x * uAspect, p.y, -(1.2 + p.z * 4.0));
  vec4 viewPos = uView * vec4(world, 1.0);
  gl_Position = uProj * viewPos;
  float twinkle = 1.0;
  if (iKind == 3.0) twinkle = .75 + .25 * sin(uTime * .9 + phase * 3.1);
  if (iKind == 4.0) twinkle = .70 + .30 * sin(uTime * 1.7 + phase * 2.3);
  vColor = iColor;
  vKind = iKind;
  // A point sprite cannot be drawn smaller than one pixel, so distant material gets inflated to the
  // 1.0 floor. Left alone that hands a splat which should have covered a quarter of a pixel four
  // times the area at unchanged peak alpha: far material reads too dense, and every splat crossing
  // the threshold under camera motion pops. Scaling alpha by the inverse area ratio keeps the
  // INTEGRATED energy right, so a receding splat fades out instead of clamping and shimmering.
  // The ceiling comes from the driver's own ALIASED_POINT_SIZE_RANGE, not a guessed constant.
  float want = iSize * uPixelScale * (3.4 / max(0.4, -viewPos.z));
  float size = clamp(want, 1.0, uMaxPoint);
  float areaRatio = min(1.0, (want / size) * (want / size));
  gl_PointSize = size;
  float materialScale = 1.0;
  if (iKind == 1.0) materialScale = 0.64;
  if (iKind == 3.0) materialScale = 0.72;
  if (iKind == 4.0) materialScale = 0.36;
  vAlpha = iAlpha * twinkle * (0.85 + uGlow * .5) * areaRatio * materialScale;
}
`;

export const POINT_FS = `
precision highp float;
varying vec3 vColor;
varying float vAlpha, vKind;
void main(){
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  float fall = exp(-r2 * 3.2);
  if (vKind == 4.0) {                    /* spark: four-point caustic star */
    float cross = exp(-abs(d.x) * 9.0) + exp(-abs(d.y) * 9.0);
    fall = max(fall, cross * exp(-r2 * 1.1) * .8);
  }
  float alpha = clamp(vAlpha * fall, 0.0, 1.0);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;

// The largest point sprite this context will actually rasterize. WebGL reports the supported span
// through ALIASED_POINT_SIZE_RANGE and implementations are free to stop well below a shader's
// hard-coded ceiling; a program asking for 64 on a driver that caps at 32 is silently clamped, and
// the near field quietly loses size with nothing reported. Query once per context, cache on it, and
// fall back to the caller's ceiling if the parameter is missing or nonsense.
const MAX_POINT = Symbol("spatialMaxPointSize");
export function maxPointSize(gl, ceiling) {
  if (gl[MAX_POINT] === undefined) {
    let reported = 0;
    try {
      const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      if (range && isFinite(range[1]) && range[1] >= 1) reported = range[1];
    } catch (_) { reported = 0; }
    gl[MAX_POINT] = reported;
  }
  const driver = gl[MAX_POINT];
  return driver > 0 ? Math.min(ceiling, driver) : ceiling;
}

export function compile(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`${label}: ${log}`);
  }
  return shader;
}

export function link(gl, vsSource, fsSource, label) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vsSource, `${label} vs`));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fsSource, `${label} fs`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`${label}: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}
