"""determinism.py: does the metals render's shading stage give the same bytes on the CPU and the GPU?

Renders one frame of a sphere scene and, for every spectral_shade call it makes, runs the same inputs through the
kernel's CPU path (numpy, the reference contract) and the fused CUDA kernel, and compares the XYZ bytes. Also runs
a control: changing one incidence cosine by one part in 4096 must change the output hash (a one-ulp change of
the cosine can round away in the float32 XYZ, so it is not a useful control here; `kernels check` perturbs outputs).

  python determinism.py metals 960 540
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import metals  # noqa: E402
from common import pixel_uv  # noqa: E402
from kcore.ops import NumpyOps  # noqa: E402
from spectral_shade import kernel as S  # noqa: E402


def main(scene="metals", W=960, H=540):
    W, H = int(W), int(H)
    calls, equal, px, hcpu, hgpu = 0, 0, 0, hashlib.sha256(), hashlib.sha256()
    orig = metals.Kernel.__call__

    def checked(self, mid, cosi, lname):
        nonlocal calls, equal, px
        g = orig(self, mid, cosi, lname)
        n, k = (a.cpu().numpy() for a in self.m[mid])
        inp = {"wmix": np.zeros(cosi.shape[0], np.float32), "cosi": cosi.cpu().numpy(), "nA": n, "kA": k, "nB": n, "kB": k,
               "light": self.L[lname].cpu().numpy(), "cmf": self.cmf.cpu().numpy(), "n_out": np.array(1.0, np.float32)}
        c = S.run(S.prepare(inp, NumpyOps()), NumpyOps())["xyz"]
        gb, cb = g.cpu().numpy().tobytes(), np.ascontiguousarray(c, np.float32).tobytes()
        hgpu.update(gb); hcpu.update(cb)
        calls += 1; px += cosi.shape[0]; equal += gb == cb
        return g
    metals.Kernel.__call__ = checked
    shade = metals.make_shader(scene, samples=1)
    u, v = pixel_uv(0, 0, W, H, W, H)
    shade(u, v, (1 / W, 1 / H))
    # control: a small change to one incidence cosine must change the bytes
    inp = S.spectra("gold", "gold", "A"); inp["wmix"] = np.zeros(4, np.float32); inp["cosi"] = np.array([0.3, 0.5, 0.7, 0.9], np.float32)
    a = S.run(S.prepare(inp, NumpyOps()), NumpyOps())["xyz"].tobytes()
    inp["cosi"][1] = np.float32(inp["cosi"][1] * (1 + 2 ** -12)); b = S.run(S.prepare(inp, NumpyOps()), NumpyOps())["xyz"].tobytes()
    rec = {"scene": scene, "W": W, "H": H, "kernel_calls": calls, "shaded_samples": px, "calls_bit_identical": equal,
           "cpu_sha256": hcpu.hexdigest(), "gpu_sha256": hgpu.hexdigest(), "control_input_change_changes_output": a != b}
    print(json.dumps(rec))


if __name__ == "__main__":
    main(*sys.argv[1:4])
