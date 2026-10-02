"""Python twin of shared-frame/canonical.js: project-telos.canonical-bytes/v1 and its SHA-256.

Written from the rule text in tests/telos-track-a/PREREGISTRATION.md (section T2) with the standard
library only, so a receipt made in the browser can be re-derived without any JavaScript.

CLI: python canonical_receipt.py <in.json> <out.json>
  in.json  = {"receipts": [ ... ]}   (values as parsed by json.load)
  out.json = [{"canonical": "<text>", "sha256": "<hex>"} or {"error": "<code>"}, ...]
"""
import hashlib
import json
import sys

MAX_SAFE = 2 ** 53 - 1
ESC = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}


class CanonicalError(ValueError):
    def __init__(self, code, path):
        super().__init__(f"{code} at {path}")
        self.code = code


def _quote(s, path):
    if any(0xD800 <= ord(ch) <= 0xDFFF for ch in s):
        raise CanonicalError("lone_surrogate", path)
    out = ['"']
    for ch in s:
        if ch in ESC:
            out.append(ESC[ch])
        elif ord(ch) < 0x20:
            out.append("\\u%04x" % ord(ch))
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _utf16_key(k):
    return k.encode("utf-16-be", "surrogatepass")


def canonical(v, path="$"):
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, str):
        return _quote(v, path)
    if isinstance(v, int):
        if abs(v) > MAX_SAFE:
            raise CanonicalError("unsafe_integer", path)
        return str(v)
    if isinstance(v, float):
        raise CanonicalError("non_integer_number", path)
    if isinstance(v, list):
        return "[" + ",".join(canonical(x, f"{path}[{i}]") for i, x in enumerate(v)) + "]"
    if isinstance(v, dict):
        keys = sorted(v.keys(), key=_utf16_key)
        return "{" + ",".join(_quote(k, path + "#key") + ":" + canonical(v[k], f"{path}.{k}") for k in keys) + "}"
    raise CanonicalError("unsupported_type:" + type(v).__name__, path)


def receipt_sha256(v):
    return hashlib.sha256(canonical(v).encode("utf-8")).hexdigest()


def main(src, dst):
    data = json.load(open(src, encoding="utf-8"))
    out = []
    for r in data["receipts"]:
        try:
            text = canonical(r)
            out.append({"canonical": text, "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()})
        except CanonicalError as e:
            out.append({"error": e.code})
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
