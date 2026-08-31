# Implementation Plan: Resolve Fix 06

## 1. Goal

Fix the two bounding-box bugs described in [Docs/Fix/Fix06.md](../Fix/Fix06.md) using a narrow, reviewable patch that a junior developer or low-cost AI agent can implement safely.

The target behavior is:

- the selected bounding-box raster must control the calculation extent for both MCE and Raster Algebra;
- the Raster Calculator must default to the leftmost raster operand in the expression rather than the first uploaded raster;
- existing behavior for unrelated processing paths must remain unchanged.

This work should stay limited to the calculation entry points, the UI state that chooses the bounding raster, and a small set of regression tests.

---

## 2. Problem Summary

There are two related issues:

1. The bounding box raster selection in both MCE and Raster Algebra is effectively ignored during the actual calculation.
2. In Raster Algebra, the default bounding box is based on the first uploaded raster instead of the leftmost raster used by the expression.

The result is that calculations are anchored to the wrong reference grid, causing output to be clipped, resampled, or aligned against a raster that the user never selected. This is especially noticeable when the user has more than one raster loaded and expects the bounding box to follow a chosen reference raster or the expression’s first relevant operand.

---

## 3. Implementation Constraints

- Keep the patch small and surgical.
- Do not redesign the raster-processing architecture.
- Keep all logic inside the existing alignment and reference-selection flow.
- Prefer explicit helper functions over large rewrites.
- If the selected raster is unavailable, fall back safely to a well-defined default.
- Do not broaden the fix into unrelated raster behaviors or broad UI cleanup.
- If a cheap AI agent is assigned the task, it should work in this order: state flow, selection logic, calculation path, tests.

---

## 4. Files Most Likely to Change

- `src/lib/geolibre/right-panel.ts`
- `src/lib/SpatioProcessing/raster-algebra.ts`
- `src/lib/SpatioProcessing/mce.ts`
- `tests/raster-algebra.test.ts`
- `tests/mce.test.ts`
- `tests/right-panel.test.ts` if UI state is asserted there

Only touch additional code if a helper is clearly shared and the change is required for correctness.

---

## 5. Root Cause and Required Behavior

### Root Cause

The bounding-box logic appears to use a reference raster selected too early or too loosely:

- Raster Algebra appears to default to the first uploaded raster in the input list when no explicit base raster is passed.
- MCE builds its combined raster around the first layer or the chosen reference key, but the UI may not actually be passing the correct raster selection through the full pipeline.
- The effective base raster for alignment is therefore not always the selected bounding raster or the leftmost expression operand.

In short, the system is using a fixed or implicit raster identity instead of the user-selected or expression-derived reference raster.

### Required Behavior

For both workflows:

- the selected bounding raster must define the calculation grid when one is chosen;
- if no explicit user choice exists, Raster Algebra must default to the leftmost referenced raster in the expression rather than whichever raster happens to be first in the uploaded list;
- the reference raster must be used consistently for alignment, clipping, and missing-data handling;
- all valid rasters still need to align to the same CRS and grid before evaluation;
- no unrelated raster-processing behavior should change.

---

## 6. Work Breakdown for a Junior Developer or Cheap AI Agent

### Task 1: Trace the reference-raster selection path

1. Open the UI code that handles the bounding raster selector and the Raster Algebra expression form.
2. Confirm which variable is used as the base raster when the user chooses a bounding raster.
3. Confirm which raster is chosen when no explicit selection exists.
4. Trace the call path into `calculateRaster(...)` and `buildMceRaster(...)`.
5. Verify whether the wrong raster is selected before or during alignment.

Expected output: the implementer can name the exact function and variable that decides the base raster for both workflows.

### Task 2: Fix the Raster Algebra default selection logic

1. Identify how `calculateRaster(...)` chooses the `baseRaster`.
2. Replace the current default behavior, which appears to prefer the first uploaded raster, with logic that prefers the leftmost raster referenced by the expression.
3. Keep the explicit `referenceRasterKey` override as the highest-priority selection when the user has chosen a bounding raster.
4. Ensure expression references are resolved before the calculation begins.

Expected output: when no bounding raster is selected, the raster used for alignment is the leftmost referenced raster in the expression rather than the first uploaded raster.

### Task 3: Fix MCE bounding-raster selection plumbing

1. Trace the value passed from the UI into `buildMceRaster(...)` and confirm whether the selected bounding raster is used.
2. Check whether the code falls back to `inputs[0]` even when a different raster was selected.
3. Align the MCE base raster with the same rules as Raster Algebra: explicit selection first, otherwise a deterministic logical default.
4. Keep the patch restricted to the MCE build path and its selection logic.

Expected output: the MCE output uses the user-selected bounding raster or a clearly defined fallback instead of silently defaulting to the first raster loaded.

### Task 4: Confirm the base raster drives alignment consistently

1. Validate that the selected base raster is used when calling the alignment helpers and when building the output grid.
2. Verify that all input rasters are aligned to that grid.
3. Ensure that warnings and synthetic missing pixels are still generated only when clipping or resampling actually occurs.
4. Do not change the behavior of valid aligned rasters.

Expected output: all raster values are evaluated against the correct reference grid.

### Task 5: Add regression tests for both failures

1. Add a test where the first uploaded raster is not the correct reference and verify the output is based on the selected or leftmost expression raster.
2. Add a second test that reproduces the bounding-box mismatch in MCE and verifies the selected raster becomes the active bounding grid.
3. Include a case where a user explicitly chooses a different raster and confirm the calculation uses it.
4. Keep assertions focused on base-grid selection and resulting values; do not over-mock the behavior.

Expected output: the tests cover the two root issues and prevent regressions.

---

## 7. Recommended Implementation Order

Use this order to keep the patch readable and low-risk:

1. Trace the UI state and the function call that passes the bounding raster.
2. Fix the Raster Algebra default base-raster selection logic.
3. Fix the MCE bounding-raster selection logic.
4. Verify the alignment path uses the chosen base raster consistently.
5. Add regression tests for both explicit-selection and default-selection scenarios.
6. Run the smallest relevant test set before broader verification.

This sequence keeps the code change narrow and makes review much easier.

---

## 8. Risk Control Checklist

- [x] The fix is limited to reference-raster selection and alignment logic.
- [x] The explicit bounding-raster selection remains the highest priority.
- [x] The default behavior is deterministic and derived from the expression or operation rather than upload order.
- [x] No unrelated raster logic is refactored away from its current behavior.
- [x] The patch stays focused on MCE and Raster Algebra only.
- [x] Regression tests cover both the explicit selection case and the default-selection case.

---

## 9. Verification

Run the smallest relevant checks first:

```bash
npx vitest run tests/raster-algebra.test.ts tests/mce.test.ts
```

If the UI state is validated separately:

```bash
npx vitest run tests/right-panel.test.ts
```

If needed after the targeted checks:

```bash
npm test
npm run build
```

### Manual validation checklist

1. Load multiple rasters with different extents.
2. Select a bounding raster different from the first uploaded raster.
3. Confirm the calculation output is aligned to that selected raster.
4. Clear the selection and verify the default reference is the leftmost raster operand in the expression.
5. Repeat the same check in MCE and confirm the selected or default raster controls the output extent.
6. Confirm that valid non-outside cells are not altered by the fix.

---

## 10. Acceptance Criteria

The issue is resolved when all of the following are true:

- the selected bounding raster controls the calculation extent for both Raster Algebra and MCE;
- Raster Algebra defaults to the leftmost raster operand in the expression rather than the first uploaded raster;
- MCE no longer silently defaults to the first loaded raster when another raster is intended as the bounding raster;
- aligned rasters are evaluated against the correct reference grid;
- the fix is covered by focused regression tests for both explicit and default selection cases;
- the relevant tests pass and the project still builds.

---

## 11. Recommended Notes for the Implementer

Keep the patch surgical. The safest implementation is to make the base-raster decision explicit and centralized, then ensure that every alignment and evaluation step uses the same chosen raster.

If this work is assigned to a low-cost AI agent, tell it to:

- trace the UI selection state into the calculation layer;
- identify the place where the first uploaded raster is being chosen implicitly;
- replace that implicit choice with explicit reference-raster logic;
- ensure Raster Algebra prefers the leftmost expression operand when no bounding raster is selected;
- verify MCE follows the same rule;
- validate with the smallest relevant tests before broader validation.

The key idea is simple: the reference raster should never be chosen by upload order when the user or the expression has already determined a logical base.
