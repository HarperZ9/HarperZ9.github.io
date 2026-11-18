// The built places that are made at ground level: the snow town and its villages (town.mjs) and
// the works (works.mjs). Each is a site: a plan made at start (cheap: where things stand, so the
// near maps and the forest know), and a mesh with its lamps made when the walker first comes
// within reach.
import * as town from "./town.mjs";
import * as works from "./works.mjs";

export async function makeBuilt({ dev, stage, world, roads, near, lights, vbuf }) {
  const mod = await stage.module("materials.wgsl", "built.wgsl");
  const layout = [{ arrayStride: 48, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }, { shaderLocation: 2, offset: 24, format: "float32x2" }, { shaderLocation: 3, offset: 32, format: "float32x4" }] },
    { arrayStride: 16, stepMode: "instance", attributes: [{ shaderLocation: 4, offset: 0, format: "float32x4" }] }];
  const pipe = stage.pipe(mod, "vsBuilt", "fsBuilt", layout), shadowPipe = stage.pipe(mod, "vsBuilt", "fsBuiltShadow", layout, { format: null });
  const sites = [];
  // a town is planned on the ground it stands on, so not before that ground has arrived at full detail
  for (const s of world.json.settlements) if (s.region === 1) {
    const site = { x: (s.x + 0.5) * world.cell, z: (s.y + 0.5) * world.cell, reach: 460, from: 2600, plan: null };
    site.here = () => world.has(site.x - site.reach, site.z - site.reach, site.x + site.reach, site.z + site.reach);
    site.ensure = () => site.plan || (site.here() ? (site.plan = town.plan(world, roads, s)) : null);
    site.stamp = (t) => { const P = site.ensure(); if (P) town.stamp(P, t); };
    site.build = () => town.mesh(world, site.ensure(), lights);
    sites.push(site);
  }
  for (const P of works.plans(world)) sites.push({ x: P.cx, z: P.cz, reach: P.reach, from: 9000, stamp: (t) => works.stamp(P, t), build: () => works.mesh(world, P, lights), plan: P, here: () => world.has(P.cx - P.reach, P.cz - P.reach, P.cx + P.reach, P.cz + P.reach) });
  near.stampers.push((t) => { for (const s of sites) if (Math.abs(s.x - (t.ox + t.N / 2)) < t.N / 2 + s.reach && Math.abs(s.z - (t.oz + t.N / 2)) < t.N / 2 + s.reach) s.stamp(t); });
  let tris = 0;
  function update({ cam }) {
    // one site a frame at most: a town is a few megabytes of vertices
    const s = sites.find((q) => !q.buf && Math.hypot(q.x - cam.x, q.z - cam.z) < q.from + q.reach && q.here());
    if (!s) return;
    const m = s.build();
    s.buf = vbuf(m.data); s.n = m.data.length / 12; s.inst = vbuf(new Float32Array([m.origin[0], m.origin[1], m.origin[2], 0])); tris += s.n / 3;
  }
  function draw(pass, which) {
    pass.setPipeline(which === "shadow" ? shadowPipe : pipe);
    for (const s of sites) if (s.buf) { pass.setVertexBuffer(0, s.buf); pass.setVertexBuffer(1, s.inst); pass.draw(s.n, 1); }
  }
  // settlements and landmarks that are drawn here and so must not be drawn as placeholder masses
  const owns = { settlement: (s) => s.region === 1, mark: (m) => works.owns(m) };
  return { sites, update, draw, owns, stats: () => ({ builtTriangles: tris, sites: sites.filter((s) => s.buf).length }) };
}
