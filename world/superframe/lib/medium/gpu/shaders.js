// shaders.js: GLSL for the flow medium stand-in (WebGL2). One full-screen triangle drives every pass.
// Fields: vel = (vx, vy, temperature, -) in sim cells per second; dye = (ink, sediment, -, -).
export const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const HEAD = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;`;

// advection with region viscosity, buoyancy and the scroll shift that keeps the field attached to the page
export const ADVECT = `${HEAD}
uniform sampler2D uVel, uSrc; uniform vec2 uSimTexel; uniform float uDt, uShift, uRinse, uSpread; uniform int uIsVel;
uniform vec4 uRect[6]; uniform float uVisc[6]; uniform int uNR; uniform float uBaseVisc;
uniform vec4 uHeat[4]; uniform int uNH; uniform float uHeatK;
float visc(vec2 uv){ float v = uBaseVisc;
  for (int i = 0; i < 6; i++) { if (i >= uNR) break; vec4 r = uRect[i];
    if (uv.x >= r.x && uv.x <= r.z && uv.y >= r.y && uv.y <= r.w) v = uVisc[i]; }
  return v; }
void main(){
  vec2 uv = vUv - vec2(0., uShift);
  vec4 v = texture(uVel, uv);
  vec2 back = uv - uDt * v.xy * uSimTexel;
  vec4 s = texture(uSrc, back);
  if (uIsVel == 1) {
    float k = exp(-(visc(vUv) + 2.5 * (1. - uSpread)) * uDt);   // and the water calms as it dries
    s.xy *= k; s.y += s.z * 9. * uDt;        // warm water rises
    s.z *= exp(-.45 * uDt);                   // and cools
    for (int i = 0; i < 4; i++) { if (i >= uNH) break; vec4 L = uHeat[i];   // the lamp warms the water under it
      s.z += uHeatK * uDt * max(0., 1. - length((vUv - L.xy) / L.zw) / .7); }
  } else {
    vec4 here = texture(uSrc, uv);
    vec2 t2 = uSimTexel * .5;                 // capillary spread: the soak creeps outward into the weave
    float nb = .25 * (texture(uSrc, back + vec2(t2.x, 0)).r + texture(uSrc, back - vec2(t2.x, 0)).r + texture(uSrc, back + vec2(0, t2.y)).r + texture(uSrc, back - vec2(0, t2.y)).r);
    // The fields are half floats, which round toward zero on write here: a change smaller than one unit in the last
    // place always loses pigment. So nothing applies a sub-unit decay each step (that leaked about 4% of the ink a
    // second, measured 2026-10-26), and the spread stops once it is too slow to register.
    float aR = .12 * uSpread;
    if (aR > .004) s.r = mix(s.r, nb, aR);   // the soak slows as the water dries (uSpread), then stops
    float nbB = .25 * (texture(uSrc, back + vec2(t2.x, 0)).b + texture(uSrc, back - vec2(t2.x, 0)).b + texture(uSrc, back + vec2(0, t2.y)).b + texture(uSrc, back - vec2(0, t2.y)).b);
    if (aR > .004) s.b = mix(s.b, nbB, aR * .75);
    float nbA = .25 * (texture(uSrc, back + vec2(t2.x, 0)).a + texture(uSrc, back - vec2(t2.x, 0)).a + texture(uSrc, back + vec2(0, t2.y)).a + texture(uSrc, back - vec2(0, t2.y)).a);
    if (aR > .004) s.a = mix(s.a, nbA, aR);   // the spectral pour's amount spreads as its bands do (pigment.js)
    if (uRinse > 0.) { s.rba *= exp(-uRinse * uDt); s.g *= exp(-uRinse * .5 * uDt); }   // a rinse lifts old pigment while the next pours
    s.g = mix(here.g, s.g, .08 * uSpread); // sediment barely moves, then stays
  }
  if (uv.y < 0. || uv.y > 1.) s = vec4(0.);
  o = s; }`;

// splats: 0 ink, 1 warmth, 2 current, 3 sediment (elliptical), 4 ripple (outward ring), 5 wash (the second pour),
// 6 pigment (a coloured pour: amount here, its spectrum in pigment.js)
export const SPLAT = `${HEAD}
uniform sampler2D uSrc; uniform int uN, uTarget; uniform vec4 uP[16]; uniform vec4 uV[16]; uniform float uAspect;
void main(){
  vec4 s = texture(uSrc, vUv);
  for (int i = 0; i < 16; i++) { if (i >= uN) break;
    vec4 P = uP[i]; vec4 V = uV[i]; int k = int(P.w);
    vec2 d = vUv - P.xy; d.x *= uAspect;
    float ry = P.z * (k == 3 ? V.w : 1.);
    float g = exp(-(d.x * d.x) / (P.z * P.z) - (d.y * d.y) / (ry * ry));
    if (uTarget == 0) {
      if (k == 0 || k == 2 || k == 6) s.xy += V.xy * g;
      if (k == 1) s.z += V.z * g;
      if (k == 4) s.xy += normalize(d + 1e-5) * V.z * g;
    } else {
      if (k == 0) s.r = min(s.r + V.z * g, 2.);
      if (k == 3) s.g = min(s.g + V.z * g, 1.);
      if (k == 5) s.b = min(s.b + V.z * g, 2.);
      if (k == 6) s.a += V.z * g;   // pigment: its amount (the bands go to the spectral textures, uncapped so they stay in step)
    } }
  o = s; }`;

export const DIVERGENCE = `${HEAD}
uniform sampler2D uVel; uniform vec2 uSimTexel;
void main(){
  float L = texture(uVel, vUv - vec2(uSimTexel.x, 0)).x, R = texture(uVel, vUv + vec2(uSimTexel.x, 0)).x;
  float B = texture(uVel, vUv - vec2(0, uSimTexel.y)).y, T = texture(uVel, vUv + vec2(0, uSimTexel.y)).y;
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.); }`;

export const JACOBI = `${HEAD}
uniform sampler2D uP, uDiv; uniform vec2 uSimTexel;
void main(){
  float L = texture(uP, vUv - vec2(uSimTexel.x, 0)).x, R = texture(uP, vUv + vec2(uSimTexel.x, 0)).x;
  float B = texture(uP, vUv - vec2(0, uSimTexel.y)).x, T = texture(uP, vUv + vec2(0, uSimTexel.y)).x;
  o = vec4((L + R + B + T - texture(uDiv, vUv).x) * .25, 0., 0., 1.); }`;

export const GRADIENT = `${HEAD}
uniform sampler2D uP, uVel; uniform vec2 uSimTexel; uniform vec4 uWalls;   // walls: left, right, bottom, top (1 = closed)
void main(){
  float L = texture(uP, vUv - vec2(uSimTexel.x, 0)).x, R = texture(uP, vUv + vec2(uSimTexel.x, 0)).x;
  float B = texture(uP, vUv - vec2(0, uSimTexel.y)).x, T = texture(uP, vUv + vec2(0, uSimTexel.y)).x;
  vec4 v = texture(uVel, vUv); v.xy -= .5 * vec2(R - L, T - B);
  // a closed side holds its water: no flow through it, so pigment cannot leave the medium there
  if ((uWalls.x > .5 && vUv.x < 1.5 * uSimTexel.x) || (uWalls.y > .5 && vUv.x > 1. - 1.5 * uSimTexel.x)) v.x = 0.;
  if ((uWalls.z > .5 && vUv.y < 1.5 * uSimTexel.y) || (uWalls.w > .5 && vUv.y > 1. - 1.5 * uSimTexel.y)) v.y = 0.;
  o = v; }`;
