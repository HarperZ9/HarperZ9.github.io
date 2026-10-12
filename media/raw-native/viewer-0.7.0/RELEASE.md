# Where these files come from

The raw-native v0.7.0 release asset `raw-native-0.7.0-viewer.zip`
(https://github.com/HarperZ9/raw-native/releases/tag/v0.7.0), extracted without its top folder
and not edited. The release's own `SHA256SUMS` lists the zip as

    d9a8b8d78b38a0b201e7a7e63d47b6d9eab140fdbaa86b35221fbaa532da94dd  raw-native-0.7.0-viewer.zip

and `SHA256SUMS` here is the list that ships inside the zip. `system/studio-viewer.test.mjs`
checks every file against it. To recheck from the release:

    gh release download v0.7.0 --repo HarperZ9/raw-native --pattern 'raw-native-0.7.0-viewer.zip' --pattern SHA256SUMS
    sha256sum --ignore-missing -c SHA256SUMS
    unzip raw-native-0.7.0-viewer.zip && (cd raw-native-0.7.0-viewer && sha256sum -c SHA256SUMS)
