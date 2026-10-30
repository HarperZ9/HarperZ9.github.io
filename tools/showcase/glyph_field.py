"""glyph_field.py: the name as glass rods, for the offline glass scene, with the live hero's layout
(world/site/hero/glyphs.js): the page's Hanken Grotesk at weight 700, two lines, the last standing on the waterline,
an exact Euclidean distance inside each letter, and a round section h = sqrt(1 - (1 - d/r)^2).

  python glyph_field.py <font.woff2> <W> <H> <out.npy>     (Pillow and SciPy)

Writes float16 [3, H, W]: height, coverage, and (row 0, first two cells) the lamp's x in uv and the rod radius in px.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt

CAM_S0, CAM_H, CAM_F, CAM_ZG = 0.42, 1.0, 1.6, 12.0


def main(font_path, W, H, out):
    W, H = int(W), int(H)
    lines, lead = ["Zain Dana", "Harper"], 1.08
    probe = ImageFont.truetype(font_path, 100)
    probe.set_variation_by_axes([700])
    widest = max(probe.getlength(s) for s in lines)
    size = min(W * 0.9 / widest * 100, H * 0.62 / (len(lines) * lead))
    f = ImageFont.truetype(font_path, max(8, int(round(size))))
    f.set_variation_by_axes([700])
    water_uv = CAM_S0 - CAM_H * CAM_F / CAM_ZG
    base = H * (1 - water_uv) - size * 0.06
    ss = 4 if W <= 8192 else 2   # coverage from a supersampled mask
    big = Image.new("L", (W * ss, H * ss), 0)
    fb = ImageFont.truetype(font_path, max(8, int(round(size * ss)))); fb.set_variation_by_axes([700])
    d = ImageDraw.Draw(big)
    lamp_x = 0.58
    for k, line in enumerate(lines):
        y = base - (len(lines) - 1 - k) * size * lead
        lw = f.getlength(line); x0 = (W - lw) / 2
        d.text((x0 * ss, y * ss), line, font=fb, fill=255, anchor="ls")
        p = line.find("p")
        if p >= 0:
            lamp_x = (x0 + f.getlength(line[:p]) + f.getlength("p") * 0.55) / W
    cov = np.asarray(big.resize((W, H), Image.BOX), np.float32) / 255.0
    del big
    inside = cov > 0.5
    dist = distance_transform_edt(inside).astype(np.float32)
    r = max(2.0, float(dist.max()) * 0.92)
    t = np.clip((dist + cov - 0.5) / r, 0, 1)
    h = np.where(t > 0, np.sqrt(1 - (1 - t) ** 2), 0).astype(np.float32)
    field = np.stack([h[::-1], cov[::-1], np.zeros_like(h)]).astype(np.float16)  # rows bottom-up, as the GL texture
    field[2, 0, 0], field[2, 0, 1] = lamp_x, min(r, 6e4)
    np.save(out, field)
    print(f"glyph field {W}x{H}: font {size:.1f} px, rod radius {r:.1f} px, lamp x {lamp_x:.4f}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
