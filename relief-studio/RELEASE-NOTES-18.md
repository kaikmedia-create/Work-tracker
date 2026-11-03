# Relief Studio 18 – fix for the supplied 3.2 × 3 km Weinheim model

## Reproduced failure
The November 3 diagnostic contains all map and terrain data: 6,346 input building/wall records, a 3.2 × 3 km selection and a 200 mm model width. Version 17 rejects this model with a non-printable seam. This is not an Overpass/download failure.

## Root causes and changes
1. A fixed budget of 100 contact repairs rejected this scene's 109 repairable point contacts. The budget now scales with the scene, with an absolute cap of 2,048 and the existing four-pass limit.
2. A microscopic unmatched XY endpoint was repeatedly covered by roof patches without resolving its planar topology. The mesh stitcher now rewelds only endpoints reported by the defective seam graph. The maximum allowed displacement is 0.00001 mm, including transitive groups; this scene needs only 0.0000003425 mm.
3. Remaining seam failures include structured error code and repair statistics in the local Diagnose download.
4. The release gate and npm preparation script verify SHA-256 before applying the changes. Historical gate tests retain their historical source expectations; version 18 verifies the new worker and browser sources exactly.

The final watertightness/edge checks remain mandatory. No whole building is dropped to hide a repair failure. Intentional gaps larger than the numerical tolerance remain gaps.

## Executed acceptance
- 195 automated tests passed, zero failed.
- Eight Chromium checks passed, including the exact new diagnostic imported through the UI, the actual worker, STL and 3MF download buttons, unchanged extent/scale, invalid subsequent import, diagnostic export and no unhandled JavaScript errors.
- The full supplied model succeeds: 6,344 represented objects, 1,155,772 triangles, one connected solid, zero bad edges and zero area-less triangles. Of the 6,346 input records, one parent is already represented by its parts and one record lies wholly outside the selected bounds. No failed object was omitted.
- 109 contact repairs complete in one pass; one microscopic planar seam is rewelded.
- Independent re-reading of both STL and 3MF confirms watertightness, consistent winding, positive volume, one component and no area-less triangles. The files downloaded by the browser are byte-identical to these independently validated exports.
- The earlier 3,294-object Weinheim fixture still passes with 612,546 triangles and no omitted object.

## Reproduce without committing private inputs
Run `npm test` in `relief-studio/source`. For a complete diagnostic saved locally:
```
RELIEF_DIAG_FIXTURE=/path/to/diagnostic.json npm run test:diagnostic
```
For the real browser check, first run the version-18 gate test to generate `reports/v18/gate-rendered.html`, then provide `RELIEF_DIAG_FIXTURE` and `RELIEF_DIAG_OUT` to `python tests/diagnostic_v18_browser.py`. The browser test deliberately blocks external requests and uses the complete supplied data.

## Scope
These tests validate the supplied complete map datasets and the numerical repair. They do not claim a fresh live Overpass download, every possible geographic scene or a physical test print. Private diagnostic geometry and user exports are not part of this repository.
