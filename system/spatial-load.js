// Planner inputs from the package that will actually render. Meshes counts
// mesh draw passes, including depth/support work; it is a cost heuristic, not
// measured GPU time. Atlas loads one scene at a time, so use its largest scene
// rather than the collection total to keep the budget safe across selection.
export function spatialSceneLoad(manifest, { width, height }) {
  const refuse = field => { throw new Error(`Invalid spatial package workload: ${field}`); };
  if (!manifest || !['ngsf-atlas', 'textured-hybrid', 'procedural-veils'].includes(manifest.mode)) refuse('unsupported world mode');
  const array = (value, field) => Array.isArray(value) ? value : refuse(field);
  const count = value => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid spatial package workload');
    return value;
  };
  let splats, meshes;
  if (manifest.mode === 'ngsf-atlas') {
    splats = array(manifest.scenes, 'missing atlas scenes').reduce((largest, scene) => Math.max(largest, count(scene?.gaussian_count)), 0);
    meshes = 0;
  } else {
    splats = count(manifest.splats?.count);
    meshes = manifest.mode === 'textured-hybrid'
      ? 1 + array(manifest.textured?.color_order, 'missing color layers').length + array(manifest.textured?.structural, 'missing structural layers').length
      : array(manifest.layers, 'missing authored layers').length + 1;
  }
  return { width, height, splats, meshes, postPasses: 0 };
}
