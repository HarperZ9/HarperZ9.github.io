# Calibrate Pro native preview

This package is current public UI evidence for Calibrate Pro after the dark-room
workbench and hardware-free preview work merged to `main`.

- Source repository: <https://github.com/HarperZ9/calibrate-pro>
- Reviewed change: <https://github.com/HarperZ9/calibrate-pro/pull/12>
- Merge commit: `8ed017577b34c7a6d2bfe04a17a254f377ad7b7c`
- Renderer: `scripts/render_gui_preview.py` in that source revision
- Output: `calibrate-pro-native-preview.png`, 1440 × 900, 57,287 bytes
- SHA-256: `A693ED0150513209E683D44077C18E1260F730C85A35DADAD421E45F00CA0792`

The screenshot uses one bundled generic display fixture. Demonstrated values are
labelled simulated; absent observations are labelled Not measured. Preview mode
does not enumerate display hardware, open USB/DDC devices, construct mutation-
capable workflow pages, start tray/startup services, export to a user path, or
apply display/profile changes. Disabled controls remain visible so the public
asset shows the native product surface without suggesting that an operation ran.

This is not a colorimeter result, compatibility claim, release-binary receipt,
or proof that calibration succeeded on physical hardware. The public v1.1.0
binary release remains the earlier beta distribution; this asset represents the
current source UI merged after that release.
