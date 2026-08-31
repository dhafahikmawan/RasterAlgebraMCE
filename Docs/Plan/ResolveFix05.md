# Implementation Plan: Resolve Fix 05

## 1. Goal

Fix the issue described in [Docs/Fix/Fix05.md](../Fix/Fix05.md) using a tightly scoped change set that a junior developer or a low-cost AI agent can implement safely.

The goal is to update the MCE workflow so that the missing-data handling mode of `NaN` or `0` is applied consistently to all missing values, whether those values were:

- already marked as NoData in the uploaded raster; or
- created only because the bounding box widened the effective processing area.

This work should remain localized to the MCE calculation path, the raster metadata used by the form, and a few targeted regression tests.

---

## 2. Problem Summary

The MCE workflow currently handles missing values inconsistently. In practice, there are at least two different kinds of missing cells:

1. A real NoData value already present in the raster source.
2. A synthetic missing value produced because the active bounding box extends beyond the original raster coverage.

The current logic does not treat these cases uniformly when the user chooses a missing-data mode of `NaN` or `0`. As a result, the plugin can behave as though only one class of NoData is being handled, leaving the other class to follow the default behavior.

This bug is specifically in the MCE calculation flow. The fix should make the selected handling mode apply to all NoData-originating values during the calculation, regardless of how the missing value was created.

---

## 3. Implementation Constraints

- Keep the patch narrow and limited to MCE processing, form state, and tests.
- Do not redesign the overall architecture or create a second data path for raster values.
- Prefer small helpers and local state updates over broad refactors.
- Default behavior must remain unchanged when the user does not explicitly select a mode.
- Do not broaden the fix into unrelated Raster Algebra behavior unless a shared helper is clearly safe to reuse.
- If an AI agent is assigned the task, instruct it to work in this order: form state, processing branch, tests, validation.

---

## 4. Files Most Likely to Change

- `src/lib/SpatioProcessing/mce.ts`
- `src/lib/geolibre/right-panel.ts`
- `src/lib/core/types.ts` if raster metadata needs to carry a missing-value policy or a consistent NoData flag
- `src/lib/SpatioProcessing/raster-algebra.ts` only if a shared helper or utility is needed
- `tests/mce.test.ts`
- `tests/right-panel.test.ts` if UI state is being asserted there
- Any helper that normalizes raster values before a calculation

---

## 5. Root Cause and Required Behavior

### Root Cause

The MCE flow likely has a branch that treats real raster NoData and bbox-generated missing cells differently, or it filters only one category before applying the user-selected missing-data rule. This means the selected mode is not consistently applied across all missing-cell sources.

The current implementation appears to distinguish missing data at the wrong abstraction layer. The code is likely checking for a missing cell too early or only on the original raster values, rather than validating after the bounding-box expansion step where synthetic missing pixels are introduced.

### Required Behavior

For the MCE workflow:

- if the user selects the missing-data mode `NaN`, then all NoData values that participate in the calculation should be treated as `NaN`;
- if the user selects the missing-data mode `0`, then all NoData values that participate in the calculation should be treated as `0`;
- this should apply equally to:
  - actual raster NoData values; and
  - missing values created by the bounding-box expansion or raster alignment step.

In other words, the behavior should not depend on whether the missing value came from the original raster or from the bounding-box mismatch. Once a value is identified as missing in the MCE calculation pipeline, it should follow the active mode uniformly.

---

## 6. Work Breakdown for a Junior Developer or Cheap AI Agent

### Task 1: Trace the MCE missing-data path

1. Locate the MCE calculation entry point and the function that prepares raster data for operation.
2. Identify where missing-cell checks happen before/after the bounding-box expansion.
3. Confirm whether the processing path distinguishes between true raster NoData and bbox-created missing cells.
4. Determine the exact point where a user-selected handling mode is applied.
5. Keep the fix within the existing MCE pipeline instead of creating a separate parallel logic path.

Expected output: the implementer can point to the exact function that decides whether a pixel is treated as missing and where the `NaN` or `0` mode is applied.

### Task 2: Normalize all missing values before arithmetic decisions

1. Trace the raster preparation code for the MCE path.
2. Add or adjust a small helper that normalizes missing values after all raster alignment is complete.
3. Ensure that helper treats both kinds of missing values in the same way, regardless of origin.
4. Keep the fix local to the MCE logic and avoid modifying unrelated calculators.

Expected output: any pixel counted as missing in the MCE pipeline is normalized through the same rule, whether it was originally missing or created by the bbox.

### Task 3: Update the MCE form state if needed

1. Confirm whether the MCE form currently exposes a missing-data mode for `NaN` and `0`.
2. If the state model stores the selected mode, verify it is carried all the way to the calculation layer.
3. If the form stores a helper flag or enum, make sure it is applied consistently from UI to processing without leaking stale values.
4. Keep the default behavior unchanged when the user has not selected anything.

Expected output: the UI mode and the processing logic are aligned so the selected value is not dropped before the calculation runs.

### Task 4: Fix the logic branch that currently applies the rule too narrowly

1. Find the branch that handles missing data and check whether it references only one missing-data source.
2. Replace the narrow check with a unified condition: “if this cell is missing in the MCE pipeline, apply the configured mode.”
3. Ensure the mode is executed regardless of whether the NoData came from the raster or from the bounding box.
4. Do not accidentally convert valid numeric data to zero or `NaN`.

Expected output: synthetic and original missing cells are handled under one rule instead of two inconsistent rules.

### Task 5: Add or tighten regression tests

1. Add a test that reproduces the MCE bug with a raster containing real NoData values.
2. Add a second test that reproduces the case where the bounding box creates missing data for pixels that were otherwise valid.
3. Assert that selecting `NaN` produces `NaN` outputs for all missing inputs in both cases.
4. Assert that selecting `0` produces `0` outputs for all missing inputs in both cases.
5. Ensure a valid non-missing cell still arrives unchanged.

Expected output: the regression tests cover both missing-data origins and ensure the fix holds for both modes.

---

## 7. Recommended Implementation Order

Use this order to keep the patch reviewable and low-risk:

1. Trace the MCE missing-data pipeline and isolate the exact narrow branch causing inconsistency.
2. Update the data normalization step so all missing values are processed together.
3. Confirm the MCE form state passes the mode correctly to the calculation.
4. Apply the `NaN` / `0` handling uniformly across original and bbox-generated missing cells.
5. Add regression tests for both missing-data sources.
6. Run the smallest relevant validation set first.

This sequence keeps the patch small and makes review easier.

---

## 8. Risk Control Checklist

- [x] The fix stays scoped to the MCE workflow.
- [x] Both original raster NoData and bbox-created missing values are normalized under one rule.
- [x] The `NaN` and `0` modes remain consistent across missing-data sources.
- [x] Valid numeric data is not silently replaced by `NaN` or `0`.
- [x] The default behavior remains unchanged when no mode is selected.
- [x] The patch avoids a broad rewrite of the raster processing stack.
- [x] Regression tests cover both NoData origins and both handling modes.

---

## 9. Verification

Run the smallest relevant checks first:

```bash
npx vitest run tests/mce.test.ts
```

If the form or selection state is validated in a separate file:

```bash
npx vitest run tests/right-panel.test.ts
```

Then run broader validation if needed:

```bash
npm test
npm run build
```

### Manual validation checklist

1. Create an MCE scenario where a raster has real NoData values.
2. Set the missing-data mode to `NaN` and verify all missing values are treated as `NaN`.
3. Change the mode to `0` and verify all missing values are treated as zero.
4. Create a second scenario where the bbox introduces missing cells with otherwise valid data.
5. Repeat the same checks and confirm the behavior is identical to the original-NoData case.
6. Confirm that valid non-missing cells are not altered.

---

## 10. Acceptance Criteria

The issue is resolved when all of the following are true:

- The MCE missing-data mode applies uniformly to all missing values, regardless of source.
- Real raster NoData and bbox-created missing cells behave the same under `NaN` and `0` modes.
- Valid raster values remain unchanged.
- The default behavior remains stable when the user has not chosen a mode.
- The fix is covered by a focused regression test for both missing-data origins.
- The relevant test suite passes and the project still builds.

---

## 11. Recommended Notes for the Implementer

Keep the patch surgical. The safest implementation is to add or adjust one normalization step in the MCE calculation path and ensure the selected missing-data policy is applied after all raster alignment and bounding-box expansion is complete.

If this work is being assigned to a low-cost AI agent, tell it to:

- trace the MCE missing-data logic first;
- identify exactly where original NoData and bbox-created gaps are separated;
- unify them under a single missing-data handling rule;
- keep the change local to the MCE pipeline;
- validate with the smallest MCE-focused tests before broader checks.

The key idea is simple: once a cell is recognized as missing in the MCE pipeline, the user-selected mode should apply the same way no matter how that missing cell was created.
