"""Compose the tool marks into one 3840 x 2160 review sheet, grouped by platform, with the colour keyboard dissected.

python -I tool_sheet.py MASTERS_DIR OUT.png
MASTERS_DIR holds <id>.png from `node tools/crossover/render.mjs --tools`. The keyboard strip shows each key's
measured-ink recipe and its colour through one layer under D65, computed from the same tables the shader uses.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
src, out = Path(sys.argv[1]), sys.argv[2]
js = (ROOT / "world/site/crossover/tool-marks.js").read_text(encoding="utf-8")
ids = re.findall(r'^\s+"?([a-z0-9-]+)"?: \["', js, re.M)
plat = {}
for m in re.finditer(r"// (THE FLYWHEEL|THE COMMONS|THE PLAYGROUND|ARTICULATE|BUILDLANG)\n(.*?)(?=\n  // |\n};)", js, re.S):
    for i in re.findall(r'^\s+"?([a-z0-9-]+)"?: \["', m.group(2), re.M):
        plat[i] = m.group(1)
tables = (ROOT / "world/site/crossover/tables.js").read_text(encoding="utf-8")
INKS = json.loads(re.search(r"INKS = (\{.*?\});", tables).group(1))
XYZ = json.loads(re.search(r"XYZ = (\[\[.*?\]\]);", tables).group(1))
kb = (ROOT / "world/site/crossover/keyboard.js").read_text(encoding="utf-8")
KEYS = {k: {a: float(b) for a, b in re.findall(r"(\w+): ([0-9.]+)", mix)} for k, mix in re.findall(r"(\w+): \{ role: \"\w+\",(?: recedes: true,)? mix: \{([^}]*)\}", kb)}
ROLE = dict(re.findall(r"(\w+): \{ role: \"(\w+)\"", kb))


def srgb(spec):
    t = [2.718281828 ** (-a) for a in spec]
    X = [sum(t[b] * XYZ[b][c] for b in range(16)) for c in range(3)]
    n = sum(XYZ[b][1] for b in range(16))
    X = [v / n for v in X]
    M = [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.204, 1.057]]
    rgb = [max(0.0, sum(M[r][c] * X[c] for c in range(3))) for r in range(3)]
    return tuple(int(round(255 * min(1, (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)))) for v in rgb)


W, H = 3840, 2160
sheet = Image.new("RGB", (W, H), (8, 12, 18))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype("arial.ttf", 22)
    fb = ImageFont.truetype("arialbd.ttf", 30)
except OSError:
    f = fb = ImageFont.load_default()
cols, cell, rowh = 13, 285, 252
rows = [("THE FLYWHEEL",), ("THE COMMONS",), ("THE PLAYGROUND",), ("ARTICULATE", "BUILDLANG")]
x0, y = 70, 60
for group in rows:
    items = [(p, i) for p in group for i in ids if plat.get(i) == p]
    for n, (p, i) in enumerate(items):
        c = n % cols
        if n and c == 0:
            y += rowh
        x = x0 + c * cell
        im = Image.open(src / f"{i}.png").convert("RGB").resize((214, 214), Image.LANCZOS)
        sheet.paste(im, (x + 35, y + 6))
        d.text((x + 35 + 107, y + 226), i, font=f, fill=(225, 220, 205), anchor="mt")
        if n == 0 or items[n - 1][0] != p:
            d.text((x + 35, y + 2), p, font=f, fill=(246, 241, 228), anchor="ls")
    y += rowh + 14
ky = H - 230
d.text((x0, ky - 18), "Colour keyboard: each key a mix of the five inks measured from the De A a Z print", font=fb, fill=(246, 241, 228))
for k, (name, mix) in enumerate(KEYS.items()):
    spec = [sum(w * INKS[ink][b] for ink, w in mix.items()) for b in range(16)]
    x = x0 + k * 535
    d.rounded_rectangle((x, ky + 20, x + 150, ky + 170), 24, fill=srgb(spec))
    d.text((x + 170, ky + 30), f"{name} ({ROLE[name]})", font=fb, fill=(246, 241, 228))
    for j, (ink, w) in enumerate(mix.items()):
        d.rectangle((x + 170, ky + 78 + j * 30, x + 170 + int(150 * w), ky + 98 + j * 30), fill=srgb([w * v for v in INKS[ink]]))
        d.text((x + 335, ky + 76 + j * 30), f"{ink} {w:g}", font=f, fill=(200, 196, 185))
sheet.save(out)
print("sheet", out, sum(1 for i in ids if i in plat), "marks")
