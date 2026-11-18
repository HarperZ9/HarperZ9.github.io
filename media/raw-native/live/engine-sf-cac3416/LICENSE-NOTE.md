# Licence of this directory

These files are the engine's own (`native/src/renderer/gpu/shaders/post.wgsl`, `passes.wgsl`, `common.wgsl` and
`native/web/colour/colour.wgsl`, `colour.mjs`, `tables/aces2-sdr_srgb.json`), from commit cac34166 of
https://github.com/HarperZ9/superframe, the engine and the Playground by the site's author, licensed under FSL-1.1-MIT
as in that repository at that commit. The ACES 2.0 functions in `colour.wgsl` are ported from OpenColorIO v2.6.0
(BSD-3-Clause, Copyright Contributors to the OpenColorIO Project), as the file says. `SHA256SUMS` pins the bytes, and
the live renderer (`../engine.mjs`) checks them before any shader compiles.
