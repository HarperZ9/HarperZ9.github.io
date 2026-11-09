"""Encode a 720 px mark master (backlit glass on black) to the site's 256 px AVIF and WebP with alpha.

python -I encode_mark.py MASTER.png OUT_STEM

The master is light on black, which the page would add to the dark field. A blend mode cannot reach the field from
inside the page's own stacking context, so the light is carried as alpha instead: a = the brightest channel and
colour = light / a. Composited over the field, that gives light + (1 - a) x field, close to adding the light.
"""
import sys

import numpy as np
from PIL import Image

src, stem = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB").resize((256, 256), Image.LANCZOS)
c = np.asarray(im).astype(np.float64) / 255.0
lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
a = lin.max(axis=2, keepdims=True)
col = np.where(a > 1e-4, lin / np.maximum(a, 1e-4), 0.0)
enc = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(col, 1 / 2.4) - 0.055)
alpha = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)  # perceptual alpha keeps faint rims
out = Image.fromarray(np.concatenate([enc, alpha], axis=2).clip(0, 1).__mul__(255).round().astype(np.uint8), "RGBA")
out.save(stem + ".avif", quality=62)
out.save(stem + ".webp", quality=82, method=6)
print("encoded", stem)
