"""Twin of tests/telos-track-a/lib/images.mjs: the 1,000 seeded random images of step T3."""
from rng import xorshift32, rand_int


def random_images(count, seed=20261002):
    nxt = xorshift32(seed)
    for k in range(count):
        w = rand_int(nxt, 1, 64)
        h = rand_int(nxt, 1, 64)
        kind = nxt() % 4
        px = bytearray(w * h * 4)

        def put(x, y, r, g, b):
            i = (y * w + x) * 4
            px[i], px[i + 1], px[i + 2], px[i + 3] = r, g, b, 255

        if kind == 0:
            for y in range(h):
                for x in range(w):
                    r = nxt() & 255; g = nxt() & 255; b = nxt() & 255
                    put(x, y, r, g, b)
        elif kind == 1:
            base = [nxt() & 255, nxt() & 255, nxt() & 255]
            for y in range(h):
                for x in range(w):
                    put(x, y, *base)
            for _ in range(rand_int(nxt, 1, 6)):
                x0 = rand_int(nxt, 0, w - 1); y0 = rand_int(nxt, 0, h - 1)
                x1 = rand_int(nxt, x0, w - 1); y1 = rand_int(nxt, y0, h - 1)
                c = [nxt() & 255, nxt() & 255, nxt() & 255]
                for y in range(y0, y1 + 1):
                    for x in range(x0, x1 + 1):
                        put(x, y, *c)
        elif kind == 2:
            c0 = [nxt() & 255, nxt() & 255, nxt() & 255]
            c1 = [nxt() & 255, nxt() & 255, nxt() & 255]
            horizontal = nxt() % 2 == 0
            span = max(1, (w if horizontal else h) - 1)
            for y in range(h):
                for x in range(w):
                    t = x if horizontal else y
                    put(x, y, *[c0[i] + ((c1[i] - c0[i]) * t) // span for i in range(3)])
        else:
            base = nxt() & 255
            for y in range(h):
                for x in range(w):
                    v = max(0, min(255, base + (nxt() % 9) - 4))
                    put(x, y, v, v, v)
        yield f"random-{k:04d}", w, h, bytes(px)
