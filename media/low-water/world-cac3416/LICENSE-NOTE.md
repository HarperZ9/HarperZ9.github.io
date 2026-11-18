# Licence and source of this directory

Everything listed in `SHA256SUMS` is carried unchanged from https://github.com/HarperZ9/superframe at commit cac34166,
from `games/low-water/world/`: the walk (`walk/`), the raster and tile readers (`pgm.mjs`, `tiles.mjs`) and the
weather (`weather.mjs`). `out/20261118/` is the world the generator in `games/low-water/world/gen/` writes for seed
20261118 (`world.json`), packed into tiles by that folder's `tools/pack.mjs`. The generator's files are not committed
in superframe; this world was generated twice from the generator at that commit and the two runs matched byte for
byte. The code is licensed under FSL-1.1-MIT (Functional Source License 1.1, MIT future licence), the licence in that
repository at that commit. The site's own frame round the walk is `media/low-water/walk.html` and
`media/low-water/walk-frame.mjs`; to carry a newer walk, copy the folder at a new commit, rename it, rewrite
`SHA256SUMS` and point the frame and `scripts/build-product-pages.mjs` at it.
