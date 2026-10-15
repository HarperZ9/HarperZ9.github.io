# Where these files come from

The raw-native v0.8.0 release (https://github.com/HarperZ9/raw-native/releases/tag/v0.8.0), tag
commit 5dd27ef40782a70475fbae8d3d95121822de2b8e. Each file is the tagged file's own bytes, at its
path in the repository, not edited. To recheck one from a clone of raw-native:

    git show v0.8.0:web/motion/post_run.mjs | sha256sum

and compare with its line in `SHA256SUMS` here. `system/studio-finish.test.mjs` checks every file
against `SHA256SUMS`.
