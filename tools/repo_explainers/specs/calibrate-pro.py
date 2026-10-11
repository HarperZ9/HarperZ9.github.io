SHA = "6e983bb2fd41bd4925569864a3ceb903a43c7468"
B = f"https://github.com/HarperZ9/calibrate-pro/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["detect", "method", "preview", "apply", "verify", "save or report"]

SPEC = {
    "slug": "calibrate-pro", "repo": "calibrate-pro", "sha": SHA, "name": "calibrate-pro", "version": "version 2.0.1",
    "description": "An animated walk through calibrate-pro, a Windows display-calibration toolkit: a doctor that probes no hardware, a session that says why each closed action is closed, calibration targets, a modelled correction for a QD-OLED panel record that takes average error from 3.62 to 0.65 dE2000 and labels it estimated, and a sealed bundle whose recheck catches an edited LUT. Built from calibrate-pro at commit 6e983bb.",
    "lede": "Calibrate Windows displays, and label every number with where it came from.",
    "for_you": "If your screen shows colour wrong, every photo, grade and render you judge on it is judged against a bad reference. calibrate-pro finds your displays, plans a correction toward a target such as sRGB or DCI-P3, writes an ICC profile and a 3D LUT, and reports how close the result should be. Each figure says whether it was measured with an instrument or estimated from a panel record, and nothing changes on your display until you confirm an exact preview.",
    "uses": [
        ("Evidence labels", "Values read measured, estimated, simulated, replayed or Not measured."),
        ("Preview, then confirm", "A display change needs an exact preview and an explicit yes; declining writes nothing."),
        ("Sealed output", "Profiles and LUTs are published with a manifest of SHA-256 hashes you can recheck."),
        ("58 panel records", "Characterized primaries and gamma for common monitors, plus a generic fallback."),
    ],
    "how_intro": "Scroll, or use the step buttons. Every line is output from calibrate-pro 2.0.1 at commit 6e983bb, run from source on Windows. Step four calls the sensorless engine from Python on a panel record, because the test machine's own display has no record.",
    "steps": [
        {"title": "Ask what this install can do",
         "paras": ["<code>calibrate-pro doctor</code> reports versions and which capabilities the installation supports: colorimeter over HID, DDC/CI, gamma ramps and ICC profiles. It probes no display, sensor or bus, and it says so, so none of its lines claims a device is present."],
         "src": L("calibrate_pro/commands/doctor.py"),
         "scene": [{"io": {"cmd": "calibrate-pro doctor", "lines": ["Calibrate Pro 2.0.1", "  Qt binding            ok                 PySide6", "  PQ reference math     ok", "  ddc_ci                supported          Dxva2.dll/GetVCPFeatureAndVCPFeatureReply", "  icc_profile           supported          Mscms.dll/WcsGetDefaultColorProfile", ["No display, colorimeter, or bus was probed.", "hi"]], "verdict": ["Result: ok", "ok"]}}]},
        {"title": "Find the display, and what is closed",
         "paras": ["<code>detect</code> lists the displays the machine presents and where each characterization comes from. The test display matched no panel record. <code>status</code> then lists every action and its state: 27 of 97 are available at this stage, and each closed one carries its reason."],
         "src": L("calibrate_pro/application") + ", " + L("calibrate_pro/workflow.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"io": {"cmd": "calibrate-pro detect && calibrate-pro status", "lines": ["1 display(s) observed", "  1920x1080 at 60 Hz, SDR   characterization: detector:no_panel_match", "Stage: method", ["Actions: 27 of 97 available in this session", "hi"], "disabled  calibration.method.measured", "  Measured calibration requires a selected characterized display and a connected colorimeter."]}}]},
        {"title": "Choose a target",
         "paras": ["A target fixes three things: the gamut, the white point and the tone response. Four presets cover common work, and any target can be composed from the three axes, with eleven gamuts including sRGB, BT.2020 and ACEScg, and white points named or given in kelvin."],
         "src": L("calibrate_pro/targets"),
         "scene": [{"pipe": {"stages": FLOW, "active": 1}},
                   {"table": {"head": ["preset", "gamut", "white point", "tone response"], "rows": [["srgb_web", "sRGB", "D65", "2.2"], ["photography", "sRGB", "D50", "2.2"], ["rec709", "Rec.709", "D65", "BT.1886"], ["dci_p3", "DCI-P3", "D65", "2.4"]]}}]},
        {"title": "Predict the error before and after",
         "paras": ["The Dell AW3423DW record is a QD-OLED with primaries far wider than sRGB. The sensorless engine simulates the 24 ColorChecker patches through the full chain, once with no correction and once with the computed 3 by 3 matrix. Average error falls from 3.62 to 0.65 dE2000, and the worst patch from 6.64 to 2.92.",
                   "These are predictions from the panel record. No display was measured, and the label says estimated."],
         "src": L("calibrate_pro/sensorless/neuralux.py") + ", <code>verify_calibration</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 4}},
                   {"table": {"head": ["patch", "uncorrected dE", "corrected dE"], "rows": [["Bluish Green", "6.64", "0.42"], ["Green", "6.28", "0.60"], ["Orange", "5.45", "0.83"], ["Cyan", "4.99", "2.92"], ["Neutral 5", "0.34", "0.32"], ["average of 24", "3.62", "0.65"]]}},
                   {"verdict": ["estimated", "unv", "a model prediction; measure to confirm"]}]},
        {"title": "Publish a sealed bundle",
         "paras": ["<code>generate-profiles</code> writes the ICC profile and a 33-point 3D LUT into a folder you name, with a manifest holding the size and SHA-256 of each file. <code>profiles</code> rechecks the seal later. Pick a state in the panel: after one line was appended to the LUT, the recheck reports the bundle CHANGED and names the file."],
         "src": L("calibrate_pro/commands/session_profiles.py"),
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"cases": {"label": "Choose the bundle", "items": [
                       {"label": "as published", "blocks": [{"io": {"cmd": "calibrate-pro profiles out", "lines": ["Calibrate_Pro.cube  sha256 18d546e3...", "Calibrate_Pro.icc   sha256 fe40a201...", "1 of 1 sealed, 0 unreadable"], "verdict": ["sealed", "ok"]}}]},
                       {"label": "LUT edited afterwards", "blocks": [{"io": {"cmd": "calibrate-pro profiles out", "lines": ["changed        Calibrate_Pro.cube", "0 of 1 sealed, 0 unreadable"], "verdict": ["CHANGED", "drift", "the edit is named"]}}]}]}}]},
        {"title": "A display change needs your yes",
         "paras": ["The terminal reads and plans, and writes only files you name. Changing the display happens in the window: Detect, Method, Preview, Apply, Verify, then Save or Report. The app starts unelevated, shows the exact change first, and declining performs no write.",
                   "This step is described from the README; the window was not driven for this page."],
         "src": "README.md, \"Current status\" and \"What to test first\"",
         "scene": [{"pipe": {"stages": FLOW, "active": 2, "note": "the window proposes; you confirm"}},
                   {"cap": "Not run for this page: the GUI workflow changes display state."}]},
    ],
    "try": [
        ("From source on Windows 10 or 11 with Python 3.10 or newer, or from the Windows release build. These commands read and plan; the last one writes files only into <code>out</code>.",
         "$ git clone https://github.com/HarperZ9/calibrate-pro && cd calibrate-pro\n$ pip install -e \".[all]\"\n$ calibrate-pro doctor\n$ calibrate-pro detect\n$ calibrate-pro verify --target srgb_web\n$ calibrate-pro generate-profiles out --target srgb_web\n$ calibrate-pro profiles out"),
    ],
    "try_src": "Output from calibrate-pro 2.0.1 at 6e983bb on Windows 11 with Python 3.12. Step four used SensorlessEngine.verify_calibration with an identity matrix for the uncorrected run, which is the comparison the verify command prints.",
    "limits": [
        "Sensorless figures are predictions from a panel record. Your unit can differ from the record; only an instrument establishes the result.",
        "The modelled figure covers gamut reproduction. Tone response is outside it, so measure to establish grey tracking.",
        "Windows only. The 2.0.1 artifacts are not Authenticode-signed, so check the download against SHA256SUMS.txt.",
        "Hybrid calibration, which would mix a panel record with an instrument run, stays disabled.",
    ],
    "limits_src": "README.md at 6e983bb, \"Install\" and \"Current status\"; verify command output",
    "recall": [
        ("Which command reports capabilities without probing any device?", "calibrate-pro doctor."),
        ("The AW3423DW prediction drops to 0.65 dE2000. What label does it carry?", "Estimated: it comes from the panel record, and no display was measured."),
        ("Someone edits the LUT after publishing. What does the recheck say?", "CHANGED, naming Calibrate_Pro.cube."),
    ],
    "license_line": "calibrate-pro is released under FSL-1.1-MIT.",
}
