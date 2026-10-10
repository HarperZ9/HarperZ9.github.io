# Licence of this directory

These files are raw-native's sound engine (`web/sound/master.mjs`, `dsp.mjs`, `truepeak-fir.mjs`,
`meter.mjs`) and the superstack module it imports (`third_party/superstack/superstack.mjs`), from
commit 4edf976 of https://github.com/HarperZ9/raw-native, an engine by the site's author. The
folder keeps raw-native's own layout so the relative imports resolve unchanged. They are licensed
under FSL-1.1-MIT (Functional Source License 1.1, MIT future licence), the licence in that
repository at that commit; superstack.mjs carries its own header naming the algorithms by others
it uses and their terms. `SHA256SUMS` pins the files. The Studio uses them for the mastering
branch that feeds recordings (system/studio-master-worklet.js) and for the loudness and true peak
it reports (system/studio-audio.js). What a visitor hears live does not pass through them.
