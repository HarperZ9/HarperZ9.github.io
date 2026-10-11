# Licence of this directory

These files are raw-native's web GPU host (`web/raw-gpu.mjs`, `web/frame-graph.mjs`) and its 2D
compositor (`web/compositor.mjs`), from commit 4edf976 of https://github.com/HarperZ9/raw-native,
an engine by the site's author. They are licensed under FSL-1.1-MIT (Functional Source License
1.1, MIT future licence), the licence in that repository at that commit. `SHA256SUMS` pins the
files. The Studio's tools that draw through raw-native (Dimensions, system/ndim-gpu.js, first)
load them; each keeps its earlier renderer as the fallback where WebGPU is missing.
