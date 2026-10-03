"""Short explainer videos that rebuild to the same bytes and carry a receipt.

A spec (media/explainers/<slug>/spec.json) lists scenes: the line the narrator says and the
marks drawn on screen. tools/explainer/render.py draws every frame with Pillow, speaks each
line with the local Windows voice, encodes with a single-threaded bit-exact ffmpeg, and writes
the video, captions, a poster frame and a receipt. tools/explainer/embed.py turns a receipt
into the figure a page shows, and system/explainer/live.mjs makes that figure live: the media
engine draws the same spec in the page, with Learn recall checks after each step group.
README.md in this folder is the authoring guide.

Status colour follows the site's risk scale (system/media-engine/colour.mjs): low, moderate,
elevated and high liability. Only the highest-liability mark in a frame is drawn in colour;
every mark also names its level in words. The spectrum appears only in the aperture art.
"""
