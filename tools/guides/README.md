<!-- writing-profile: readme -->
# The guides

Tallow, Pylon and Rerun host the explainer films. Their words live once, in `data.py`; `page.py` writes `guides.html` and the host line at the head of each film on `explainers.html` (through `tools/explainer/film/page.py`); the home page's `home/src/Guides.tsx` repeats the same words, and `tests/test_guides.py` fails when they drift.

## Media

`build_media.py` turns a render round of the guides into small web files in `media/guides/<guide>/`: a still, a close portrait, the turnaround sheet, a 2.4 s idle loop and a 3.2 s action (640 x 360, no sound), the introduction (1280 x 720, silent unless an audio file is given), its poster and captions. `media/guides/guides.json` holds the SHA-256 of every file. The three guides together come to about 3.7 MB.

    python -m tools.guides.build_media --renders RENDERS_DIR --clips CLIPS_DIR
    python -m tools.guides.page

## Swapping an introduction

The introductions ship without sound for now, captioned. Pages link fixed file names, so adding or changing a voice needs no code change: put the audio under the existing picture with `--intro tallow=NEW.wav` (any audio ffmpeg reads), write the new sentence times to `media/guides/<guide>/intro.timing.json` if the words or their times changed, and run `build_media.py` again. It rewrites `intro.mp4`, `intro.vtt` and the manifest. The mouths in the picture were timed to the current audio, so a different take needs the intro re-rendered from that audio, or the lips drift.

## On the page

Loops load when their frame nears the screen, play only while it is on screen, and never play with reduced motion. An introduction plays only on a press, with captions on. The "Your call" question reveals the same answer whatever is chosen and keeps nothing. Nothing plays the next thing when a video ends.
