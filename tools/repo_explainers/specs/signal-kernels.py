SHA = "386aeb98f6e388b8b7573bdc01081146a28578c8"
B = f"https://github.com/HarperZ9/signal-kernels/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'
A = "include/algorithms/"
MODS = ["entropy", "information", "causal", "changepoint", "forecast", "curvature"]

SPEC = {
    "slug": "signal-kernels", "repo": "signal-kernels", "sha": SHA, "name": "signal-kernels", "version": "source at 386aeb9",
    "description": "An animated walk through signal-kernels, a header-only C++23 library of published signal and information-theory kernels: entropy, divergences, Granger causality, PELT change points, SARIMA and VAR forecasting, and graph curvature, each shown on the inputs of the bundled demo program with the values it printed. Built from signal-kernels at commit 386aeb9.",
    "lede": "Header-only C++23 kernels for entropy, causality, change points and forecasting.",
    "for_you": "Before a model interprets noisy telemetry or scientific data, something has to measure it reliably. signal-kernels is a header-only C++23 library of well-known, published measures: entropy, divergences, causal tests, change-point detection, forecasting and graph curvature. It depends only on the standard library, so you add a folder of headers and link one target.",
    "uses": [
        ("Header-only", "Include the headers you need; the only dependency is the C++ standard library."),
        ("Published methods", "Shannon and Renyi entropy, KL and Jensen-Shannon divergence, Granger, PELT, SARIMA, VAR, Forman and Ollivier-Ricci."),
        ("Unit tested", "99 doctest cases with 245 assertions cover every header."),
        ("One demo program", "<code>examples/demo_pipeline.cpp</code> calls each module on fixed inputs."),
    ],
    "how_intro": "Scroll, or use the step buttons. Each step shows one module on the inputs written in <code>examples/demo_pipeline.cpp</code> and the values it printed, built with MSVC from commit 386aeb9.",
    "steps": [
        {"title": "Entropy: how much surprise",
         "paras": ["A uniform distribution over 8 outcomes carries 3 bits under Shannon, Renyi of order 2 and min-entropy alike. The 256 byte values 0 to 255, each once, carry 8 bits. Permutation entropy of order 3 reads the ordering patterns in a short wiggly series: 1.842 bits."],
         "src": L(A + "entropy.hpp"),
         "scene": [{"pipe": {"stages": MODS, "active": 0}},
                   {"io": {"lines": ["shannon(uniform-8)        = 3.000000 bits", "renyi(uniform-8, a=2)     = 3.000000 bits", "min_entropy(uniform-8)    = 3.000000 bits",
                                     ["shannon_from_bytes(0..255) = 8.000000 bits", "hi"], "permutation_entropy(o=3)  = 1.842371 bits"]}}]},
        {"title": "Divergences: how far apart two distributions are",
         "paras": ["Compare a fair coin, p = (0.5, 0.5), with a biased one, q = (0.9, 0.1). KL divergence is 0.737 bits and is not symmetric; Jensen-Shannon is 0.147 bits and is. Shifting the samples 1, 2, 3, 4 up by one gives a Wasserstein distance of exactly 1. A variable's mutual information with itself equals its entropy: 1.585 bits for three equally likely values."],
         "src": L(A + "information.hpp"),
         "scene": [{"pipe": {"stages": MODS, "active": 1}},
                   {"io": {"lines": ["kl_divergence(p||q)       = 0.736966 bits", "js_divergence(p,q)        = 0.146793 bits", "hellinger(p,q)            = 0.324920",
                                     "wasserstein_1d(u,v)       = 1.000000", ["mutual_information(x,x)   = 1.584963 bits", "hi"]]}}]},
        {"title": "Granger: does x help predict y?",
         "paras": ["The demo builds 200 points where y at each step is 0.8 times x one step earlier plus a little noise. The Granger test asks whether past x improves the prediction of y beyond y's own past. It does, overwhelmingly, and picks a lag of 1, which is how y was built."],
         "src": L(A + "causal.hpp"),
         "scene": [{"pipe": {"stages": MODS, "active": 2}},
                   {"io": {"cmd": "y[i] = 0.8 * x[i-1] + 0.01 * noise", "lines": [["granger x->y: f_stat=1324393.4081  p_value=0.0000  optimal_lag=1", "hi"]]}}]},
        {"title": "PELT: where the series changes",
         "paras": ["A step series sits at 0 for 25 points and at 10 for the next 25. PELT, with an L2 cost and a BIC penalty, finds exactly one change point, at index 25."],
         "src": L(A + "changepoint.hpp"),
         "scene": [{"pipe": {"stages": MODS, "active": 3}},
                   {"io": {"cmd": "step = 25 x 0.0, then 25 x 10.0", "lines": ["pelt(L2) detected 1 change point(s):", ["  index=25  segment_cost=0.000000", "hi"]]}}]},
        {"title": "Forecasting: SARIMA and VAR",
         "paras": ["An AR(1) model is fitted to a 200-point series and forecasts five steps, which settle toward 0.066. A VAR(1) is fitted to two series together and forecasts three steps for both, a 3 by 2 result."],
         "src": L(A + "forecast.hpp"),
         "scene": [{"pipe": {"stages": MODS, "active": 4}},
                   {"io": {"lines": ["SARIMA fitted=1  ar[0]=0.2868  sigma2=0.000166", ["SARIMA forecast(5) -> 5 values: 0.0729 0.0682 0.0668 0.0664 0.0663", "hi"], "VAR(1) fitted=1  forecast shape = [3][2]"]}}]},
        {"title": "Graph curvature",
         "paras": ["On the path graph 0, 1, 2, the edge from 0 to 1 has Forman-Ricci curvature -1 and Ollivier-Ricci curvature 0.5 at a laziness of 0.5. The shortest path from 0 to 2 is 2."],
         "src": L(A + "curvature.hpp"),
         "scene": [{"pipe": {"stages": MODS, "active": 5}},
                   {"io": {"lines": ["forman_ricci(0,1)         = -1.000000", "ollivier_ricci(0,1,a=0.5) = 0.500000", "shortest_path(0->2)       = 2.000000"],
                           "verdict": ["99 test cases pass", "ok", "245 assertions, all headers"]}}]},
    ],
    "try": [
        ("Build with CMake and MSVC; the bundled CMake file targets Windows x64, and the headers themselves are standard C++23.",
         "$ git clone https://github.com/HarperZ9/signal-kernels && cd signal-kernels\n$ cmake -S . -B build -DSIGNAL_KERNELS_BUILD_TESTS=ON\n$ cmake --build build --config Debug\n$ ctest --test-dir build -C Debug --output-on-failure"),
    ],
    "try_src": "Values above came from examples/demo_pipeline.cpp built with MSVC 19.50 in Release from commit 386aeb9. The test binary reported 99 cases and 245 assertions passing.",
    "limits": [
        "The bundled CMakeLists.txt targets Windows x64 with MSVC and stops on other platforms. The headers are standard C++ and can be used elsewhere with your own build.",
        "These are published methods. The library offers no new statistics and makes no claim beyond each method's assumptions.",
        "A Granger result says past x helps predict y. It does not show that x causes y.",
        "The package is intended for defensive and research analytics.",
    ],
    "limits_src": "README.md at 386aeb9, \"Platform\" and \"Overview\"; PUBLIC-DISCLAIMER.md",
    "recall": [
        ("Why are Shannon, Renyi and min-entropy all 3 bits for a uniform 8-outcome distribution?", "On a uniform distribution every entropy of this family takes the same value, log2 of 8."),
        ("The demo's y is built from x one step earlier. What lag does the Granger test choose?", "1."),
        ("Where does PELT put the change in a series of 25 zeros then 25 tens?", "At index 25."),
    ],
    "license_line": "signal-kernels is released under FSL-1.1-MIT.",
}
