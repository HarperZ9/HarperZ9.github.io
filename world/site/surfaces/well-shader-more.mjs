// well-shader-more.mjs: the shader's half of the grounds after the first ten (grounds-more.mjs and cloth.mjs hold the
// rules in JavaScript; mixOn() in grounds.mjs calls them, and a browser test holds the two together).
//
//   10 woven cloth   uWeave is the loom's cloth texture (cloth.mjs): which thread is on top, where across it, where along
//                    its float, how long the float is. Dye adds to the thread's own absorption-to-scattering ratio band by
//                    band (uKG is the undyed thread's; uMo.x is DYE). Woven from the blend (uCl.x = 1): the warp is pigment
//                    0 and the weft takes the others pick by pick. uCl.zw are the ends and picks across the well.
//   11 film stock    uMore is the film table (17 by 17 by 17 exposures through the spectral film model). Exposure is the
//                    scene (uBase) plus uMo.x times each pigment's light; uMo.y is the halo's ring as a share of the width
//                    and uFh.rgb its strength by layer (red most); uFg.rgb is the grain, in stops, per layer.
//   12 sound         uMore is the ground's spectrogram in decibels (0 is uMo.z, 255 is uMo.z + uMo.w). Powers add (uMo.y
//                    is the power of a unit of pigment, uMo.x the floor's); the level is read in decibels. Each sound lies in bands of harmonics, up the well.
//   13 fire heat     uMore is the glow table, from uMo.z to uMo.w kelvin. The temperature is the plate's (uMo.x) plus
//                    uMo.y times each pigment's amount and its share of light absorbed.
// MORE_HEAD is declared before the main shader's functions; MORE_FNS after them, so they can use part(), h() and fbm().
export const MORE_HEAD = `
uniform sampler2D uWeave, uMore;
uniform vec4 uKG[4], uCl, uMo, uFh, uFg;
vec3 hueN(vec3 c); float lumi(vec3 c); vec3 flatMore(float med);
vec3 finishMore(float med, vec3 B, vec2 uv, vec2 q, vec3 acc, vec3 accN, float tot, float hsum, mat4 kq, float pm);`;
export const MORE_FNS = `
vec3 dec(vec3 s){ return mix(s / 12.92, pow((s + .055) / 1.055, vec3(2.4)), step(.04045, s)); }
float lumi(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
vec3 hueN(vec3 c){ return c / max(max(max(c.r, c.g), c.b), 1e-6); }
vec3 kmix(mat4 kq){ vec3 o = vec3(0.); for (int j = 0; j < 4; j++){ vec4 q = kq[j], r = 1. + q - sqrt(q * q + 2. * q); for (int c = 0; c < 4; c++) o += uPM[j * 4 + c] * r[c]; } return clamp(o, 0., 1.); }
mat4 groundKS(){ return mat4(uKG[0], uKG[1], uKG[2], uKG[3]); }
mat4 slotKS(int s){ mat4 m = mat4(0.); for (int i = 0; i < 4; i++) if (i == s) m = mat4(uKS[i * 4], uKS[i * 4 + 1], uKS[i * 4 + 2], uKS[i * 4 + 3]); return m; }
vec3 filmLut(vec3 E){ vec3 u = clamp((log2(max(E, vec3(1e-9)) / .18) + 7.) / 12., 0., 1.) * 16.; float b0 = min(15., floor(u.b)), tb = u.b - b0;
  vec2 a = vec2((b0 * 17. + u.r + .5) / 289., (u.g + .5) / 17.), c = vec2(((b0 + 1.) * 17. + u.r + .5) / 289., a.y);
  return dec(mix(texture2D(uMore, a).rgb, texture2D(uMore, c).rgb, tb)); }
vec3 glowLut(float T){ float f = clamp((T - uMo.z) / (uMo.w - uMo.z), 0., 1.) * 63.; return dec(texture2D(uMore, vec2((f + .5) / 64., .5)).rgb); }
float lvl(float P){ return clamp((10. * log(max(P, 1e-12)) / log(10.) - uMo.z) / uMo.w, 0., 1.); }
vec3 sound(vec3 B, vec3 accN, float floorP, float tot){ float P = floorP + uMo.y * tot; return (floorP * hueN(B) + uMo.y * accN) / P * pow(lvl(P), 2.2); }
vec3 flatMore(float med){
  mat4 kq = mat4(0.); vec3 acc = vec3(0.), accN = vec3(0.); float tot = 0., hs = 0.;
  for (int i = 0; i < 4; i++){ float d = i == 0 ? uFlat.x : i == 1 ? uFlat.y : i == 2 ? uFlat.z : uFlat.w;
    kq += d * mat4(uKS[i * 4], uKS[i * 4 + 1], uKS[i * 4 + 2], uKS[i * 4 + 3]); acc += d * uLin[i]; accN += d * hueN(uLin[i]); tot += d; hs += d * (1. - clamp(lumi(uLin[i]), 0., 1.)); }
  if (med < 10.5) return kmix(groundKS() + uMo.x * kq);
  if (med < 11.5) return filmLut(uBase + uMo.x * acc);
  if (med < 12.5) return sound(uBase, accN, uMo.x, tot);
  return glowLut(uMo.x + uMo.y * hs); }
vec3 finishMore(float med, vec3 B, vec2 uv, vec2 q, vec3 acc, vec3 accN, float tot, float hsum, mat4 kq, float pm){
  vec3 R;
  if (med < 10.5){   // the cloth: the thread on top, its colour, the dye in it, and the light on its round profile
    vec4 tw = texture2D(uWeave, uv); bool up = tw.r > .5; float n = tw.g * 2. - 1., prof = sqrt(max(0., 1. - n * n)), len = tw.a * 255. / 32., end = min(tw.b, 1. - tw.b) * len;
    int s = 0; if (uCl.x > .5 && !up && uCl.y > 1.5){ float p = floor(uv.y * uCl.w); s = 1 + int(mod(p, uCl.y - 1.)); }
    R = kmix((uCl.x > .5 ? slotKS(s) : groundKS()) + uMo.x * kq);
    R *= (.42 + .58 * prof) * (.55 + .45 * smoothstep(0., .35, end)) * (up ? 1. : .93) * (.94 + .12 * h(floor(uv * vec2(900., 700.))));
    R += (.05 + .05 * min(len, 5.) / 5.) * pow(prof, 14.) * vec3(1.);   // a longer float catches more light, as satin does
    return mix(R, uLin[4] * (.42 + .58 * prof), .5 * pm * smoothstep(0., .5, tot)); }
  if (med < 11.5){   // film: the scene's light and every pigment's, a red halo from the light around this point, grain, then the film
    vec3 E = B + uMo.x * acc, hl = vec3(0.);
    for (int k = 0; k < 8; k++){ float a = 6.2831853 * float(k) / 8.; vec4 dd = texture2D(uDye, uv + vec2(cos(a), sin(a) * uAspect) * uMo.y); for (int i = 0; i < 4; i++) if (uC[i].z > .5) hl += part(dd, i) * uLin[i]; }
    E += uFh.rgb * uMo.x * hl / 8.;
    vec3 z = vec3(0.); for (int k = 0; k < 3; k++){ float u1 = max(1e-6, h(gl_FragCoord.xy + 17.3 * float(k))), u2 = h(gl_FragCoord.xy * 1.37 + 7.7 * float(k)); z[k] = sqrt(-2. * log(u1)) * cos(6.2831853 * u2); }
    return filmLut(E * exp2(uFg.rgb * z)); }
  if (med < 12.5) return sound(B, accN, pow(10., (texture2D(uMore, uv).r * uMo.w + uMo.z) / 10.), tot);
  return glowLut(uMo.x + uMo.y * hsum + 70. * (fbm(q * 2.5, .55) - .5)); }`;
