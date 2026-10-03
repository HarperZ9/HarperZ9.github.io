"""Python twin of system/lib/sense-core/oklab-int.mjs: project-telos.oklab-int/v2 (amendment 1).

Pure integers, written from the rule text in tests/telos-track-a/PREREGISTRATION.md (T3 and
amendment 1). `encode_cube_numpy` and `cube_accuracy_numpy` are the same arithmetic vectorised with
int64 for the full-cube runs; numpy is needed only for those two functions.
"""
OKLAB_INT_SCHEMA = "project-telos.oklab-int/v2"

LIN_Q24 = (
    0, 5092, 10185, 15277, 20369, 25462, 30554, 35646, 40739, 45831,
    50923, 56146, 61682, 67524, 73676, 80144, 86931, 94043, 101483, 109255,
    117364, 125813, 134607, 143749, 153244, 163095, 173306, 183880, 194821, 206133,
    217819, 229883, 242327, 255157, 268373, 281981, 295983, 310382, 325182, 340386,
    355996, 372016, 388449, 405298, 422565, 440255, 458369, 476910, 495881, 515286,
    535127, 555406, 576126, 597291, 618902, 640963, 663476, 686443, 709868, 733752,
    758099, 782910, 808189, 833938, 860159, 886854, 914027, 941680, 969814, 998433,
    1027538, 1057133, 1087218, 1117798, 1148873, 1180447, 1212520, 1245097, 1278179, 1311767,
    1345865, 1380475, 1415598, 1451237, 1487394, 1524071, 1561270, 1598994, 1637244, 1676023,
    1715332, 1755173, 1795550, 1836463, 1877915, 1919907, 1962442, 2005522, 2049149, 2093324,
    2138049, 2183328, 2229161, 2275550, 2322497, 2370005, 2418074, 2466708, 2515908, 2565675,
    2616012, 2666920, 2718402, 2770458, 2823092, 2876304, 2930097, 2984472, 3039432, 3094977,
    3151110, 3207832, 3265145, 3323052, 3381553, 3440650, 3500346, 3560641, 3621538, 3683038,
    3745144, 3807855, 3871176, 3935106, 3999648, 4064803, 4130573, 4196960, 4263965, 4331589,
    4399836, 4468706, 4538200, 4608321, 4679069, 4750448, 4822457, 4895099, 4968376, 5042288,
    5116838, 5192027, 5267856, 5344328, 5421443, 5499204, 5577611, 5656667, 5736372, 5816729,
    5897738, 5979402, 6061722, 6144699, 6228335, 6312631, 6397589, 6483210, 6569496, 6656448,
    6744068, 6832357, 6921317, 7010948, 7101253, 7192233, 7283889, 7376223, 7469237, 7562930,
    7657306, 7752366, 7848110, 7944540, 8041658, 8139465, 8237963, 8337152, 8437035, 8537612,
    8638885, 8740855, 8843524, 8946893, 9050964, 9155737, 9261215, 9367397, 9474287, 9581885,
    9690192, 9799210, 9908940, 10019383, 10130542, 10242416, 10355008, 10468318, 10582349, 10697100,
    10812575, 10928773, 11045697, 11163346, 11281724, 11400831, 11520668, 11641236, 11762538, 11884573,
    12007344, 12130852, 12255098, 12380082, 12505807, 12632274, 12759484, 12887438, 13016137, 13145583,
    13275776, 13406719, 13538412, 13670857, 13804054, 13938006, 14072712, 14208175, 14344396, 14481375,
    14619114, 14757615, 14896878, 15036905, 15177696, 15319253, 15461578, 15604671, 15748533, 15893166,
    16038571, 16184750, 16331702, 16479430, 16627934, 16777216,
)
M1_Q20 = ((432246, 562385, 53945), (222197, 713765, 112614), (92592, 295404, 660581))
M2_Q20 = ((220677, 832169, -4270), (2074082, -2546563, 472482), (27162, 820796, -847958))
RANGES_Q36 = {"L": (0, 68719476736), "a": (-16080357556, 19035295056), "b": (-21440476742, 13675175870)}


def cbrt_q44_to_q16(x):
    n = x * 16
    f = round(n ** (1.0 / 3.0))
    while f > 0 and f * f * f > n:
        f -= 1
    while (f + 1) ** 3 <= n:
        f += 1
    t = 2 * f + 1
    return f + 1 if n * 8 >= t * t * t else f


def _clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def oklab_q36_from_linear_q24(r, g, b):
    m, p = M1_Q20, M2_Q20
    c = [cbrt_q44_to_q16(max(0, m[k][0] * r + m[k][1] * g + m[k][2] * b)) for k in range(3)]
    return tuple(p[k][0] * c[0] + p[k][1] * c[1] + p[k][2] * c[2] for k in range(3))


def oklab_q36_from_srgb8(r8, g8, b8):
    return oklab_q36_from_linear_q24(LIN_Q24[r8], LIN_Q24[g8], LIN_Q24[b8])


def bin_q36(v, channel, bits):
    lo, hi = RANGES_Q36[channel]
    n = (1 << bits) - 1
    span = hi - lo
    return _clamp((2 * (v - lo) * n + span) // (2 * span), 0, n)


def bins_of_srgb8(r8, g8, b8):
    L, a, b = oklab_q36_from_srgb8(r8, g8, b8)
    return bin_q36(L, "L", 6), bin_q36(a, "a", 6), bin_q36(b, "b", 6), bin_q36(L, "L", 8)


def _np_cbrt_q44_to_q16(np, x):
    n = x * 16
    f = np.rint(np.cbrt(n.astype(np.float64))).astype(np.int64)
    while True:
        hi = (f > 0) & (f * f * f > n)
        if not hi.any():
            break
        f = f - hi
    while True:
        lo = (f + 1) ** 3 <= n
        if not lo.any():
            break
        f = f + lo
    t = 2 * f + 1
    return f + (n * 8 >= t * t * t)


def _np_slice(np, r):
    lut = np.array(LIN_Q24, dtype=np.int64)
    m = np.array(M1_Q20, dtype=np.int64)
    p = np.array(M2_Q20, dtype=np.int64)
    gb = np.arange(65536, dtype=np.int64)
    G, B, R = lut[gb >> 8], lut[gb & 255], lut[r]
    c = [_np_cbrt_q44_to_q16(np, np.maximum(0, m[k, 0] * R + m[k, 1] * G + m[k, 2] * B)) for k in range(3)]
    return [p[k, 0] * c[0] + p[k, 1] * c[1] + p[k, 2] * c[2] for k in range(3)]


def encode_cube_numpy():
    """4 bytes per colour (L6, a6, b6, L8), colour index (r << 16) | (g << 8) | b, as a uint8 array."""
    import numpy as np
    out = np.empty((256, 65536, 4), dtype=np.uint8)

    def nbin(v, ch, bits):
        lo, hi = RANGES_Q36[ch]
        n = (1 << bits) - 1
        span = hi - lo
        return np.clip((2 * (v - lo) * n + span) // (2 * span), 0, n)

    for r in range(256):
        L, A, B = _np_slice(np, r)
        out[r, :, 0] = nbin(L, "L", 6)
        out[r, :, 1] = nbin(A, "a", 6)
        out[r, :, 2] = nbin(B, "b", 6)
        out[r, :, 3] = nbin(L, "L", 8)
    return out.reshape(-1)


def cube_accuracy_numpy():
    """Max |integer OKLab - float64 OKLab| per channel over the full cube, with the worst colours."""
    import numpy as np
    M1f = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                    [0.0883024619, 0.2817188376, 0.6299787005]])
    M2f = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
                    [0.0259040371, 0.7827717662, -0.8086757660]])
    c = np.arange(256, dtype=np.float64) / 255.0
    lutf = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    gb = np.arange(65536)
    G, B = lutf[gb >> 8], lutf[gb & 255]
    worst = [0.0, 0.0, 0.0]
    where = [None, None, None]
    total = [0.0, 0.0, 0.0]
    for r in range(256):
        R = lutf[r]
        lms = [M1f[k, 0] * R + M1f[k, 1] * G + M1f[k, 2] * B for k in range(3)]
        cr = [np.cbrt(v) for v in lms]
        flt = [M2f[k, 0] * cr[0] + M2f[k, 1] * cr[1] + M2f[k, 2] * cr[2] for k in range(3)]
        ints = _np_slice(np, r)
        for k in range(3):
            d = np.abs(ints[k].astype(np.float64) / 2.0 ** 36 - flt[k])
            total[k] += float(d.sum())
            i = int(d.argmax())
            if d[i] > worst[k]:
                worst[k] = float(d[i])
                where[k] = [r, i >> 8, i & 255]
    return {"maxAbs": dict(zip("Lab", worst)), "worstAt": dict(zip("Lab", where)),
            "meanAbs": {ch: total[k] / 16777216 for k, ch in enumerate("Lab")}}
