import test from 'node:test';
import assert from 'node:assert/strict';
import { World, splat } from './swimmers.js';

const run = (w, n) => { const ev = []; for (let i = 0; i < n; i++) { w.step(1 / 60); ev.push(...w.events); } return ev; };

test('mass is conserved over a long run', () => {
  const w = new World({ seed: 4 }), m0 = w.totalMass();
  run(w, 3000);
  assert.ok(Math.abs(w.totalMass() - m0) / m0 < 1e-9, `${w.totalMass()} vs ${m0}`);
});

test('same seed, same ecosystem', () => {
  const a = new World({ seed: 9 }), b = new World({ seed: 9 });
  run(a, 400); run(b, 400);
  assert.deepEqual(a.swimmers.map((s) => [s.x, s.y, s.mass]), b.swimmers.map((s) => [s.x, s.y, s.mass]));
});

test('a swimmer turns round at flipMass and grows streamers', () => {
  const w = new World({ seed: 2, swimmers: 0, pellets: 1 });
  w.pellets[0].x = 50; w.pellets[0].y = 50;
  const s = w._swimmer(600, 400, 2.9); w.swimmers.push(s); 
  const ev = run(w, 120);
  assert.ok(ev.some((e) => e.kind === 'flip' && e.swimmer === s.id));
  assert.equal(s.dir, -1);
  assert.ok(s.streamer > 0.3, `streamer ${s.streamer}`);
  assert.ok(s.tails[0].length > 0 && s.tails[1].length > 0);
});

test('pecking spends the streamer bite by bite, then the pellet absorbs the swimmer', () => {
  const w = new World({ seed: 3, swimmers: 0, pellets: 1, leak: 0, budRate: 0 });
  const p = w.pellets[0]; p.mass = 12;
  const s = w._swimmer(0, 0, 3); s.dir = -1; s.streamer = 1.5; w.swimmers.push(s);
  s.x = p.x + w.radiusOf(p) + 1; s.y = p.y;
  const before = s.mass + s.streamer + p.mass + w.pool, lengths = [];
  for (let i = 0; i < 600 && w.swimmers.includes(s); i++) { w.step(1 / 60); if (w.events.some((e) => e.kind === 'peck')) lengths.push(s.streamer); }
  assert.ok(lengths.length >= 2, 'several pecks');
  for (let i = 1; i < lengths.length; i++) assert.ok(lengths[i] <= lengths[i - 1]);
  assert.ok(!w.swimmers.includes(s), 'absorbed');
  assert.ok(Math.abs(w.pellets[0].mass + w.pool - before) < 1e-9, 'the pellet holds everything the swimmer was');
});

test('small swimmers bounce off pellets instead of latching', () => {
  const w = new World({ seed: 5, swimmers: 0, pellets: 1, budRate: 0 });
  const p = w.pellets[0], s = w._swimmer(p.x + w.radiusOf(p) + 1, p.y, 0.8); w.swimmers.push(s);
  run(w, 30);
  assert.equal(s.state, 'swim');
});

test('a heavy pellet divides into two, mass conserved, after the joined stage', () => {
  const w = new World({ seed: 6, swimmers: 0, pellets: 1, leak: 0, budRate: 0 });
  w.pellets[0].mass = 30; const m = w.pellets[0].mass;
  const ev = run(w, Math.ceil(w.o.splitTime * 60) + 5);
  assert.ok(ev.some((e) => e.kind === 'split'));
  assert.equal(w.pellets.length, 2);
  assert.ok(Math.abs(w.pellets[0].mass + w.pellets[1].mass - m) < 1e-9);
});

test('pellets bud small swimmers below flipMass', () => {
  const w = new World({ seed: 8, swimmers: 0, pellets: 3, budRate: 2 });
  const ev = run(w, 240), buds = ev.filter((e) => e.kind === 'bud');
  assert.ok(buds.length > 0);
  for (const b of buds) { const s = w.swimmers.find((q) => q.id === b.swimmer); if (s) assert.ok(s.mass < w.o.flipMass || s.dir === -1); }
});

test('a viewer can drop food only out of the pool', () => {
  const w = new World({ seed: 1, pool0: 5 });
  assert.equal(w.addPellet(10, 10, 50), null);
  const m0 = w.totalMass(), p = w.addPellet(10, 10, 3);
  assert.ok(p); assert.ok(Math.abs(w.totalMass() - m0) < 1e-9);
});

test('everything stays inside the wrapped world and streamer links keep their length', () => {
  const w = new World({ seed: 12 });
  run(w, 900);
  for (const s of w.swimmers) {
    assert.ok(s.x >= 0 && s.x < w.o.W && s.y >= 0 && s.y < w.o.H);
    for (const tail of s.tails) for (let i = 1; i < tail.length; i++) assert.ok(Math.abs(Math.hypot(tail[i].x - tail[i - 1].x, tail[i].y - tail[i - 1].y) - w.o.segLen) < 1e-6);
  }
});

test('the splat puts heat on pellets and cool on streamers', () => {
  const w = new World({ seed: 7 }); run(w, 300);
  const f = splat(w, 200), p = w.pellets[0], gx = Math.floor(p.x * 200 / w.o.W), gy = Math.floor(p.y * 200 / w.o.W);
  assert.equal(f.heat.length, f.w * f.h);
  assert.ok(f.heat[gy * f.w + gx] > 0.5);
  assert.ok(f.cool.some((v) => v > 0.1));
});
