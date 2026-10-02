"""xorshift32, the Python twin of tests/telos-track-a/lib/rng.mjs (integer-exact)."""


def xorshift32(seed):
    x = seed & 0xFFFFFFFF
    if x == 0:
        raise ValueError("xorshift32 seed must be non-zero")

    def nxt():
        nonlocal x
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        return x
    return nxt


def rand_int(nxt, lo, hi):
    return lo + (nxt() % (hi - lo + 1))
