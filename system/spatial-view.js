// Share only a view of the site's published collections, never asset URLs or
// credentials. This is a composition recipe, not a frame or audio recording.
const fail = () => { throw new Error('Unsupported spatial view link.'); };
const object = x => x && typeof x === 'object' && !Array.isArray(x) ? x : fail();
const number = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : fail();
const choice = (x, values) => values.includes(x) ? x : fail();
const control = (values, key, bounds) => {
  if (values[key] === undefined && bounds.length > 2) return bounds[2];
  const value = number(values[key], bounds[0], bounds[1]);
  return bounds[3] === "int" && !Number.isInteger(value) ? fail() : value;
};
const controls = {
  atlas: { depthScale: [.2, 2.2], splatScale: [.3, 2.5], exposure: [.4, 2.4], opacityScale: [0, 1], gamma: [.1, 4], holoStrength: [0, 1], iridescence: [0, 1] },
  'crystal-city': { parallax: [0, 1.2], atmosphereFlow: [0, 1.5], glow: [0, 2.2], waterFlow: [0, 1.2], skyCurve: [0, 2], atmosphereDensity: [0, 2], hazeOpacity: [0, 1], bokehScale: [0, 4], beamFlow: [0, 2], depthDetail: [0, 1, .45], materialFocus: [0, 3, 0, "int"] },
  'folded-light': { parallax: [0, 1.2], drift: [0, 1.5], glow: [0, 2.2], water: [0, 1.2] },
};

export function validateSpatialView(input) {
  const v = object(input);
  if (v.version !== 1) return fail();
  const world = choice(v.world, Object.keys(controls)), values = object(v.controls), camera = object(v.camera);
  const cleaned = {};
  for (const [key, bounds] of Object.entries(controls[world])) cleaned[key] = control(values, key, bounds);
  const c = world === 'atlas'
    ? { yaw: number(camera.yaw, -1.25, 1.25), pitch: number(camera.pitch, -.72, .72), distance: number(camera.distance, .18, 7.5) }
    : { x: number(camera.x, -.045, .045), y: number(camera.y, -.03, .03), z: number(camera.z, -.12, .12) };
  const scene = world === 'atlas' && typeof v.scene === 'string' && /^scene-\d{2}$/.test(v.scene) ? v.scene : null;
  if (world === 'atlas' && !scene) return fail();
  const comparison = object(v.compare);
  if (typeof v.paused !== 'boolean') return fail();
  return { version: 1, world, scene, controls: cleaned, camera: c, paused: v.paused,
    mode: world === 'atlas' ? choice(v.mode, [0, 1, 3]) : 0,
    compare: { mode: world === 'atlas' ? choice(comparison.mode, ['off', 'overlay', 'side']) : 'off', mix: number(comparison.mix, 0, 1) } };
}

export function decodeSpatialView(text) {
  if (typeof text !== 'string' || text.length > 4000) return fail();
  let input; try { input = JSON.parse(text); } catch (_) { return fail(); }
  return validateSpatialView(input);
}

export function spatialViewUrl(input, base) {
  const view = validateSpatialView(input), url = new URL('studio.html', base);
  url.searchParams.set('source', 'spatial'); url.searchParams.set('world', view.world);
  if (view.scene) url.searchParams.set('scene', view.scene);
  url.searchParams.set('view', JSON.stringify(view));
  return url.href;
}
