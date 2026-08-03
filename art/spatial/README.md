# The authored spatial lane

This directory holds certified world packages for the authored lane: spatial
scenes generated from a named seed by this repository's own deterministic
builder. Nothing here is reconstructed from an image, so nothing hidden was
invented; the disclosure in each manifest says exactly that.

## Contents

- `build_scene.py` builds "Folded light, inhabited" from the seed
  `folded-light-inhabited`: the splat sidecar (10,500 forty-byte records) and
  the manifest with SHA-256 receipts. Stdlib only, byte-deterministic; running
  it twice produces identical output, so the committed artifacts are
  re-checkable by anyone.
- `folded-light.world.json` is the manifest (`zentropy.world-package/v1`).
- `folded-light.splats.bin` is the splat sidecar the manifest receipts.

## How it is served

The Studio's Spatial source (`system/studio-spatial.js`) fetches the package,
re-computes the sidecar's SHA-256 in the browser, and refuses to render on
DRIFT. The renderer (`system/spatial-scene.js`) clamps the splat block to the
device tier's budget from the hardware render plan and enforces the manifest's
camera boundary. The gallery's editions desk lists the scene as edition 20.

## The grammar

The scene follows the hybrid grammar the spatial session landed on after the
all-splat approach failed review: structure lives in seed-derived veil layers
on depth planes (with a depth prepass so material genuinely passes behind the
near light), and Gaussian primitives carry only what they render well: dust,
beam current, water glints, stars, sparks, bokeh. Motion is material-scoped
and pausable; reduced motion holds one still frame.

## Rebuilding

```bash
python art/spatial/build_scene.py
```

The output must be byte-identical to what is committed. If it is not, the
package or the builder changed and the manifest receipts will say so.
