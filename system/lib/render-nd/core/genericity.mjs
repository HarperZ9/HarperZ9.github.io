// genericity.mjs — detect and avoid degenerate (vertex-colliding) projections.
//
// Under projection, distinct nD vertices can map to the same 2D point (a
// "collision"). Each edge looks locally faithful but the global graph is
// corrupted. This module detects collisions and nudges the view to a generic
// (collision-free) one.

import { renderScene } from "../index.mjs";

/**
 * vertexCollisions(points, eps)
 *
 * Given the scene's points array (each {x, y}), return { count, pairs }
 * where pairs is the list of [i, j] (i < j) whose Euclidean 2D distance < eps.
 * eps is in the [-1, 1] normalized coordinate space.
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {number} eps  collision threshold (default 1e-3)
 * @returns {{ count: number, pairs: Array<[number, number]> }}
 */
export function vertexCollisions(points, eps = 1e-3) {
  const pairs = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < eps) {
        pairs.push([i, j]);
      }
    }
  }
  return { count: pairs.length, pairs };
}

/**
 * isGenericView(scene, eps)
 *
 * Returns true iff vertexCollisions(scene.points, eps).count === 0.
 *
 * @param {{ points: Array<{x: number, y: number}> }} scene
 * @param {number} eps  collision threshold (default 1e-3)
 * @returns {boolean}
 */
export function isGenericView(scene, eps = 1e-3) {
  return vertexCollisions(scene.points, eps).count === 0;
}

/**
 * nudgeToGeneric(sceneOpts, eps, maxTries)
 *
 * Given renderScene opts, try small deterministic perturbations of `t`
 * (adding k * 0.017 for k = 1..maxTries) until renderScene yields a
 * generic (collision-free) view.
 *
 * Returns the adjusted opts and the resulting scene once generic, or
 * the least-colliding candidate if none found within maxTries.
 *
 * @param {object} sceneOpts  — same opts accepted by renderScene
 * @param {number} eps         collision threshold (default 1e-3)
 * @param {number} maxTries    max perturbation attempts (default 24)
 * @returns {{ opts: object, scene: object, tries: number, generic: boolean }}
 */
export function nudgeToGeneric(sceneOpts, eps = 1e-3, maxTries = 24) {
  const baseT = sceneOpts.t ?? 0;

  // Track the least-colliding candidate found so far (used if none is generic).
  let bestOpts = null;
  let bestScene = null;
  let bestCount = Infinity;

  for (let k = 1; k <= maxTries; k++) {
    const nudgedT = baseT + k * 0.017;
    const opts = { ...sceneOpts, t: nudgedT };
    const scene = renderScene(opts);
    const { count } = vertexCollisions(scene.points, eps);

    if (count === 0) {
      return { opts, scene, tries: k, generic: true };
    }

    if (count < bestCount) {
      bestCount = count;
      bestOpts = opts;
      bestScene = scene;
    }
  }

  // No generic view found within maxTries — return least-colliding candidate.
  return { opts: bestOpts, scene: bestScene, tries: maxTries, generic: false };
}
