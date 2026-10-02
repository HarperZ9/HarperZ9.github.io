"""Qwen3.5-2B token counts for every text Track A T5 and T7 measure (pre-registration 2, shared rules).

encode(text, add_special_tokens=False) on each layer text on its own. Needs the `tokenizers` package
(run with a Python that has it). The tokenizer file comes from the local Hugging Face cache; its SHA-256
is recorded.

CLI: python tokens.py <work dir>   reads <work>/out/packets.json, writes <work>/out/tokens.json
"""
import hashlib
import json
import os
import sys

from tokenizers import Tokenizer

TOKENIZER = os.environ.get("TELOS_QWEN35_TOKENIZER", "D:/hf-cache/hub/models--Qwen--Qwen3.5-2B/snapshots/"
                           "15852e8c16360a2fea060d615a32b45270f8a8fc/tokenizer.json")


def main(work):
    tok = Tokenizer.from_file(TOKENIZER)
    count = lambda t: len(tok.encode(t, add_special_tokens=False).ids)
    p = json.load(open(os.path.join(work, "out", "packets.json"), encoding="utf-8"))
    out = {"tokenizer": "Qwen3.5-2B", "tokenizer_sha256": hashlib.sha256(open(TOKENIZER, "rb").read()).hexdigest(),
           "base": {}, "colorGrid16": {}, "l2ByN": {}}
    for corpus, imgs in p["base"].items():
        out["base"][corpus] = {name: {k: count(pk[k]) for k in ("L0", "L1", "L2")} for name, pk in imgs.items()}
    out["colorGrid16"] = {name: count(t) for name, t in p["t7"]["colorGrid16"].items()}
    out["l2ByN"] = {name: {n: count(t) for n, t in d.items()} for name, d in p["t7"]["l2ByN"].items()}
    json.dump(out, open(os.path.join(work, "out", "tokens.json"), "w"))
    print(json.dumps({"tokenizer_sha256": out["tokenizer_sha256"]}))


if __name__ == "__main__":
    main(sys.argv[1])
