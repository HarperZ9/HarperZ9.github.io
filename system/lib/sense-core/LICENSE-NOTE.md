# Licence of this directory

This directory is a copy of sense-core, the perception engine from studio-libs v0.2.0 by the
site's author. `LICENSE` here is that release's copy of the package licence.

From v0.2.0 studio-libs is licensed under FSL-1.1-MIT (Functional Source
License 1.1, MIT future licence). Copies taken from earlier versions carried
the GNU Affero General Public License 3.0.

One file differs from the tag: `features.mjs` computes `dominantColors` on typed arrays instead of a Map, with the same sums, averages and order (the site's change of 3 October 2026). `system/sense-parity.test.mjs` holds it equal to the original.

The site's own code that loads this engine stays under the site's LICENSE.
