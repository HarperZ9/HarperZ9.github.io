"""Full-cube bins for the Track A T3 conformance run (numpy).

CLI: python cube_bins.py int <out.bin>      integer path (oklab_int.encode_cube_numpy)
     python cube_bins.py float <out.bin>    float64 prototype path with the same bin rule as
                                            conformance-cube.mjs's float path (floor(x + 0.5)),
                                            plus <out.bin>.lut with the 256 float linear values
Both write 4 bytes per colour (L6, a6, b6, L8), colour index (r << 16) | (g << 8) | b.
"""
import sys
import numpy as np

M1 = ((0.4122214708, 0.5363325363, 0.0514459929),
      (0.2119034982, 0.6806995451, 0.1073969566),
      (0.0883024619, 0.2817188376, 0.6299787005))
M2 = ((0.2104542553, 0.7936177850, -0.0040720468),
      (1.9779984951, -2.4285922050, 0.4505937099),
      (0.0259040371, 0.7827717662, -0.8086757660))
RANGES = {"L": (0.0, 1.0), "a": (-0.234, 0.277), "b": (-0.312, 0.199)}


def float_cube(out_path):
    c = np.arange(256, dtype=np.float64) / 255.0
    lut = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    lut.astype("<f8").tofile(out_path + ".lut")
    gb = np.arange(65536)
    G, B = lut[gb >> 8], lut[gb & 255]
    out = np.empty((256, 65536, 4), dtype=np.uint8)

    def fbin(v, ch, bits):
        lo, hi = RANGES[ch]
        n = (1 << bits) - 1
        return np.clip(np.floor((v - lo) / (hi - lo) * n + 0.5), 0, n)

    for r in range(256):
        R = lut[r]
        l = M1[0][0] * R + M1[0][1] * G + M1[0][2] * B
        m = M1[1][0] * R + M1[1][1] * G + M1[1][2] * B
        s = M1[2][0] * R + M1[2][1] * G + M1[2][2] * B
        l_, m_, s_ = np.cbrt(l), np.cbrt(m), np.cbrt(s)
        L = M2[0][0] * l_ + M2[0][1] * m_ + M2[0][2] * s_
        A = M2[1][0] * l_ + M2[1][1] * m_ + M2[1][2] * s_
        Bb = M2[2][0] * l_ + M2[2][1] * m_ + M2[2][2] * s_
        out[r, :, 0] = fbin(L, "L", 6)
        out[r, :, 1] = fbin(A, "a", 6)
        out[r, :, 2] = fbin(Bb, "b", 6)
        out[r, :, 3] = fbin(L, "L", 8)
    out.reshape(-1).tofile(out_path)


if __name__ == "__main__":
    mode, dst = sys.argv[1], sys.argv[2]
    if mode == "int":
        from oklab_int import encode_cube_numpy
        encode_cube_numpy().tofile(dst)
    elif mode == "float":
        float_cube(dst)
    else:
        raise SystemExit("mode must be int or float")
