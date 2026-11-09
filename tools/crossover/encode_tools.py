"""Pack the tool-mark masters into one sprite for the index, with the light carried as alpha (as encode_mark.py).

python -I encode_tools.py MASTERS_DIR OUT_STEM id1 id2 ...
Cells are 112 px (56 px at 2x), ten to a row, in the order given. Writes OUT_STEM.avif and OUT_STEM.webp.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

src, stem, ids = Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
CELL, COLS = 112, 10
rows = (len(ids) + COLS - 1) // COLS
sheet = np.zeros((rows * CELL, COLS * CELL, 4))
for n, i in enumerate(ids):
    im = Image.open(src / f"{i}.png").convert("RGB").resize((CELL, CELL), Image.LANCZOS)
    c = np.asarray(im).astype(np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    a = lin.max(axis=2, keepdims=True)
    col = np.where(a > 1e-4, lin / np.maximum(a, 1e-4), 0.0)
    enc = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(col, 1 / 2.4) - 0.055)
    alpha = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
    y, x = (n // COLS) * CELL, (n % COLS) * CELL
    sheet[y:y + CELL, x:x + CELL] = np.concatenate([enc, alpha], axis=2)
out = Image.fromarray((sheet.clip(0, 1) * 255).round().astype(np.uint8), "RGBA")
out.save(stem + ".avif", quality=64)
out.save(stem + ".webp", quality=84, method=6)
print("sprite", stem, len(ids), "marks,", rows, "rows")
