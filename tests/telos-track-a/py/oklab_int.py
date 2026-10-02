"""Python twin of system/lib/sense-core/oklab-int.mjs: project-telos.oklab-int/v1.

Pure integers, written from the rule text in tests/telos-track-a/PREREGISTRATION.md (section T3).
`encode_cube_numpy` is the same arithmetic vectorised with int64 for the full-cube conformance run;
numpy is needed only for that function.
"""
OKLAB_INT_SCHEMA = "project-telos.oklab-int/v1"

LIN_Q20 = (
    0, 318, 637, 955, 1273, 1591, 1910, 2228, 2546, 2864, 3183, 3509,
    3855, 4220, 4605, 5009, 5433, 5878, 6343, 6828, 7335, 7863, 8413, 8984,
    9578, 10193, 10832, 11492, 12176, 12883, 13614, 14368, 15145, 15947, 16773, 17624,
    18499, 19399, 20324, 21274, 22250, 23251, 24278, 25331, 26410, 27516, 28648, 29807,
    30993, 32205, 33445, 34713, 36008, 37331, 38681, 40060, 41467, 42903, 44367, 45860,
    47381, 48932, 50512, 52121, 53760, 55428, 57127, 58855, 60613, 62402, 64221, 66071,
    67951, 69862, 71805, 73778, 75783, 77819, 79886, 81985, 84117, 86280, 88475, 90702,
    92962, 95254, 97579, 99937, 102328, 104751, 107208, 109698, 112222, 114779, 117370, 119994,
    122653, 125345, 128072, 130833, 133628, 136458, 139323, 142222, 145156, 148125, 151130, 154169,
    157244, 160355, 163501, 166683, 169900, 173154, 176443, 179769, 183131, 186530, 189964, 193436,
    196944, 200489, 204072, 207691, 211347, 215041, 218772, 222540, 226346, 230190, 234071, 237991,
    241948, 245944, 249978, 254050, 258161, 262310, 266498, 270724, 274990, 279294, 283637, 288020,
    292442, 296903, 301404, 305944, 310523, 315143, 319802, 324502, 329241, 334021, 338840, 343700,
    348601, 353542, 358523, 363546, 368609, 373713, 378858, 384044, 389271, 394539, 399849, 405201,
    410594, 416028, 421504, 427022, 432582, 438184, 443828, 449515, 455243, 461014, 466827, 472683,
    478582, 484523, 490507, 496534, 502604, 508717, 514873, 521072, 527315, 533601, 539930, 546303,
    552720, 559181, 565685, 572234, 578826, 585462, 592143, 598868, 605637, 612451, 619309, 626211,
    633159, 640151, 647188, 654270, 661397, 668569, 675786, 683048, 690356, 697709, 705108, 712552,
    720042, 727577, 735159, 742786, 750459, 758178, 765944, 773755, 781613, 789517, 797468, 805465,
    813509, 821599, 829736, 837920, 846151, 854429, 862753, 871125, 879545, 888011, 896525, 905086,
    913695, 922351, 931055, 939807, 948606, 957453, 966349, 975292, 984283, 993323, 1002411, 1011547,
    1020731, 1029964, 1039246, 1048576,
)
M1_Q20 = ((432246, 562385, 53945), (222197, 713765, 112614), (92592, 295404, 660581))
M2_Q20 = ((220677, 832169, -4270), (2074082, -2546563, 472482), (27162, 820796, -847958))
RANGES_Q36 = {"L": (0, 68719476736), "a": (-16080357556, 19035295056), "b": (-21440476742, 13675175870)}


def _cbrt_q16_exact(x):
    n = x << 32
    lo, hi = 0, 65537
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if mid * mid * mid <= n:
            lo = mid
        else:
            hi = mid - 1
    t = 2 * lo + 1
    return lo + 1 if n * 8 >= t * t * t else lo


CBRT_Q16 = tuple(_cbrt_q16_exact(x) for x in range(65537))


def _clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def oklab_q36_from_linear_q20(r, g, b):
    m, p, cb = M1_Q20, M2_Q20, CBRT_Q16
    lms = [_clamp(((m[k][0] * r + m[k][1] * g + m[k][2] * b + 524288) // 1048576 + 8) // 16, 0, 65536) for k in range(3)]
    l_, m_, s_ = cb[lms[0]], cb[lms[1]], cb[lms[2]]
    return tuple(p[k][0] * l_ + p[k][1] * m_ + p[k][2] * s_ for k in range(3))


def oklab_q36_from_srgb8(r8, g8, b8):
    return oklab_q36_from_linear_q20(LIN_Q20[r8], LIN_Q20[g8], LIN_Q20[b8])


def bin_q36(v, channel, bits):
    lo, hi = RANGES_Q36[channel]
    n = (1 << bits) - 1
    span = hi - lo
    return _clamp((2 * (v - lo) * n + span) // (2 * span), 0, n)


def bins_of_srgb8(r8, g8, b8):
    L, a, b = oklab_q36_from_srgb8(r8, g8, b8)
    return bin_q36(L, "L", 6), bin_q36(a, "a", 6), bin_q36(b, "b", 6), bin_q36(L, "L", 8)


def encode_cube_numpy():
    """4 bytes per colour (L6, a6, b6, L8), colour index (r << 16) | (g << 8) | b, as a uint8 array."""
    import numpy as np
    lut = np.array(LIN_Q20, dtype=np.int64)
    cb = np.array(CBRT_Q16, dtype=np.int64)
    m = np.array(M1_Q20, dtype=np.int64)
    p = np.array(M2_Q20, dtype=np.int64)
    gb = np.arange(65536, dtype=np.int64)
    G, B = lut[gb >> 8], lut[gb & 255]
    out = np.empty((256, 65536, 4), dtype=np.uint8)

    def nbin(v, ch, bits):
        lo, hi = RANGES_Q36[ch]
        n = (1 << bits) - 1
        span = hi - lo
        return np.clip((2 * (v - lo) * n + span) // (2 * span), 0, n)

    for r in range(256):
        R = lut[r]
        lms = [np.clip(((m[k, 0] * R + m[k, 1] * G + m[k, 2] * B + 524288) // 1048576 + 8) // 16, 0, 65536) for k in range(3)]
        c = [cb[x] for x in lms]
        L = p[0, 0] * c[0] + p[0, 1] * c[1] + p[0, 2] * c[2]
        A = p[1, 0] * c[0] + p[1, 1] * c[1] + p[1, 2] * c[2]
        Bb = p[2, 0] * c[0] + p[2, 1] * c[1] + p[2, 2] * c[2]
        out[r, :, 0] = nbin(L, "L", 6)
        out[r, :, 1] = nbin(A, "a", 6)
        out[r, :, 2] = nbin(Bb, "b", 6)
        out[r, :, 3] = nbin(L, "L", 8)
    return out.reshape(-1)
