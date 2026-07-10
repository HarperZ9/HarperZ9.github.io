// voxel.js: turn a field into voxels. Two sources:
//   voxelizeSdf        - sample a signed-distance field dist(x,y,z) on a cubic
//                        grid; a cell is solid where the field is negative.
//   voxelizeHeightGrid - a luminance grid extrudes each cell into a stacked
//                        column, so any frame becomes relief voxels.
// Occupancy is a dense Uint8Array. The exporters emit an OBJ of only the
// EXPOSED cube faces (hidden-face removal, so a solid block is a shell, not
// millions of buried quads) or a portable JSON schematic. Pure, deterministic,
// zero-dependency.

/* Sample dist(x,y,z) over a res^3 grid spanning [-bound, bound]^3. Solid where
   dist < surface (default 0). Returns { nx, ny, nz, bound, occ, sample }.
   `sample` records the field value per cell, so a caller can colour by depth
   or normal without re-evaluating. */
export function voxelizeSdf(distFn, res = 40, bound = 1.3, surface = 0) {
  const n = Math.max(2, Math.min(160, Math.floor(res)));
  const occ = new Uint8Array(n * n * n);
  const sample = new Float32Array(n * n * n);
  const step = (bound * 2) / (n - 1);
  let idx = 0;
  for (let k = 0; k < n; k += 1) {
    const z = -bound + k * step;
    for (let j = 0; j < n; j += 1) {
      const y = -bound + j * step;
      for (let i = 0; i < n; i += 1) {
        const x = -bound + i * step;
        const d = distFn(x, y, z);
        sample[idx] = d;
        if (d < surface) occ[idx] = 1;
        idx += 1;
      }
    }
  }
  return { nx: n, ny: n, nz: n, bound, step, occ, sample };
}

/* A luminance grid (rows of 0..1) extrudes into columns: cell (x,y) fills the
   bottom `round(luma * maxH)` voxels of its column. Footprint is cols x rows,
   height is maxH. Returns the same occupancy shape as voxelizeSdf. */
export function voxelizeHeightGrid(lumaGrid, maxH = 24) {
  const ny = lumaGrid.length;
  const nx = ny ? lumaGrid[0].length : 0;
  const nz = Math.max(1, Math.floor(maxH));
  const occ = new Uint8Array(nx * ny * nz);
  for (let y = 0; y < ny; y += 1) {
    for (let x = 0; x < nx; x += 1) {
      const hgt = Math.max(0, Math.min(nz, Math.round((lumaGrid[y][x] || 0) * nz)));
      for (let z = 0; z < hgt; z += 1) occ[(z * ny + y) * nx + x] = 1;
    }
  }
  return { nx, ny, nz, occ };
}

export function occAt(vox, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= vox.nx || y >= vox.ny || z >= vox.nz) return 0;
  return vox.occ[(z * vox.ny + y) * vox.nx + x];
}

export function voxelCount(vox) {
  let n = 0;
  for (let i = 0; i < vox.occ.length; i += 1) n += vox.occ[i];
  return n;
}

// The six neighbour offsets and the quad (as 4 corner offsets) for each face,
// so we emit only faces on the surface of the solid.
const FACES = [
  { d: [1, 0, 0], quad: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { d: [-1, 0, 0], quad: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { d: [0, 1, 0], quad: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { d: [0, -1, 0], quad: [[1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 0, 0]] },
  { d: [0, 0, 1], quad: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], quad: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]] },
];

/* OBJ of exposed cube faces. Vertices are shared via a position cache, so the
   mesh is compact. Centred at the origin, unit cube spacing scaled to
   opts.scale (default 1). Deterministic emission order. */
export function voxelObj(vox, opts = {}) {
  const scale = opts.scale || 1;
  const cx = vox.nx / 2, cy = vox.ny / 2, cz = vox.nz / 2;
  const verts = [];
  const vcache = new Map();
  const faces = [];
  const vId = (x, y, z) => {
    const key = x + "," + y + "," + z;
    let id = vcache.get(key);
    if (id === undefined) {
      verts.push([(x - cx) * scale, (z - cz) * scale, (y - cy) * scale]); // z-up -> obj y-up
      id = verts.length; // 1-indexed
      vcache.set(key, id);
    }
    return id;
  };
  for (let z = 0; z < vox.nz; z += 1) {
    for (let y = 0; y < vox.ny; y += 1) {
      for (let x = 0; x < vox.nx; x += 1) {
        if (!occAt(vox, x, y, z)) continue;
        for (const f of FACES) {
          if (occAt(vox, x + f.d[0], y + f.d[1], z + f.d[2])) continue; // buried
          const ids = f.quad.map((q) => vId(x + q[0], y + q[1], z + q[2]));
          faces.push(ids);
        }
      }
    }
  }
  const out = ["# Telos voxel model", "# " + vox.nx + "x" + vox.ny + "x" + vox.nz + " grid, " + voxelCount(vox) + " voxels, " + faces.length + " exposed faces"];
  for (const v of verts) out.push("v " + v[0].toFixed(3) + " " + v[1].toFixed(3) + " " + v[2].toFixed(3));
  for (const f of faces) out.push("f " + f[0] + " " + f[1] + " " + f[2] + " " + f[3]);
  return out.join("\n") + "\n";
}

/* Portable JSON schematic: dims plus a list of solid voxel coordinates.
   Round-trips into any voxel tool or a re-render. */
export function voxelSchematic(vox) {
  const voxels = [];
  for (let z = 0; z < vox.nz; z += 1) {
    for (let y = 0; y < vox.ny; y += 1) {
      for (let x = 0; x < vox.nx; x += 1) {
        if (occAt(vox, x, y, z)) voxels.push([x, y, z]);
      }
    }
  }
  return JSON.stringify({
    format: "telos-voxel-1",
    dims: [vox.nx, vox.ny, vox.nz],
    count: voxels.length,
    voxels,
  }) + "\n";
}

/* Painter-order projection of the occupancy for an isometric canvas render:
   returns visible surface voxels sorted back-to-front with their projected
   2D position and a face-visibility flag set (top/left/right). Pure geometry;
   the caller supplies colour and draws the cube faces. */
export function isoOrder(vox) {
  const list = [];
  for (let z = 0; z < vox.nz; z += 1) {
    for (let y = 0; y < vox.ny; y += 1) {
      for (let x = 0; x < vox.nx; x += 1) {
        if (!occAt(vox, x, y, z)) continue;
        // Skip fully buried voxels (all six neighbours solid).
        let exposed = false;
        for (const f of FACES) { if (!occAt(vox, x + f.d[0], y + f.d[1], z + f.d[2])) { exposed = true; break; } }
        if (!exposed) continue;
        list.push({
          x, y, z,
          top: !occAt(vox, x, y, z + 1),
          right: !occAt(vox, x + 1, y, z),
          left: !occAt(vox, x, y + 1, z),
          depth: x + y + z,
        });
      }
    }
  }
  list.sort((a, b) => a.depth - b.depth);
  return list;
}
