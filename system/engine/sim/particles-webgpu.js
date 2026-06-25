// system/engine/sim/particles-webgpu.js
// Stage 1 of the Telos scalable engine: the WebGPU compute particle backend (rung 1, the fast path).
// Zero external dependencies. WGSL inlined as template strings; no build step. ASCII only.
//
// Pattern (SPEC-telos-scalable-engine.md, web-verified 2026-06-25): two storage buffers A/B
// ping-ponged, a compute pass at @workgroup_size(64) over a 1D particle array, then a render pass
// drawing instanced points. dispatchWorkgroups(ceil(N/64)). 16384 bytes of workgroup storage is
// present on ~100% of surveyed WebGPU devices; we use none, so the kernel is maximally portable.
//   Canonical reference: the webgpu-samples computeBoids example.
//
// requestAdapter()/requestDevice() are done once in capability.js (and re-usable in a worker via
// WorkerNavigator.gpu); this backend takes the already-acquired GPUDevice in init(). Guarded behind a
// WebGPU-available check so node --check passes and a non-WebGPU browser never reaches this code.
//
// Implements the COMMON BACKEND INTERFACE documented in particles-cpu.js. The compute kernel mirrors
// the CPU spring/cohesion/kick model (center-pull as the centroid proxy for large N, as in the
// WebGL2 rung). Color (OKLab -> sRGB) is done in the render fragment shader, matching the CPU recipe.

// ---------------------------------------------------------------------------
// Static availability probe (browser-only; safe under node, returns false)
// ---------------------------------------------------------------------------
export function isWebGPUParticlesAvailable() {
  try { return typeof navigator !== "undefined" && !!navigator.gpu; } catch (_) { return false; }
}

const FLOATS_PER_PARTICLE = 10;   // x,y,vx,vy,hx,hy,hue,L,C,size (parity with cpu/webgl2 layout)
const BYTES_PER_PARTICLE = FLOATS_PER_PARTICLE * 4;
const WORKGROUP_SIZE = 64;        // portable 1D particle workgroup size (spec floor 256 invocations)

// The compute shader (WGSL). One invocation per particle; reads from `inP`, writes to `outP`. The
// uniform block carries the per-frame audio forces + canvas size + a frame seed for the jitter hash.
const COMPUTE_WGSL = `
struct Particle {
  pos:  vec2<f32>,
  vel:  vec2<f32>,
  home: vec2<f32>,
  hue:  f32,
  L:    f32,
  C:    f32,
  size: f32,
};
struct Forces {
  res:       vec2<f32>,
  bass:      f32,
  intensity: f32,
  highMod:   f32,
  hue:       f32,
  seed:      f32,
  count:     f32,
};
@group(0) @binding(0) var<storage, read>       inP:  array<Particle>;
@group(0) @binding(1) var<storage, read_write> outP: array<Particle>;
@group(0) @binding(2) var<uniform>             F:    Forces;

fn hash(n: f32) -> f32 { return fract(sin(n) * 43758.5453123); }

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u32(F.count)) { return; }
  var p = inP[i];

  let fi = f32(i);
  let r1 = hash(fi * 12.9898 + F.seed);
  let r2 = hash(fi * 78.233  + F.seed * 1.7);

  let kSpring = 0.004 + F.intensity * 0.006;
  let damping = 0.96 - F.bass * 0.02;

  // spring toward home
  p.vel += (p.home - p.pos) * kSpring;
  // cohesion toward canvas center (centroid proxy for large N)
  let c = F.res * 0.5;
  p.vel += (c - p.pos) * 0.0003 * (1.0 - F.bass);
  // bass radial kick
  p.vel.y -= F.bass * 0.8 * (r1 - 0.5);
  p.vel.x += F.bass * 0.8 * (r2 - 0.5);
  // treble jitter
  if (F.highMod > 0.3) {
    p.vel.x += (r2 - 0.5) * F.highMod * 0.5;
    p.vel.y += (r1 - 0.5) * F.highMod * 0.5;
  }
  p.vel *= damping;
  p.pos += p.vel;

  // wrap + re-home
  if (p.pos.x < 0.0)      { p.pos.x += F.res.x; p.home.x = r1 * F.res.x; }
  if (p.pos.x > F.res.x)  { p.pos.x -= F.res.x; p.home.x = r1 * F.res.x; }
  if (p.pos.y < 0.0)      { p.pos.y += F.res.y; p.home.y = r2 * F.res.y; }
  if (p.pos.y > F.res.y)  { p.pos.y -= F.res.y; p.home.y = r2 * F.res.y; }

  // hue drift toward audio hue, index-spread
  let targetHue = F.hue + (fi / F.count) * 80.0;
  p.hue = mix(p.hue, targetHue, 0.01);

  outP[i] = p;
}`;

// Render shader (WGSL): draws each particle as a small quad (6 verts/instance) and shades it with the
// OKLab -> sRGB conversion matching the CPU recipe. Reads the current particle buffer as storage.
const RENDER_WGSL = `
struct Particle {
  pos:  vec2<f32>,
  vel:  vec2<f32>,
  home: vec2<f32>,
  hue:  f32,
  L:    f32,
  C:    f32,
  size: f32,
};
struct RParams { res: vec2<f32>, intensity: f32, hueShift: f32, };
@group(0) @binding(0) var<storage, read> P: array<Particle>;
@group(0) @binding(1) var<uniform>       R: RParams;

struct VsOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) hue: f32,
  @location(2) L: f32,
  @location(3) C: f32,
};

// unit quad as two triangles
var<private> QUAD: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(-1.0,-1.0), vec2<f32>(1.0,-1.0), vec2<f32>(-1.0,1.0),
  vec2<f32>(-1.0, 1.0), vec2<f32>(1.0,-1.0), vec2<f32>( 1.0,1.0));

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VsOut {
  let p = P[ii];
  let corner = QUAD[vi];
  let radiusPx = p.size * (1.0 + R.intensity * 0.4);
  let centerPx = p.pos + corner * radiusPx;
  var clip = (centerPx / R.res) * 2.0 - 1.0;
  clip.y = -clip.y;
  var o: VsOut;
  o.clip = vec4<f32>(clip, 0.0, 1.0);
  o.uv = corner;
  o.hue = p.hue;
  o.L = clamp(p.L + R.hueShift * 0.1, 0.3, 0.9);
  o.C = clamp(p.C + R.intensity * 0.06, 0.0, 0.3);
  return o;
}

fn oklabToLinear(L: f32, a: f32, b: f32) -> vec3<f32> {
  let l_ = L + 0.3963377774*a + 0.2158037573*b;
  let m_ = L - 0.1055613458*a - 0.0638541728*b;
  let s_ = L - 0.0894841775*a - 1.2914855480*b;
  let l = l_*l_*l_; let m = m_*m_*m_; let s = s_*s_*s_;
  return vec3<f32>(
    4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
   -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
   -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
}
fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {
  let lo = 12.92 * c;
  let hi = 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0/2.4)) - 0.055;
  return select(lo, hi, c > vec3<f32>(0.0031308));
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let r2 = dot(in.uv, in.uv);
  if (r2 > 1.0) { discard; }
  let aa = smoothstep(1.0, 0.4, r2);
  let hRad = radians(in.hue);
  let lin = oklabToLinear(in.L, in.C * cos(hRad), in.C * sin(hRad));
  let srgb = clamp(linearToSrgb(lin), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(srgb, 0.7 * aa);
}`;

export function createWebGPUParticles() {
  let device = null, queue = null, context = null, format = null;
  let computePipeline = null, renderPipeline = null;
  let bufA = null, bufB = null, computeUniform = null, renderUniform = null;
  let computeBindA = null, computeBindB = null, renderBindA = null, renderBindB = null;
  let count = 0, capacity = 0, w = 1, h = 1, rnd = Math.random;
  let frame = 0;   // even: read A write B; odd: read B write A

  function makeInitial(n) {
    const data = new Float32Array(n * FLOATS_PER_PARTICLE);
    for (let i = 0; i < n; i++) {
      const o = i * FLOATS_PER_PARTICLE;
      data[o + 0] = rnd() * w; data[o + 1] = rnd() * h;
      data[o + 2] = (rnd() - 0.5) * 0.5; data[o + 3] = (rnd() - 0.5) * 0.5;
      data[o + 4] = rnd() * w; data[o + 5] = rnd() * h;
      data[o + 6] = rnd() * 360; data[o + 7] = 0.6; data[o + 8] = 0.18; data[o + 9] = 1.5 + rnd() * 2.5;
    }
    return data;
  }

  function allocBuffers(n) {
    capacity = Math.max(1, n);
    const data = makeInitial(capacity);
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    bufA = device.createBuffer({ size: data.byteLength, usage });
    bufB = device.createBuffer({ size: data.byteLength, usage });
    queue.writeBuffer(bufA, 0, data);
    queue.writeBuffer(bufB, 0, data);
    rebuildBindGroups();
  }

  function rebuildBindGroups() {
    const cl = computePipeline.getBindGroupLayout(0);
    computeBindA = device.createBindGroup({ layout: cl, entries: [
      { binding: 0, resource: { buffer: bufA } },
      { binding: 1, resource: { buffer: bufB } },
      { binding: 2, resource: { buffer: computeUniform } },
    ]});
    computeBindB = device.createBindGroup({ layout: cl, entries: [
      { binding: 0, resource: { buffer: bufB } },
      { binding: 1, resource: { buffer: bufA } },
      { binding: 2, resource: { buffer: computeUniform } },
    ]});
    const rl = renderPipeline.getBindGroupLayout(0);
    renderBindA = device.createBindGroup({ layout: rl, entries: [
      { binding: 0, resource: { buffer: bufA } },
      { binding: 1, resource: { buffer: renderUniform } },
    ]});
    renderBindB = device.createBindGroup({ layout: rl, entries: [
      { binding: 0, resource: { buffer: bufB } },
      { binding: 1, resource: { buffer: renderUniform } },
    ]});
  }

  return {
    name: "webgpu",
    FLOATS_PER_PARTICLE,

    async init(cfg) {
      const c = cfg || {};
      device = c.device || (c.webgpu && c.webgpu.device) || null;
      if (!device) throw new Error("particles-webgpu: no GPUDevice provided");
      queue = device.queue;
      w = Math.max(1, c.width || 1); h = Math.max(1, c.height || 1);
      rnd = (typeof c.rng === "function") ? c.rng : Math.random;
      count = Math.max(0, Math.floor(c.count || 0));

      // Optional render surface. When a GPUCanvasContext is supplied we configure it; the worker path
      // passes one acquired via OffscreenCanvas.getContext("webgpu").
      context = c.context || (c.surface && c.surface.getContext && c.surface.getContext("webgpu")) || null;
      format = (typeof navigator !== "undefined" && navigator.gpu && navigator.gpu.getPreferredCanvasFormat)
        ? navigator.gpu.getPreferredCanvasFormat() : "bgra8unorm";
      if (context) {
        context.configure({ device, format, alphaMode: "premultiplied" });
      }

      const computeModule = device.createShaderModule({ code: COMPUTE_WGSL });
      computePipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: computeModule, entryPoint: "main" },
      });
      const renderModule = device.createShaderModule({ code: RENDER_WGSL });
      renderPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: renderModule, entryPoint: "vs" },
        fragment: {
          module: renderModule, entryPoint: "fs",
          targets: [{
            format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
            },
          }],
        },
        primitive: { topology: "triangle-list" },
      });

      // Uniform buffers: Forces (8 floats, padded to 16-byte alignment -> 32 bytes) and RParams.
      computeUniform = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      renderUniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      allocBuffers(count || 1);
      return true;
    },

    step(dt, forces) {
      if (!device || count === 0) return;
      const fr = forces || {};
      // Forces uniform: res.xy, bass, intensity, highMod, hue, seed, count (8 f32; std140 padding ok
      // because we lay the two vec-aligned scalars first).
      const u = new Float32Array(8);
      u[0] = w; u[1] = h; u[2] = fr.bass || 0; u[3] = fr.intensity || 0;
      u[4] = fr.highMod || 0; u[5] = fr.hue || 0; u[6] = (Math.random() * 1000) | 0; u[7] = count;
      queue.writeBuffer(computeUniform, 0, u);

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(computePipeline);
      pass.setBindGroup(0, (frame % 2 === 0) ? computeBindA : computeBindB);
      pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP_SIZE));
      pass.end();
      queue.submit([enc.finish()]);
      frame++;
    },

    render(_ignored, width, height, params) {
      if (!device || !context || count === 0) return;
      const p = params || {};
      const ru = new Float32Array(4);
      ru[0] = w; ru[1] = h; ru[2] = p.intensity || 0; ru[3] = p.hueShift || 0;
      queue.writeBuffer(renderUniform, 0, ru);

      const enc = device.createCommandEncoder();
      const view = context.getCurrentTexture().createView();
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view, clearValue: { r: 0.051, g: 0.106, b: 0.110, a: 1 },  // Studio void #0d1b1c
          loadOp: "clear", storeOp: "store",
        }],
      });
      pass.setPipeline(renderPipeline);
      // After `frame` steps, the freshest buffer is the one written last: even frame wrote B.
      const fresh = (frame % 2 === 1) ? renderBindB : renderBindA;
      pass.setBindGroup(0, fresh);
      pass.draw(6, count, 0, 0);
      pass.end();
      queue.submit([enc.finish()]);
    },

    resize(width, height) {
      w = Math.max(1, width || w); h = Math.max(1, height || h);
    },

    setCount(n) {
      const next = Math.max(0, Math.floor(n || 0));
      if (next === count) return count;
      if (next > capacity) {
        try { bufA.destroy(); bufB.destroy(); } catch (_) {}
        count = next; allocBuffers(next); frame = 0;
      } else {
        count = next;
      }
      return count;
    },

    perceive() { return { backend: "webgpu", count, cx: w / 2, cy: h / 2 }; },
    getCount() { return count; },

    dispose() {
      try { if (bufA) bufA.destroy(); if (bufB) bufB.destroy(); } catch (_) {}
      try { if (computeUniform) computeUniform.destroy(); if (renderUniform) renderUniform.destroy(); } catch (_) {}
      try { if (context) context.unconfigure && context.unconfigure(); } catch (_) {}
      device = queue = context = computePipeline = renderPipeline = null;
      bufA = bufB = computeUniform = renderUniform = null;
      computeBindA = computeBindB = renderBindA = renderBindB = null;
      count = 0; capacity = 0; frame = 0;
    },
  };
}

export const _FLOATS_PER_PARTICLE = FLOATS_PER_PARTICLE;
export const _WORKGROUP_SIZE = WORKGROUP_SIZE;
export const _SHADERS = { COMPUTE_WGSL, RENDER_WGSL };
export default { createWebGPUParticles, isWebGPUParticlesAvailable };
