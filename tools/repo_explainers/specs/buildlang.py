SHA = "1aa2b6bbb11d1ea4faaaa615b991cc48dcb950f1"
B = f"https://github.com/HarperZ9/buildlang/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["source", "effects", "policy", "C or shader", "run", "receipt", "re-verify"]

SPEC = {
    "slug": "buildlang", "repo": "buildlang", "sha": SHA, "name": "BuildLang", "version": "version 1.4.0",
    "description": "An animated walk through BuildLang, a systems language with typed capability effects and native C output: a file read rejected until the function declares FileSystem, a policy profile that denies it, a check receipt that catches an edited source, HLSL from a fragment function, and a scientific-runtime receipt that re-runs a heat-equation kernel to MATCH while a forged receipt fails its seal. Built from buildlang at commit 1aa2b6b.",
    "lede": "A systems language where ambient access is part of a function's type.",
    "for_you": "When code can read files, open sockets or call into C, you want to see that in its signature and stop it at review time. In BuildLang a function that reads a file must say <code>~ FileSystem</code>, and a policy can deny that effect for a whole program. Programs compile to native binaries through C, or to HLSL and GLSL for shaders, and a checked build or a numeric run can write a receipt that someone else re-verifies later.",
    "uses": [
        ("Typed capability effects", "FileSystem, Network, Foreign and the rest are tracked through calls, closures and callbacks."),
        ("Policy profiles", "pure, console-only, offline, ci-review and strict-accountability gate a build."),
        ("Native through C", "<code>buildc run</code> compiles to C, calls gcc, clang or MSVC, and runs the result."),
        ("Receipts you can re-run", "A receipt seals digests and results; <code>buildc receipt verify</code> re-derives them."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from buildc 1.4.0 built from commit 1aa2b6b, on Windows with gcc 13.2. Steps one and two use two small programs written for this page; the rest use the repository's own examples.",
    "steps": [
        {"title": "A file read must be declared",
         "paras": ["Here <code>load_config</code> calls <code>read_file</code> but its signature declares nothing. The checker rejects it, names the effect, and shows the fix: add <code>~ FileSystem</code> or handle the effect. With the effect declared on <code>load_config</code> and on <code>main</code>, the check passes."],
         "src": L("docs/EFFECTS_GUIDE.md"),
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"cases": {"label": "Choose the source", "items": [
                       {"label": "fn load_config() { ... }", "blocks": [{"io": {"cmd": "buildc check a.bld", "lines": ["Type errors found:", "  1:1: function `load_config` performs effect `FileSystem` but does not declare it", "  help: either add `~ FileSystem` to the function signature"], "verdict": ["rejected", "drift"]}}]},
                       {"label": "fn load_config() ~ FileSystem { ... }", "blocks": [{"io": {"cmd": "buildc check b.bld", "lines": ["Type checking... OK", "No errors found in 'b.bld'"], "verdict": ["passes", "ok"]}}]}]}}]},
        {"title": "A policy decides what is allowed",
         "paras": ["Declaring an effect makes it visible; a policy decides whether it is acceptable. The same program fails the <code>console-only</code> profile on three counts, where the effect is observed, declared and propagated, and passes <code>offline</code>, which allows local file work and denies network, process, FFI and GPU."],
         "src": L("docs/EFFECTS_GUIDE.md") + "; <code>buildc policy list</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"cases": {"label": "Choose a profile", "items": [
                       {"label": "console-only", "blocks": [{"io": {"cmd": "buildc check b.bld --profile console-only", "lines": ["Policy violation: policy denies effect `FileSystem` (observed_capabilities in load_config)", "Policy violation: policy denies effect `FileSystem` (declared_effects in main)", "Policy violation: policy denies effect `FileSystem` (propagated_effects in main)"], "verdict": ["exit 1", "drift"]}}]},
                       {"label": "offline", "blocks": [{"io": {"cmd": "buildc check b.bld --profile offline", "lines": ["No errors found in 'b.bld'"], "verdict": ["passes", "ok"]}}]}]}}]},
        {"title": "A check receipt catches an edit",
         "paras": ["<code>buildc check --receipt</code> seals what the check saw: the source digest, declared effects and observed capabilities. <code>buildc receipt verify</code> re-runs the check against the current bytes. After one string in the source changed, the digest no longer matches and verification fails."],
         "src": L("USAGE.md") + ", <code>receipt verify</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"cases": {"label": "Choose the source", "items": [
                       {"label": "unchanged", "blocks": [{"io": {"cmd": "buildc receipt verify b.receipt.json --expect-profile offline", "lines": ["Receipt verified: b.receipt.json"], "verdict": ["verified", "ok"]}}]},
                       {"label": "one string edited", "blocks": [{"io": {"cmd": "buildc receipt verify b.receipt.json --expect-profile offline", "lines": ["Error: source digest mismatch: expected sha256:c1b77bf4..., actual sha256:a68ab835..."], "verdict": ["exit 1", "drift"]}}]}]}}]},
        {"title": "Shaders from the same language",
         "paras": ["A <code>#[fragment]</code> function compiles straight to HLSL for ReShade and DirectX, or to GLSL. The quickstart vignette becomes a pixel shader with the texture read and screen semantics filled in."],
         "src": L("examples/quickstart/vignette_shader.bld"),
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"cmd": "buildc examples/quickstart/vignette_shader.bld --target hlsl -o vignette.hlsl", "lines": ["// Target: HLSL (DirectX / ReShade)", "float4 PS_Vignette(float4 pos : SV_Position, float2 uv : TEXCOORD) : SV_Target0 {", "    float4 color = tex2D(ReShade::BackBuffer, uv);", "    float vig = vignette(uv.x, uv.y, 0.5, 0.6);", "    return float4((color.x * vig), (color.y * vig), (color.z * vig), 1.0);"]}}]},
        {"title": "A numeric run with a stated invariant",
         "paras": ["The heat-equation kernel prints the discrete energy at each of 400 steps. Run with <code>--invariant energy-monotone</code>, buildc compiles it through gcc, checks that no step increases energy, and seals a receipt with the source, compiler, toolchain and output digests. Energy falls from 0.5308 to 0.4069 with no violations.",
                   "The paired unstable kernel uses a step size past the stability limit. Its energy grows to 2.5e28, with 200 violations, and the receipt says FAIL."],
         "src": L("examples/heat_equation_energy.bld") + ", " + L("docs/SCIENTIFIC-RECEIPT.md"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose the kernel", "items": [
                       {"label": "stable, r = 0.45", "blocks": [{"io": {"cmd": "buildc run examples/heat_equation_energy.bld --emit-receipt receipt.json --invariant energy-monotone", "lines": ["observed 400 values, 0.5308267 to 0.4069449", "violation_count 0", "not_claimed: numerical_correctness, convergence, pde_accuracy ..."], "verdict": ["PASS", "ok"]}}]},
                       {"label": "unstable, r = 0.55", "blocks": [{"io": {"cmd": "buildc run examples/heat_equation_energy_unstable.bld --emit-receipt unstable.json --invariant energy-monotone", "lines": ["observed 400 values, 0.5307 to 2.507e+28", "violation_count 200, first at step 199"], "verdict": ["FAIL", "drift", "the invariant did not hold"]}}]}]}}]},
        {"title": "Re-verify, and catch a forgery",
         "paras": ["<code>buildc receipt verify</code> recompiles and re-runs the kernel, then compares. The honest receipt reproduces: MATCH. Change the recorded final energy in the receipt to 0.5 and the seal no longer matches and verification fails."],
         "src": L("docs/SCIENTIFIC-RECEIPT.md"),
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"cases": {"label": "Choose the receipt", "items": [
                       {"label": "as emitted", "blocks": [{"io": {"cmd": "buildc receipt verify receipt.json", "lines": ["MATCH: scientific-runtime receipt re-runs and re-checks clean", "(PASS, violation_count=0; toolchain_matched=true, raw_stdout_reproduced=true)"], "verdict": ["MATCH", "ok"]}}]},
                       {"label": "final value edited", "blocks": [{"io": {"cmd": "buildc receipt verify forged.json", "lines": ["Error: seal mismatch: receipt sha256:b37544c6..., recomputed sha256:52e95946...", "failure_class: SEAL_MISMATCH"], "verdict": ["exit 1", "drift"]}}]}]}}]},
    ],
    "try": [
        ("Install from crates.io; <code>buildc run</code> needs a C compiler (gcc, clang or MSVC) on your PATH.",
         "$ cargo install buildlang\n$ git clone https://github.com/HarperZ9/buildlang && cd buildlang\n$ buildc run examples/quickstart/ledger.bld\n<span class=\"out\">balance: 115</span>\n$ buildc check examples/quickstart/hello.bld --profile console-only --receipt -\n$ buildc run examples/heat_equation_energy.bld --emit-receipt receipt.json --invariant energy-monotone --problem 1d-heat-equation-energy\n$ buildc receipt verify receipt.json"),
    ],
    "try_src": "Output from buildc built with cargo build --release from compiler/ at 1aa2b6b, on Windows 11 with MinGW gcc 13.2. The compiler test suite was not rerun for this page; README.md records 1,818 passing in the release baseline.",
    "limits": [
        "The C backend, effect checking, HLSL and GLSL output and the receipt tooling are the verified core. SPIR-V, LLVM IR, WebAssembly, Rust, x86-64, ARM64, GPU dispatch and <code>#[linear]</code> types are experimental.",
        "A scientific receipt shows that one run's output met the stated invariant. It claims no physical law, numerical correctness or convergence.",
        "The receipt layer refuses programs that use the Model capability: models propose, and the receipt only covers what an oracle can re-check.",
        "While writing this page, <code>println!(read_file(\"ops.toml\"))</code> printed the literal path ops.toml, and the file's contents were lost. Binding the value first, or passing it through <code>\"{}\"</code>, prints it correctly. It is reported for a fix.",
    ],
    "limits_src": "README.md at 1aa2b6b, \"Status and maturity\" and \"Scientific-runtime receipts\"; the println! finding from the run above",
    "recall": [
        ("A function calls read_file with no effect in its signature. What does buildc check say?", "It rejects the function and asks for ~ FileSystem or a handler."),
        ("The program declares FileSystem. Does it pass the console-only profile?", "No. The policy denies FileSystem; offline would allow it."),
        ("Someone edits the final value inside a scientific receipt. What fails first?", "The seal: verify reports SEAL_MISMATCH."),
    ],
    "license_line": "BuildLang is released under the BuildLang Fair-Source License, Version 1.0.",
}
