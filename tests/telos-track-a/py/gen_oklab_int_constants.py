"""Generate the integer constants of project-telos.oklab-int/v1 at 60-digit decimal precision.

The JavaScript (system/lib/sense-core/oklab-int.mjs) and the Python twin (oklab_int.py) embed these
values as integer literals. tests/telos-track-a/t3-oklab-int.test.mjs re-runs this script and checks
that both embedded copies equal its output, so neither copy can drift.

CLI: python gen_oklab_int_constants.py   prints one JSON object.
"""
import json
from decimal import Decimal, getcontext, ROUND_HALF_EVEN

getcontext().prec = 60

Q20 = Decimal(2) ** 20
Q36 = Decimal(2) ** 36

# Ottosson (2020, 2021 coefficients), as published; identical to sense-core colour-perceptual.mjs.
M1 = [["0.4122214708", "0.5363325363", "0.0514459929"],
      ["0.2119034982", "0.6806995451", "0.1073969566"],
      ["0.0883024619", "0.2817188376", "0.6299787005"]]
M2 = [["0.2104542553", "0.7936177850", "-0.0040720468"],
      ["1.9779984951", "-2.4285922050", "0.4505937099"],
      ["0.0259040371", "0.7827717662", "-0.8086757660"]]
# Per-channel OKLab ranges over the sRGB gamut (TELOS-RESOLUTION-SPEC E1), as exact decimals.
RANGES = {"L": ("0", "1"), "a": ("-0.234", "0.277"), "b": ("-0.312", "0.199")}


def rnd(x):
    """Nearest integer, ties to even (no tie occurs for these inputs; asserted below)."""
    q = x.to_integral_value(rounding=ROUND_HALF_EVEN)
    assert abs(x - q) != Decimal("0.5"), x
    return int(q)


def srgb_to_linear(i):
    c = Decimal(i) / Decimal(255)
    if c <= Decimal("0.04045"):
        return c / Decimal("12.92")
    return ((c + Decimal("0.055")) / Decimal("1.055")) ** Decimal("2.4")


def constants():
    lut = [rnd(srgb_to_linear(i) * Q20) for i in range(256)]
    m1 = [[rnd(Decimal(c) * Q20) for c in row] for row in M1]
    m2 = [[rnd(Decimal(c) * Q20) for c in row] for row in M2]
    ranges = {k: [rnd(Decimal(lo) * Q36), rnd(Decimal(hi) * Q36)] for k, (lo, hi) in RANGES.items()}
    return {"schema": "project-telos.oklab-int/v1", "lin_q20": lut, "m1_q20": m1, "m2_q20": m2, "ranges_q36": ranges}


if __name__ == "__main__":
    print(json.dumps(constants(), separators=(",", ":")))
