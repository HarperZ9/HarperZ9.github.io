"""Encode a 3840 x 2160 crossover master to the site's plates at 1280, 1920 and 3840 px, AVIF and WebP.

python -I encode_plate.py MASTER.png OUT_STEM
"""
import sys

from PIL import Image

src, stem = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
for w in (1280, 1920, 3840):
    r = im if w == im.width else im.resize((w, w * im.height // im.width), Image.LANCZOS)
    r.save(f"{stem}-{w}.avif", quality=60)
    r.save(f"{stem}-{w}.webp", quality=82, method=6)
print("encoded", stem)
