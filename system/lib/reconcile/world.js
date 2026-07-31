// World -- the witnessed output. Each layer carries a drop-in render program (a self-contained WebGL
// fragment for field organs; a point recipe for forms), value_range sampled across the loop, and an
// expr digest. The World carries the trajectory (the reasoning), timeline (the motion), composition
// verdict, palette, and a receipt -- grounded, reproducible, re-checkable.
import { hashHex } from "./hash.js";
import { emitGLSL, GLSL_HELPERS, sampleField, sha as exprSha } from "./expr.js";

const r6 = (x) => Math.round(x * 1e6) / 1e6;

function fragmentSource(exprSrc, n) {
  n = Math.max(2, n);
  return `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_value_range;
uniform vec3 u_palette[${n}];
${GLSL_HELPERS}
float field(float u, float v, float t){ return ${exprSrc}; }
vec3 ramp(float x){ x=clamp(x,0.0,1.0); float s=x*float(${n}-1); int idx=int(floor(s)); float f=fract(s); vec3 a=u_palette[0]; vec3 b=u_palette[0]; for(int k=0;k<${n};k++){ if(k==idx)a=u_palette[k]; if(k==idx+1)b=u_palette[k]; } return mix(a,b,f); }
void main(){ vec2 uv=(gl_FragCoord.xy/u_resolution)*2.0-1.0; float val=field(uv.x,uv.y,u_time); float nn=(val-u_value_range.x)/max(1e-6,(u_value_range.y-u_value_range.x)); gl_FragColor=vec4(ramp(nn),1.0); }`;
}

export function renderProgram(organ, params, palette) {
  const art = organ.make(params);
  if (art.kind === "field") {
    const src = emitGLSL(art.expr);
    const K = (art.animatable && art.period > 0) ? 8 : 1;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < K; k++) {
      const t = art.animatable ? art.period * k / K : (art.t0 ?? 0);
      for (const val of sampleField(art.expr, 24, t)) { if (val < lo) lo = val; if (val > hi) hi = val; }
    }
    if (hi <= lo) hi = lo + 1e-6;
    return {
      target: "glsl-fragment", organ: organ.id, source: fragmentSource(src, palette.length),
      uniforms: { u_palette: palette, u_value_range: [r6(lo), r6(hi)] },
      domain: { animatable: art.animatable, period: r6(art.period || 0) },
      value_range: [r6(lo), r6(hi)], expr_sha256: exprSha(art.expr),
    };
  }
  return {
    target: "point-recipe", organ: organ.id, recipe: art.recipe,
    uniforms: { u_palette: palette }, domain: { animatable: false }, expr_sha256: hashHex(JSON.stringify(art.recipe)),
  };
}

export function makeLayer(organ, params, palette, { role = "render", z = 0, blend = "normal" } = {}) {
  return { organ: organ.id, role, z, blend, params: { ...params }, render_program: renderProgram(organ, params, palette) };
}

export function makeWorld({ seed, title, layers, trajectory = null, timeline = null, composition = null, palette }) {
  const shas = layers.map((l) => l.render_program.expr_sha256);
  const id = hashHex(`${seed}:${layers.map((l) => l.organ).join("+")}:${shas.join(":")}`);
  const receipt = { id, seed, organs: layers.map((l) => l.organ), shas, witness: hashHex(id + ":" + shas.join(":")) };
  return { id, title, schema_version: "reconcile/1", layers, trajectory, timeline, composition, palette, receipt };
}
