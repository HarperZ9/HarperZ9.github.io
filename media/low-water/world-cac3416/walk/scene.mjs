// What stands on the island, as the frame loop sees it: one object that updates each part for
// the walker's place and draws the parts in order. The forest is grown by rule (flora/); the
// masses (masses.mjs) are the placeholder architecture of the regions not yet built at ground level.
import { MESHES, architecture } from "./masses.mjs";
import { drawAtlas, uploadAtlas } from "./flora/atlas.mjs";
import { makeForest } from "./flora/forest.mjs";
import { makeUnderstory } from "./flora/understory.mjs";
import { makeBuilt } from "./build/built.mjs";

export async function makeScene(ctx) {
  const { stage, world, vbuf, say } = ctx;
  say("Drawing the leaves");
  stage.set("atlas", uploadAtlas(ctx.dev, drawAtlas(world.json.seed)));
  const massM = await stage.module("mass.wgsl");
  const massBuffers = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }] },
    { arrayStride: 48, stepMode: "instance", attributes: [{ shaderLocation: 2, offset: 0, format: "float32x4" }, { shaderLocation: 3, offset: 16, format: "float32x4" }, { shaderLocation: 4, offset: 32, format: "float32x4" }] }];
  const massPipe = stage.pipe(massM, "vsMass", "fsMass", massBuffers);
  const meshBuf = Object.fromEntries(Object.entries(MESHES).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 6 }]));
  const built = await makeBuilt(ctx), arch = architecture(world, built.owns), archBuf = Object.fromEntries(Object.entries(arch).filter(([, v]) => v.length).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 12 }]));
  say("Growing the forest");
  const forest = await makeForest(ctx), parts = [built, forest, makeUnderstory(ctx, forest)];
  // what falls: one seed for each of 50,000 flakes or drops
  const AIR = 50000, seeds = new Float32Array(AIR * 4); let a = 12345;
  for (let i = 0; i < seeds.length; i++) { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; seeds[i] = a / 4294967296; }
  const airBuf = vbuf(seeds), airPipe = stage.pipe(await stage.module("air.wgsl"), "vsAir", "fsAir", [{ arrayStride: 16, stepMode: "instance", attributes: [{ shaderLocation: 0, offset: 0, format: "float32x4" }] }], { depth: "test", blend: "premul", topology: "triangle-strip" });
  let falling = 0;
  return {
    forest,
    built,
    update(f) { for (const p of parts) p.update(f); falling = Math.min(AIR, Math.round(AIR * Math.min(1, Math.max(f.sky.weather.rain, f.sky.weather.snow) * 1.4))); },
    draw(pass, which) {
      pass.setPipeline(massPipe);
      for (const [k, b] of Object.entries(archBuf)) { pass.setVertexBuffer(0, meshBuf[k].buf); pass.setVertexBuffer(1, b.buf); pass.draw(meshBuf[k].count, b.count); }
      for (const p of parts) p.draw(pass, which);
    },
    // new ground has arrived for a box of metres: whatever was placed on the old ground is placed again
    landed(x0, z0, x1, z1) { for (const p of parts) if (p.landed) p.landed(x0, z0, x1, z1); },
    drawAir(pass) { if (falling) { pass.setPipeline(airPipe); pass.setVertexBuffer(0, airBuf); pass.draw(4, falling); } },
    shadow() {}, before() {},
    stats() { return Object.assign({}, ...parts.map((p) => p.stats())); },
  };
}
