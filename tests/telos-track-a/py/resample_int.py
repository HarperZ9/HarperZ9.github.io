"""Python twin of system/lib/sense-core/resample-int.mjs: resample-int/v1, integers only.

Exact-area box filter on Q24 linear planes (flat list, w * h * 3), each output value rounded half up.
Written from the rule text in tests/telos-track-a/PREREGISTRATION.md (T4 and T6).
"""
RESAMPLE_SCHEMA = "resample-int/v1"


def _axis_weights(src, dst):
    out = []
    for X in range(dst):
        a, b = X * src, (X + 1) * src
        i0, i1 = a // dst, (b - 1) // dst
        out.append((i0, [min(b, (i + 1) * dst) - max(a, i * dst) for i in range(i0, i1 + 1)]))
    return out


def resample_area_linear(lin, w, h, w2, h2):
    ax, ay = _axis_weights(w, w2), _axis_weights(h, h2)
    tmp = [0] * (h * w2 * 3)
    for y in range(h):
        for X in range(w2):
            i0, wx = ax[X]
            acc = [0, 0, 0]
            for k, f in enumerate(wx):
                q = (y * w + i0 + k) * 3
                for c in range(3):
                    acc[c] += f * lin[q + c]
            t = (y * w2 + X) * 3
            tmp[t:t + 3] = acc
    out = [0] * (w2 * h2 * 3)
    den = 2 * w * h
    for Y in range(h2):
        i0, wy = ay[Y]
        for X in range(w2):
            acc = [0, 0, 0]
            for k, f in enumerate(wy):
                t = ((i0 + k) * w2 + X) * 3
                for c in range(3):
                    acc[c] += f * tmp[t + c]
            o = (Y * w2 + X) * 3
            for c in range(3):
                out[o + c] = (2 * acc[c] + w * h) // den
    return out


def scaled_size(w, h, num, den):
    return max(1, (2 * w * num + den) // (2 * den)), max(1, (2 * h * num + den) // (2 * den))
