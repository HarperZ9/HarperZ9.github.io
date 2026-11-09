# Where these files come from

The raw-native v0.8.0 release asset `raw-native-0.8.0-viewer.zip`
(https://github.com/HarperZ9/raw-native/releases/tag/v0.8.0), extracted without its top folder
and not edited. The release's own `SHA256SUMS` lists the zip as

    235aa3be5cbb6613f15a8ce6aa04b6f0881cc18618822fee5e740787cdab8f85  raw-native-0.8.0-viewer.zip

and `SHA256SUMS` here is the list that ships inside the zip. `system/studio-viewer.test.mjs`
checks every file against it. To recheck from the release:

    gh release download v0.8.0 --repo HarperZ9/raw-native --pattern 'raw-native-0.8.0-viewer.zip' --pattern SHA256SUMS
    sha256sum --ignore-missing -c SHA256SUMS
    unzip raw-native-0.8.0-viewer.zip && (cd raw-native-0.8.0-viewer && sha256sum -c SHA256SUMS)
