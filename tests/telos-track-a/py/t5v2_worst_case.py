"""Track A T5 v2 (pre-registration 3): the constructed worst-case L1 text. Every L row and ab row at the largest
token count found in 20,000 seeded random rows (random.Random(20261012)), under the Qwen3.5-2B tokenizer.
Writes <t7v2 work>/out/l1_worst_case.json. Needs `tokenizers` only. CLI: python t5v2_worst_case.py <t7v2 work dir>
"""
import json
import os
import random
import sys

from tokenizers import Tokenizer

from tokens import TOKENIZER

B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
HEADER = "L1 oklab-int/v2 cells:8x8 chroma:4x4 bits:L6,ab6 alphabet:b64"


def worst_case(tok):
    count = lambda t: len(tok.encode(t, add_special_tokens=False).ids)
    rnd = random.Random(20261012)
    rows = ["".join(rnd.choice(B64) for _ in range(8)) for _ in range(20000)]
    abs_ = [" ".join(rnd.choice(B64) + rnd.choice(B64) for _ in range(4)) for _ in range(20000)]
    wl = max(rows, key=lambda r: count("\n" + r + "\n"))
    wa = max(abs_, key=lambda r: count("\n" + r + "\n"))
    text = HEADER + "\nL:\n" + "\n".join([wl] * 8) + "\nab:\n" + "\n".join([wa] * 4)
    return {"row": wl, "ab_row": wa, "tokens": count(text), "bytes": len(text.encode()), "header_tokens": count(HEADER)}


if __name__ == "__main__":
    wc = worst_case(Tokenizer.from_file(TOKENIZER))
    json.dump(wc, open(os.path.join(sys.argv[1], "out", "l1_worst_case.json"), "w"))
    print(json.dumps(wc))
