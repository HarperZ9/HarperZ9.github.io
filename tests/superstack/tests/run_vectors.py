# SPDX-License-Identifier: MIT
"""Run every vector in vectors/ against superstack.py.

Usage: python tests/run_vectors.py [--impl PATH] [--summary OUT.json]
Exit 0 only when every check passes. --summary writes the number of checks
per file, which CI compares across the three languages so no runner can skip.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VEC = ROOT / "vectors"


def load_impl(path):
    spec = importlib.util.spec_from_file_location("superstack_under_test", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class Run:
    def __init__(self):
        self.counts, self.fails, self.file = {}, [], None

    def check(self, ok, what):
        self.counts[self.file] = self.counts.get(self.file, 0) + 1
        if not ok:
            self.fails.append(f"{self.file}: {what}")

    def raises(self, fn, what):
        try:
            fn()
        except (ValueError, TypeError, OverflowError):
            self.check(True, what)
            return
        self.check(False, what + " (no error)")


def close(a, b, tol):
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= tol


def synth(sig):
    rate, ch, n = sig["rate"], sig["channels"], sig["frames"]
    out = []
    for i in range(n):
        for c in range(ch):
            if sig["kind"] == "silence":
                out.append(0.0)
                continue
            amp = sig["amp"][c]
            if sig["kind"] == "gated" and i >= n // 2:
                amp = amp * sig["quiet_gain"]
            out.append(amp * math.sin(2.0 * math.pi * sig["freq"] * i / rate))
    return out


def i16(vals):
    return b"".join((v & 0xFFFF).to_bytes(2, "little") for v in vals)


def run_canonical(ss, v, r):
    for c in v["numbers"]:
        x = float(c["in"]) if c["type"] == "float" else int(c["in"])
        r.check(ss.canonical_number(x) == c["out"], f"number {c['in']}")
    for c in v["reject_numbers"]:
        x = float(c["in"]) if c["type"] == "float" else int(c["in"])
        r.raises(lambda: ss.canonical_number(x), f"reject {c['in']}")
    for c in v["docs"]:
        out = ss.canonical(json.loads(c["in"]))
        r.check(out == c["out"], f"doc {c['in']}")
        r.check(ss.sha256_hex(out.encode("utf-8")) == c["sha256"], f"doc sha {c['in']}")
    for t in v["reject_docs"]:
        r.raises(lambda: ss.canonical(json.loads(t)), f"reject doc {t}")


def run_hash(ss, v, r):
    for c in v["cases"]:
        r.check(ss.sha256_hex(bytes.fromhex(c["hex"])) == c["sha256"], f"sha256 len {len(c['hex']) // 2}")


def run_seed(ss, v, r):
    s = v["substream"]
    r.check(ss.substream(s["seed"], s["tag"]) == s["out"], "substream")
    for c in v["seeds"]:
        r.check(ss.xmur3(c["seed"]) == c["u32"], f"xmur3 {c['seed']!r}")
        r.check(len(ss.utf16_units(c["seed"])) == c["utf16_units"], f"utf16 length {c['seed']!r}")
        g = ss.rng(c["seed"])
        r.check([g.next_u32() for _ in c["draws_u32"]] == c["draws_u32"], f"draws {c['seed']!r}")
        g = ss.rng(c["seed"])
        r.check([g.next_float() for _ in c["floats"]] == c["floats"], f"floats {c['seed']!r}")
    for c in v["mulberry32"]:
        m = ss.Mulberry32(c["state"])
        r.check([m.next_u32() for _ in c["draws_u32"]] == c["draws_u32"], f"mulberry32 {c['state']}")
    for c in v["pixel_hash"]:
        r.check(ss.pixel_hash(c["x"], c["y"], c["s"]) == c["u32"], f"pixel_hash {c}")
        r.check(ss.pixel_hash01(c["x"], c["y"], c["s"]) == c["unit"], f"pixel_hash01 {c}")
    g = ss.rng(v["site_make_rng"]["seed"])
    r.check([g.next_float() for _ in range(5)] == v["site_make_rng"]["first_five"], "site makeRng parity")


def run_clock(ss, v, r):
    r.check(ss.FLICKS_PER_SECOND == v["per_second"], "per_second")
    r.check(list(ss.SAMPLE_RATES) == v["sample_rates"], "sample rate set")
    for c in v["per_sample"]:
        r.check(ss.flicks_per_sample(c["rate"]) == c["flicks"], f"per_sample {c['rate']}")
    for c in v["per_frame"]:
        r.check(ss.flicks_per_frame(c["num"], c["den"]) == c["flicks"], f"per_frame {c['num']}/{c['den']}")
    for rate in v["reject_rates"]:
        r.raises(lambda: ss.flicks_per_sample(rate), f"reject rate {rate}")
    for n, d in v["reject_frames"]:
        r.raises(lambda: ss.flicks_per_frame(n, d), f"reject frames {n}/{d}")
    for c in v["durations"]:
        r.check(c["samples"] * ss.flicks_per_sample(c["rate"]) == c["flicks"], f"duration {c}")


def run_sound(ss, v, r):
    for c in v["quantize"]:
        got = int.from_bytes(ss.quantize_s16([c["in"]]), "little", signed=True)
        r.check(got == c["out"], f"quantize {c['in']}")
    for rate, filt in v["k_weighting"].items():
        got = ss.k_weighting(int(rate))
        r.check(all(abs(a - b) <= v["k_tolerance"] for fa, fb in zip(got, filt) for a, b in zip(fa, fb)),
                f"k_weighting {rate}")
    for c in v["loudness"]:
        x = synth(c)
        r.check(close(ss.integrated_lufs(x, c["rate"], c["channels"]), c["integrated_lufs"], c["tolerance_lu"]),
                f"lufs {c['name']}")
        r.check(close(ss.peak_dbfs(x), c["peak_dbfs"], 1e-9), f"peak {c['name']}")
    for c in v["loudness_check"]:
        r.check(ss.loudness_check(c["class"], c["lufs"], c["peak"]) == c["verdict"], f"loudness_check {c}")
    r.check(json.dumps(ss.LOUDNESS_TARGETS, sort_keys=True) == json.dumps(v["targets"], sort_keys=True), "targets")


def run_export(ss, v, r):
    for c in v["cases"]:
        if c["format"] == "wav":
            out = ss.wav_s16(bytes.fromhex(c["pcm_hex"]), c["rate"], c["channels"])
            r.check(out[:44].hex() == c["header_hex"], f"wav header {c['rate']}")
        elif c["format"] == "ppm":
            out = ss.ppm_rgb8(bytes.fromhex(c["body_hex"]), c["width"], c["height"])
        else:
            out = ss.pgm_u8(bytes.fromhex(c["body_hex"]), c["width"], c["height"])
        r.check(hashlib.sha256(out).hexdigest() == c["sha256"], f"export {c['format']}")


def run_colour(ss, v, r):
    tol = v["tolerance"]
    for c in v["oklab"]:
        got = ss.hex_to_oklab(c["hex"])
        r.check(all(abs(a - b) <= tol for a, b in zip(got, c["oklab"])), f"oklab {c['hex']}")
    for c in v["oklab_inverse"]:
        got = ss.oklab_to_linear_srgb(*c["oklab"])
        r.check(all(abs(a - b) <= tol for a, b in zip(got, c["linear_srgb"])), f"oklab inverse {c['oklab']}")
    r.check(list(ss.RISK_LEVELS) == v["risk_levels"], "risk levels")
    r.check(ss.RISK_TOKENS == v["risk_tokens"], "risk tokens")
    r.check({k: list(x) for k, x in ss.RISK_GROUNDS.items()} == v["risk_grounds"], "risk grounds")
    for c in v["contrast"]:
        cr = ss.contrast_ratio(c["fg"], c["bg"])
        r.check(abs(cr - c["ratio"]) <= tol and (cr >= 4.5) == c["aa_text"], f"contrast {c['fg']} {c['bg']}")
    for c in v["risk_of"]:
        r.check(ss.risk_of(c["in"]) == c["out"], f"risk_of {c['in']!r}")
    for c in v["hot_mark"]:
        r.check(ss.hot_mark(c["in"]) == c["out"], f"hot_mark {c['in']}")


def run_reconcile(ss, v, r):
    for c in v["identity"]:
        r.check(ss.identity(c["ref"], c["cand"]) == c["out"], "identity")
    for c in v["pcm_s16"]:
        got = ss.reconcile_pcm_s16(i16(c["ref"]), i16(c["cand"]))
        r.check(ss.canonical(got) == ss.canonical(c["expected"]), f"pcm {c['name']}")
    for c in v["rgb8"]:
        got = ss.reconcile_rgb8(bytes(c["ref"]), bytes(c["cand"]))
        r.check(ss.canonical(got) == ss.canonical(c["expected"]), f"rgb8 {c['name']}")
    for c in v["f32_rmse"]:
        a, b = struct.pack(f"<{len(c['ref'])}f", *c["ref"]), struct.pack(f"<{len(c['cand'])}f", *c["cand"])
        got = ss.f32_rmse(a, b, None if c["mask"] is None else bytes(c["mask"]))
        r.check(got == c["rmse"], f"f32_rmse {c['mask']}")
    for c in v["round6"]:
        r.check(ss.round6(c["in"]) == c["out"], f"round6 {c['in']}")


def run_receipt(ss, v, r):
    for c in v["make"]:
        a = dict(c["args"])
        content = bytes.fromhex(a.pop("content_hex"))
        got = ss.make_receipt(content=content, **a)
        r.check(ss.canonical(got) == c["canonical"], f"make {a['producer']}")
        r.check(got["receipt_sha256"] == c["receipt_sha256"], f"make sha {a['producer']}")
    for c in v["verify"]:
        r.check(ss.verify_receipt(c["receipt"]) == c["errors"], f"verify {c['name']}")


def run_scene(ss, v, r):
    for c in v["hashes"]:
        r.check(ss.canonical_sha256(c["scene"]) == c["sha256"], f"scene hash {c['name']}")
    for c in v["validate"]:
        r.check(ss.validate_scene(c["scene"]) == c["errors"], f"validate {c['name']}")


RUNNERS = {"canonical": run_canonical, "hash": run_hash, "seed": run_seed, "clock": run_clock,
           "sound": run_sound, "export": run_export, "colour": run_colour, "reconcile": run_reconcile,
           "receipt": run_receipt, "scene": run_scene}


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    impl = ROOT / "superstack.py"
    summary = None
    if "--impl" in argv:
        impl = Path(argv[argv.index("--impl") + 1])
    if "--summary" in argv:
        summary = Path(argv[argv.index("--summary") + 1])
    ss = load_impl(impl)
    manifest = json.loads((VEC / "MANIFEST.json").read_text(encoding="utf-8"))
    r = Run()
    r.file = "MANIFEST.json"
    r.check(ss.CONTRACT == manifest["contract"], "contract id")
    for name, digest in manifest["files"].items():
        r.file = name
        raw = (VEC / name).read_bytes()
        r.check(hashlib.sha256(raw).hexdigest() == digest, "file hash matches MANIFEST")
        stem = name[:-5]
        if stem not in RUNNERS:
            r.check(False, "no runner for this file")
            continue
        try:
            RUNNERS[stem](ss, json.loads(raw.decode("utf-8")), r)
        except Exception as e:  # a crash is a failure, never a skip
            r.check(False, f"crashed: {type(e).__name__}: {e}")
    total = sum(r.counts.values())
    for f in r.fails[:40]:
        print("FAIL", f)
    print(f"python: {total - len(r.fails)}/{total} checks passed")
    if summary:
        summary.write_text(json.dumps(r.counts, sort_keys=True, indent=1), encoding="utf-8")
    return 1 if r.fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
