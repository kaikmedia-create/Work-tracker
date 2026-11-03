# Relief Studio 14 — geometry repair and honest loading phases

## Changes
- Activate the tested geometry repair on the actual Pages entry point, not only in a downloadable local file.
- Consistent clipping/intersection tolerance, robust small-area calculation, boundary cleanup, bounded local contact regularisation, zero-area retriangulation and precise 3MF coordinates. Closed-body validation remains mandatory. No synthetic substitute buildings.
- Stop reporting missing network bytes while the 3D worker is computing. The loading UI now explicitly distinguishes network, local data processing and local model construction. Remove the invented 92-percent progress for model calculation.
- Geometry failures offer a diagnostic project download retaining the actual input data.

## Checks actually run before publication
133 Node tests passed, including five loading-phase regressions reproducing 47 seconds without new bytes, gate decryption/source parity, geometry regressions and existing posterior workflows. The release was reconstructed from the unchanged production source tree and the tests were run again. Twelve Chromium worker/STL/3MF export checks passed on two explicitly synthetic regression inputs.

A complete real Weinheim run is NOT implied by these results. The separate `source/tests/weinheim-release14.html?run=1&size=4` test performs a fresh OSM/terrain load, uses the exact hash-verified release-14 geometry, checks opposite oriented edge usage and constructs both export formats. It reports actual PASS/FAIL without substituting fixture data.

## Source layout
The authoritative readable source changes and new tests are in the gzip/base64 release delta declared by `upgrade14.json`. `source/tools/prepare_release14.mjs` verifies all base and target SHA-256 hashes before reconstructing source files. `npm start` and `npm test` invoke it automatically. To inspect or edit sources directly, run `node tools/prepare_release14.mjs` from `relief-studio/source` first. Existing unrecognised edits are refused, not overwritten. Historical gates and the experimental `candidate14.json` remain untouched.

Only `relief-studio/` is changed. Publication/deployment status must be checked against GitHub Actions; passing a deployment is not a real-data 3D acceptance test.
