# Licence of this directory

These files are raw-native's post stack and the shader library's looks (`web/motion/post.mjs`,
`web/motion/post_run.mjs`, `web/shaders/post.mjs` and every module it imports), its web GPU host
(`web/raw-gpu.mjs`, `web/frame-graph.mjs`) and the committed frame set of its pass check
(`tests/web/post_frames.mjs`), from release 0.8.0 of https://github.com/HarperZ9/raw-native, an
engine by the site's author. They keep the repository's layout so their imports resolve unchanged.
They are licensed under FSL-1.1-MIT (Functional Source License 1.1, MIT future licence), the
licence in `LICENSE` here. `SHA256SUMS` pins every file (this note excepted). The Studio's Finish
layer (system/studio-finish.js) loads them when a finish is chosen.
